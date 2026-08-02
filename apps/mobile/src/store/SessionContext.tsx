import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import type { ComplianceStatus, QuotaStatus, UserStatus } from '../types';
import { isLateNight } from '../utils/format';

interface SessionContextValue {
  status: UserStatus | null;
  compliance: ComplianceStatus | null;
  quota: QuotaStatus | null;
  isMember: boolean;
  membershipDaysLeft: number;
  /** 是否因防沉迷而阻断（深夜时段 / 连续使用超限） */
  antiAddictionBlocked: boolean;
  /** 累计活跃秒数（用于长时使用提醒） */
  activeSeconds: number;
  refreshStatus: () => Promise<void>;
  refreshCompliance: () => Promise<void>;
  notifyActivity: () => void;
  /** 主动展示防沉迷弹窗（供入口调用） */
  requestAntiAddictionCheck: () => void;
  dismissAntiAddiction: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const ACTIVITY_TICK_MS = 60_000;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [antiAddictionVisible, setAntiAddictionVisible] = useState(false);
  const lastTick = useRef<number>(Date.now());
  const accumulated = useRef(0);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.userStatus();
      setStatus(s);
      // 若服务端已阻断（深夜时段），展示弹窗
      if (s.antiAddiction.blocked) {
        setAntiAddictionVisible(true);
      }
    } catch {
      // 忽略拉取失败
    }
  }, []);

  const refreshCompliance = useCallback(async () => {
    try {
      const c = await api.complianceStatus();
      setCompliance(c);
      if (c.antiAddiction.currentlyBlocked) {
        setAntiAddictionVisible(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    void refreshCompliance();
  }, [refreshStatus, refreshCompliance]);

  // 活跃计时：每分钟累加一次（近似连续使用时长）
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = Math.round((now - lastTick.current) / 1000);
      lastTick.current = now;
      accumulated.current += Math.max(0, Math.min(delta, 120));
      setActiveSeconds(accumulated.current);
    }, ACTIVITY_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // 长时使用 → 触发防沉迷弹窗
  useEffect(() => {
    const limitMin = compliance?.antiAddiction.continuousLimitMin ?? 60;
    if (activeSeconds >= limitMin * 60 && !antiAddictionVisible) {
      setAntiAddictionVisible(true);
      // 触发后重置累计，避免无限弹窗
      accumulated.current = 0;
      setActiveSeconds(0);
    }
  }, [activeSeconds, antiAddictionVisible, compliance]);

  // 深夜时段本地兜底
  useEffect(() => {
    const checkLateNight = () => {
      if (compliance?.antiAddiction.lateNightBlock && isLateNight()) {
        setAntiAddictionVisible(true);
      }
    };
    checkLateNight();
    const timer = setInterval(checkLateNight, 5 * 60_000);
    return () => clearInterval(timer);
  }, [compliance]);

  const notifyActivity = useCallback(() => {
    // 有交互即视为活跃；重置防沉迷连续窗口基准
    lastTick.current = Date.now();
  }, []);

  const requestAntiAddictionCheck = useCallback(() => {
    setAntiAddictionVisible(true);
  }, []);

  const dismissAntiAddiction = useCallback(() => {
    setAntiAddictionVisible(false);
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const quota = status?.quota ?? null;
    const isMember = Boolean(status?.membership);
    const membershipDaysLeft = status?.membership?.daysLeft ?? 0;
    return {
      status,
      compliance,
      quota,
      isMember,
      membershipDaysLeft,
      antiAddictionBlocked: antiAddictionVisible,
      activeSeconds,
      refreshStatus,
      refreshCompliance,
      notifyActivity,
      requestAntiAddictionCheck,
      dismissAntiAddiction,
    };
  }, [status, compliance, quota, isMember, membershipDaysLeft, antiAddictionVisible, activeSeconds, refreshStatus, refreshCompliance, notifyActivity, requestAntiAddictionCheck, dismissAntiAddiction]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession 必须在 <SessionProvider> 内使用');
  return ctx;
}
