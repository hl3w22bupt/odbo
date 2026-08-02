import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, fontWeights, spacing } from '../theme';

import { AppModal } from './AppModal';
import { PrimaryButton } from './PrimaryButton';

interface AntiAddictionModalProps {
  visible: boolean;
  onClose: () => void;
  /** 阻断原因（深夜时段 / 连续使用超限等） */
  reason?: string | null;
  message?: string | null;
}

/**
 * 防沉迷弹窗
 * 深夜时段或连续使用超限时展示，提示用户合理安排时间。
 */
export function AntiAddictionModal({ visible, onClose, reason, message }: AntiAddictionModalProps) {
  const title = reason === 'LATE_NIGHT' || reason === 'LATE_NIGHT_BLOCK' ? '夜深了，早点休息' : '已使用较长时间';
  const desc = message ?? '为了你的健康，请适当休息，合理安排使用时间。';

  return (
    <AppModal visible={visible} onClose={onClose} dismissable={false}>
      <View style={styles.body}>
        <Text style={styles.emoji}>🌙</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{desc}</Text>
        <PrimaryButton title="我知道了" onPress={onClose} style={{ width: '100%' }} />
        <Pressable onPress={onClose} hitSlop={10} style={styles.hintWrap}>
          <Text style={styles.hint}>心伴AI · 防沉迷提醒</Text>
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 46,
    marginBottom: 8,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  desc: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginVertical: spacing.lg,
  },
  hintWrap: {
    marginTop: 14,
    paddingVertical: 6,
  },
  hint: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
  },
});
