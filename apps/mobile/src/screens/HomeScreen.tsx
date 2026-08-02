import React, { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AINoticeBar } from '../components/AINoticeBar';
import { PrimaryButton } from '../components/PrimaryButton';
import { QuotaPill } from '../components/QuotaPill';
import { SegmentedToggle } from '../components/SegmentedToggle';
import { useNavigation } from '../navigation/NavigationContext';
import { useAuth } from '../store/AuthContext';
import { useSession } from '../store/SessionContext';
import { colors, fontSizes, fontWeights, radii, spacing } from '../theme';
import type { ChatMode } from '../types';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { push } = useNavigation();
  const { user, logout } = useAuth();
  const { quota, isMember, membershipDaysLeft, refreshStatus } = useSession();
  const [mode, setMode] = useState<ChatMode>('SINGLE');

  const remaining = quota?.remaining ?? 120;
  const unlimited = quota?.unlimited ?? isMember;

  const start = () => {
    push('characters', { mode });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* 深紫氛围头部 */}
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.brand}>心伴AI</Text>
            <Text style={styles.tagline}>懂你的 AI 情感陪伴</Text>
          </View>
          <Pressable onPress={() => push('members', { from: 'home' })} style={styles.memberEntry}>
            <Text style={styles.memberEntryText}>{isMember ? '👑 会员中心' : '💎 开通会员'}</Text>
          </Pressable>
        </View>

        <View style={styles.quotaWrap}>
          <QuotaPill remaining={remaining} unlimited={unlimited} />
          <Text style={styles.hello}>你好，{user?.nickname ?? '老朋友'} 👋</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionTitle}>选择陪伴模式</Text>
        <SegmentedToggle<ChatMode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'SINGLE', label: '单角色陪伴', icon: '💬' },
            { value: 'MULTI', label: '多角色同台', icon: '👥' },
          ]}
        />
        <Text style={styles.modeHint}>
          {mode === 'SINGLE'
            ? '与一位伴友私密深聊，享受专属的温暖陪伴。'
            : '多位伴友同台，他们会依据性格与你互动、彼此博弈，好感度同步增长。'}
        </Text>

        <PrimaryButton title={mode === 'SINGLE' ? '开始陪伴' : '去选伴友'} onPress={start} style={styles.startBtn} />

        {/* 会员入口卡 */}
        <Pressable style={styles.vipCard} onPress={() => push('members', { from: 'home' })}>
          <Text style={styles.vipEmoji}>👑</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.vipTitle}>{isMember ? '会员有效期剩 ' + membershipDaysLeft + ' 天' : '开通会员 · 解锁全部伴友'}</Text>
            <Text style={styles.vipDesc}>
              {isMember ? '无限畅聊 · 专属角色 · 限量礼物' : '小满、苏雅专属解锁，畅聊不限条数'}
            </Text>
          </View>
          <Text style={styles.vipArrow}>›</Text>
        </Pressable>

        <View style={{ height: spacing.lg }} />
        <AINoticeBar />

        <Pressable onPress={async () => { await logout(); }} style={styles.logout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    backgroundColor: colors.backgroundDeep,
    paddingHorizontal: spacing.xl,
    paddingBottom: 32,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    color: colors.textOnDark,
    fontSize: fontSizes.hero,
    fontWeight: fontWeights.heavy,
    letterSpacing: 1.5,
  },
  tagline: {
    color: 'rgba(246, 239, 255, 0.65)',
    fontSize: fontSizes.md,
    marginTop: 4,
  },
  memberEntry: {
    backgroundColor: colors.goldLight,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  memberEntryText: {
    color: '#8a6200',
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  quotaWrap: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hello: {
    color: 'rgba(246, 239, 255, 0.8)',
    fontSize: fontSizes.md,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modeHint: {
    marginTop: spacing.md,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  startBtn: {
    marginTop: spacing.xxl,
  },
  vipCard: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.goldLight,
    padding: spacing.lg,
    gap: spacing.md,
  },
  vipEmoji: {
    fontSize: 30,
  },
  vipTitle: {
    color: '#6b4c00',
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  vipDesc: {
    color: '#9a7a2f',
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  vipArrow: {
    color: '#9a7a2f',
    fontSize: 28,
  },
  logout: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  logoutText: {
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
  },
});
