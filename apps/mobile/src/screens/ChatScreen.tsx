import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api } from '../api';
import { AINoticeBar } from '../components/AINoticeBar';
import { AppModal } from '../components/AppModal';
import { Avatar } from '../components/Avatar';
import { BreathingDot } from '../components/BreathingDot';
import { CustomizeModal } from '../components/CustomizeModal';
import { GiftFloatLayer } from '../components/GiftFloatLayer';
import { GiftSheet } from '../components/GiftSheet';
import { MemoryPanel } from '../components/MemoryPanel';
import { MoodCorrectionModal } from '../components/MoodCorrectionModal';
import { MoodInsightPanel } from '../components/MoodInsightPanel';
import { MoodTimelinePanel } from '../components/MoodTimelinePanel';
import { HeartbeatBar } from '../components/HeartbeatBar';
import { LoadingView } from '../components/LoadingView';
import { MessageBubble } from '../components/MessageBubble';
import { PrimaryButton } from '../components/PrimaryButton';
import { useNavigation } from '../navigation/NavigationContext';
import { useSession } from '../store/SessionContext';
import { useToast } from '../store/ToastContext';
import { colors, fontSizes, fontWeights, radii, spacing } from '../theme';
import type { Affection, Character, ChatMode, CustomizationPayload, Gift, MemoryReadResult, Message, MoodInsightSummaryResult, MoodSnapshot, MoodTimelineResult } from '../types';
import { applyMoodCorrection, correctionFallbackNotice, createCorrectionForm, type MoodCorrectionForm } from '../utils/moodCorrections';
import { affectionLevelLabel, genId } from '../utils/format';

interface ChatScreenProps {
  mode: ChatMode;
  conversationId?: string;
  characters: Character[];
}

function mergeMessages(prev: Message[], items: Message[]): Message[] {
  const map = new Map<string, Message>();
  for (const m of prev) map.set(m.id, m);
  for (const m of items) map.set(m.id, m);
  return [...map.values()].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

const POLL_INTERVAL_MS = 1200;
const PROACTIVE_DELAY_MS = 16_000;

export function ChatScreen({ mode, conversationId: initConvId, characters: initCharacters }: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const { pop, push } = useNavigation();
  const { showToast } = useToast();
  const { notifyActivity, refreshStatus, requestAntiAddictionCheck } = useSession();

  const [characters, setCharacters] = useState<Character[]>(initCharacters);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memory, setMemory] = useState<MemoryReadResult | null>(null);
  const [moodTimeline, setMoodTimeline] = useState<MoodTimelineResult | null>(null);
  const [moodInsight, setMoodInsight] = useState<MoodInsightSummaryResult | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initConvId ?? null);
  const [activeCharId, setActiveCharId] = useState<string>(initCharacters[0]?.id ?? '');
  const [affections, setAffections] = useState<Record<string, Affection>>(() =>
    Object.fromEntries(initCharacters.map((c) => [c.id, c.affection ?? { value: 0, level: 1, progress: 0 }])),
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(Boolean(initConvId));
  const [greeted, setGreeted] = useState(false);

  const [gifts, setGifts] = useState<Gift[]>([]);
  const [giftVisible, setGiftVisible] = useState(false);
  const [giftSending, setGiftSending] = useState(false);
  const [giftBurst, setGiftBurst] = useState(0);
  const [giftEmoji, setGiftEmoji] = useState('🎁');
  const [giftLabel, setGiftLabel] = useState<string | undefined>(undefined);
  const [giftIntensity, setGiftIntensity] = useState<'medium' | 'high'>('medium');

  const [correctionPoint, setCorrectionPoint] = useState<MoodSnapshot | null>(null);
  const [correctionForm, setCorrectionForm] = useState<MoodCorrectionForm>({ mood: 'NEUTRAL', tags: [], reason: '' });
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [memberGuideVisible, setMemberGuideVisible] = useState(false);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollActiveRef = useRef(false);
  const proactiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeCharacter = useMemo(
    () => characters.find((c) => c.id === activeCharId) ?? characters[0] ?? null,
    [characters, activeCharId],
  );

  // ===================== 轮询 =====================

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollActiveRef.current = false;
  }, []);

  const ensurePolling = useCallback(
    (convId: string) => {
      if (pollActiveRef.current || !convId) return;
      pollActiveRef.current = true;
      let emptyTicks = 0;
      let ticks = 0;
      const MAX_TICKS = 90;
      pollRef.current = setInterval(async () => {
        if (++ticks > MAX_TICKS) {
          stopPolling();
          return;
        }
        try {
          const res = await api.listMessages(convId);
          if (!res.items.length) {
            if (++emptyTicks >= 2) stopPolling();
            return;
          }
          emptyTicks = 0;
          setMessages((prev) => mergeMessages(prev, res.items));
          if (!res.items.some((m) => m.status === 'TYPING')) {
            stopPolling();
          }
        } catch {
          // 网络抖动时忽略，下个周期重试
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ===================== 主动分享见闻 =====================

  const scheduleProactive = useCallback(
    (convId: string | null) => {
      if (mode !== 'SINGLE' || characters.length === 0) return;
      if (proactiveTimerRef.current) clearTimeout(proactiveTimerRef.current);
      proactiveTimerRef.current = setTimeout(() => {
        const charId = characters[0]!.id;
        api
          .triggerProactive(charId)
          .then(() => {
            if (convId) ensurePolling(convId);
          })
          .catch(() => undefined);
      }, PROACTIVE_DELAY_MS);
    },
    [mode, characters, ensurePolling],
  );

  useEffect(
    () => () => {
      if (proactiveTimerRef.current) clearTimeout(proactiveTimerRef.current);
    },
    [],
  );

  // ===================== 初始加载 =====================

  useEffect(() => {
    void api
      .listGifts()
      .then(setGifts)
      .catch(() => setGifts([]));
  }, []);

  useEffect(() => {
    if (!initConvId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [res, memoryView, moodView, insightView] = await Promise.all([
          api.listMessages(initConvId),
          api.getConversationMemory(initConvId).catch(() => null),
          api.getMoodTimeline(initConvId).catch(() => null),
          api.getMoodInsightSummary(initConvId).catch(() => null),
        ]);
        if (mounted) setMessages(res.items);
        if (mounted) setMemory(memoryView);
        if (mounted) setMoodTimeline(moodView);
        if (mounted) setMoodInsight(insightView);
        if (mounted) ensurePolling(initConvId);
        if (mounted) scheduleProactive(initConvId);
      } catch (e) {
        if (mounted) {
          showToast({ title: '加载失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [initConvId, ensurePolling, scheduleProactive, showToast]);

  // 新会话开场白
  useEffect(() => {
    if (greeted || loading || messages.length > 0) return;
    const char = characters[0];
    if (!char) return;
    setGreeted(true);
    setMessages((prev) => [
      ...prev,
      {
        id: genId('msg'),
        conversationId: conversationId ?? 'conv_pending',
        characterId: char.id,
        role: 'ASSISTANT',
        content: char.greeting,
        status: 'COMPLETED',
        type: 'TEXT',
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [greeted, loading, messages.length, characters, conversationId]);

  // 新消息滚动到底部
  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length, giftBurst]);

  // ===================== 发送消息 =====================

  const handleSendError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError) {
        if (e.isQuotaExceeded()) {
          showToast({ title: '今日条数已用完', message: e.message, type: 'error' });
          setMemberGuideVisible(true);
          return;
        }
        if (e.isAntiAddiction()) {
          showToast({ title: '防沉迷提醒', message: e.message, type: 'error' });
          requestAntiAddictionCheck();
          return;
        }
        if (e.isMemberRequired()) {
          setMemberGuideVisible(true);
          return;
        }
      }
      showToast({ title: '发送失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    },
    [showToast, requestAntiAddictionCheck],
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    Keyboard.dismiss();
    setSending(true);
    try {
      if (mode === 'SINGLE') {
        const char = characters[0]!;
        const res = await api.sendMessage({
          conversationId: conversationId ?? undefined,
          characterId: char.id,
          content: text,
        });
        setConversationId(res.conversationId);
        setAffections((prev) => ({ ...prev, [char.id]: res.affection }));
        setMessages((prev) => [...prev, res.userMessage, res.assistantMessage]);
        setMemory(
          res.memory ??
            (await api.getConversationMemory(res.conversationId).catch(() => null)),
        );
        setMoodTimeline(
          res.moodTimeline ??
            (await api.getMoodTimeline(res.conversationId).catch(() => null)),
        );
        setMoodInsight(await api.getMoodInsightSummary(res.conversationId).catch(() => null));
        ensurePolling(res.conversationId);
        scheduleProactive(res.conversationId);
      } else {
        const res = await api.sendMultiMessage({
          conversationId: conversationId ?? undefined,
          characterIds: characters.map((c) => c.id),
          content: text,
        });
        setConversationId(res.conversationId);
        setMessages((prev) => [...prev, res.userMessage, ...res.characters.map((r) => r.assistantMessage)]);
        setAffections((prev) => {
          const next = { ...prev };
          for (const r of res.characters) next[r.characterId] = r.affection;
          return next;
        });
        ensurePolling(res.conversationId);
      }
      setInput('');
      void refreshStatus();
      notifyActivity();
    } catch (e) {
      handleSendError(e);
    } finally {
      setSending(false);
    }
  };

  // ===================== 情绪修正 =====================

  const openCorrection = useCallback((point: MoodSnapshot) => {
    setCorrectionPoint(point);
    setCorrectionForm(createCorrectionForm(point));
  }, []);

  const handleCorrectionSave = useCallback(async () => {
    const convId = conversationId;
    const point = correctionPoint;
    if (!convId || !point || correctionSaving) return;
    setCorrectionSaving(true);
    try {
      const result = await api.correctMoodPoint(convId, point.id, {
        mood: correctionForm.mood,
        tags: correctionForm.tags,
        reason: correctionForm.reason,
        clientMutationId: genId('correction'),
      });
      setMoodTimeline((prev) => prev && prev.conversationId === convId
        ? {
            ...prev,
            points: prev.points.map((item) => (item.id === point.id
              ? applyMoodCorrection(item, result.degraded ? item : result.point)
              : item)),
          }
        : prev);
      const insight = await api.getMoodInsightSummary(convId).catch(() => null);
      if (insight) setMoodInsight(insight);
      const notice = correctionFallbackNotice(result);
      if (notice) showToast({ title: '修正未保存', message: notice, type: 'error' });
      setCorrectionPoint(null);
    } catch (e) {
      showToast({
        title: '修正失败',
        message: e instanceof Error ? e.message : '已保留原情绪值，请稍后重试',
        type: 'error',
      });
    } finally {
      setCorrectionSaving(false);
    }
  }, [conversationId, correctionForm, correctionPoint, correctionSaving, showToast]);

  // ===================== 送礼 =====================

  const handleGiftSend = async (giftId: string, quantity: number) => {
    const char = activeCharacter;
    if (!char) return;
    setGiftSending(true);
    try {
      const res = await api.sendGift(giftId, { characterId: char.id, quantity });
      setAffections((prev) => ({ ...prev, [char.id]: res.affection }));
      const giftMsg: Message = {
        id: genId('msg'),
        conversationId: conversationId ?? 'conv_gift',
        characterId: char.id,
        role: 'ASSISTANT',
        content: res.reply,
        status: 'COMPLETED',
        type: 'GIFT',
        metadata: { giftName: res.gift.name, giftIcon: res.gift.icon ?? '🎁' },
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, giftMsg]);
      setGiftBurst((b) => b + 1);
      setGiftEmoji(res.gift.icon ?? '🎁');
      setGiftLabel(res.gift.name);
      setGiftIntensity(res.animation.intensity === 'high' ? 'high' : 'medium');
      setGiftVisible(false);
      notifyActivity();
    } catch (e) {
      if (e instanceof ApiError && e.isMemberRequired()) {
        setGiftVisible(false);
        setMemberGuideVisible(true);
        return;
      }
      showToast({ title: '送礼失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    } finally {
      setGiftSending(false);
    }
  };

  // ===================== 形象定制 =====================

  const handleCustomizeSave = async (payload: CustomizationPayload) => {
    const char = activeCharacter;
    if (!char) return;
    setCustomizing(true);
    try {
      const res = await api.customizeCharacter(char.id, payload);
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === char.id
            ? {
                ...c,
                name: res.customName ?? c.name,
                avatarUrl: res.avatarUrl ?? c.avatarUrl,
                customized: true,
              }
            : c,
        ),
      );
      setCustomizeVisible(false);
      showToast({ title: '定制成功', message: `${res.customName ?? char.name} 的形象已更新` });
    } catch (e) {
      showToast({ title: '保存失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'error' });
    } finally {
      setCustomizing(false);
    }
  };

  // ===================== 渲染 =====================

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={pop} hitSlop={10} style={styles.headerBack}>
          <Text style={styles.headerBackText}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>心伴AI</Text>
          <Text style={styles.headerSubtitle}>AI 虚拟伴侣 · 在线陪伴</Text>
        </View>
        <Pressable onPress={() => setCustomizeVisible(true)} hitSlop={10} style={styles.headerAction}>
          <Text style={styles.headerActionText}>✎ 定制</Text>
        </Pressable>
      </View>

      {mode === 'MULTI' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.multiRow}>
          {characters.map((char) => {
            const isActive = char.id === activeCharId;
            const aff = affections[char.id];
            return (
              <Pressable key={char.id} onPress={() => setActiveCharId(char.id)} style={[styles.multiChip, isActive && styles.multiChipActive]}>
                <Avatar name={char.name} avatarUrl={char.avatarUrl} size={40} />
                <BreathingDot size={7} />
                <Text style={[styles.multiName, isActive && styles.multiNameActive]} numberOfLines={1}>{char.name}</Text>
                <Text style={styles.multiAff}>{affectionLevelLabel(aff?.level ?? 1)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.singleRow}>
          {activeCharacter ? (
            <>
              <View style={styles.singleAvatar}>
                <Avatar name={activeCharacter.name} avatarUrl={activeCharacter.avatarUrl} size={52} />
                <View style={styles.onlineDot}>
                  <BreathingDot size={8} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.singleName}>{activeCharacter.name}</Text>
                <Text style={styles.singleMeta}>
                  {activeCharacter.title} · {activeCharacter.dialectLabel} · {activeCharacter.occupation}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      )}
    </View>
  );

  const renderAffections = () => {
    if (mode === 'SINGLE' && activeCharacter) {
      const aff = affections[activeCharacter.id];
      if (!aff) return null;
      return (
        <View style={styles.affSection}>
          <HeartbeatBar value={aff.value} level={aff.level} progress={aff.progress} heartbeat={giftBurst} compact />
        </View>
      );
    }
    return (
      <View style={styles.affSectionMulti}>
        {characters.map((char) => {
          const aff = affections[char.id];
          if (!aff) return null;
          return (
            <View key={char.id} style={{ flex: 1 }}>
              <HeartbeatBar value={aff.value} level={aff.level} progress={aff.progress} heartbeat={giftBurst} compact />
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) return <LoadingView text="正在进入对话…" />;

  return (
    <View style={styles.root}>
      {renderHeader()}
      {renderAffections()}
      <View style={styles.noticeWrap}>
        <AINoticeBar compact />
      </View>
      <MemoryPanel value={memory} />
      <MoodTimelinePanel value={moodTimeline} onCorrect={openCorrection} />
      <MoodInsightPanel value={moodInsight} />

      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg) => {
          const companion = characters.find((c) => c.id === msg.characterId);
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              companionName={companion?.name ?? activeCharacter?.name ?? '伴友'}
              companionAvatar={companion?.avatarUrl ?? activeCharacter?.avatarUrl}
            />
          );
        })}
      </ScrollView>

      {/* 输入栏 */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable onPress={() => setGiftVisible(true)} style={styles.giftBtn}>
          <Text style={styles.giftBtnText}>🎁</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={mode === 'SINGLE' ? `和${activeCharacter?.name ?? 'TA'}说点什么…` : '对大家说点什么…'}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <Pressable onPress={handleSend} disabled={!input.trim() || sending} style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}>
          <Text style={styles.sendBtnText}>发送</Text>
        </Pressable>
      </View>

      {/* 送礼浮动动画层 */}
      <GiftFloatLayer burst={giftBurst} emoji={giftEmoji} label={giftLabel} intensity={giftIntensity} />

      {/* 送礼弹层 */}
      <GiftSheet
        visible={giftVisible}
        onClose={() => setGiftVisible(false)}
        gifts={gifts}
        sending={giftSending}
        onSend={handleGiftSend}
        onRequireMember={() => {
          setGiftVisible(false);
          setMemberGuideVisible(true);
        }}
      />

      {/* 定制弹窗 */}
      {activeCharacter ? (
        <CustomizeModal
          visible={customizeVisible}
          onClose={() => setCustomizeVisible(false)}
          character={activeCharacter}
          saving={customizing}
          onSave={handleCustomizeSave}
        />
      ) : null}

      {/* 会员引导 */}
      <MoodCorrectionModal
        point={correctionPoint}
        value={correctionForm}
        saving={correctionSaving}
        onChange={setCorrectionForm}
        onSave={() => { void handleCorrectionSave(); }}
        onClose={() => setCorrectionPoint(null)}
      />
      <AppModal visible={memberGuideVisible} onClose={() => setMemberGuideVisible(false)}>
        <View style={styles.modalBody}>
          <Text style={styles.modalEmoji}>👑</Text>
          <Text style={styles.modalTitle}>会员专属能力</Text>
          <Text style={styles.modalDesc}>
            开通会员解锁专属角色、无限畅聊、专属剧情、限量礼物与形象照片生成。
          </Text>
          <PrimaryButton
            title="去开通会员"
            onPress={() => {
              setMemberGuideVisible(false);
              push('members', { from: 'chat' });
            }}
            style={{ width: '100%' }}
          />
          <Pressable onPress={() => setMemberGuideVisible(false)} style={styles.modalCancel}>
            <Text style={styles.modalCancelText}>再看看</Text>
          </Pressable>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.backgroundDeep,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    color: colors.textOnDark,
    fontSize: 36,
    lineHeight: 38,
    marginTop: -4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textOnDark,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },
  headerSubtitle: {
    color: 'rgba(246, 239, 255, 0.55)',
    fontSize: fontSizes.xs,
    marginTop: 1,
  },
  headerAction: {
    width: 52,
    alignItems: 'flex-end',
  },
  headerActionText: {
    color: colors.goldLight,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  singleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  singleAvatar: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
  },
  singleName: {
    color: colors.textOnDark,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
  },
  singleMeta: {
    color: 'rgba(246, 239, 255, 0.6)',
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  multiRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  multiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(246, 239, 255, 0.08)',
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  multiChipActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(245, 185, 58, 0.16)',
  },
  multiName: {
    color: colors.textOnDark,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    maxWidth: 72,
  },
  multiNameActive: {
    color: colors.goldLight,
  },
  multiAff: {
    color: 'rgba(246, 239, 255, 0.5)',
    fontSize: fontSizes.xs,
  },
  affSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  affSectionMulti: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  noticeWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  giftBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftBtnText: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
  },
  sendBtn: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: colors.textOnPrimary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  modalBody: {
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  modalDesc: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.lg,
    lineHeight: 22,
  },
  modalCancel: {
    marginTop: spacing.md,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
  },
});
