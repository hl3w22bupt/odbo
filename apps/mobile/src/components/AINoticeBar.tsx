import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radii } from '../theme';

interface AINoticeBarProps {
  text?: string;
  compact?: boolean;
}

/** AI 虚拟角色合规提示条 */
export function AINoticeBar({ text, compact = false }: AINoticeBarProps) {
  const content = text ?? '心伴AI 内所有角色均为 AI 虚拟形象，其言行由算法生成，不代表真实人物或观点。';
  return (
    <View style={[styles.bar, compact && styles.barCompact]}>
      <Text style={styles.icon}>🤖</Text>
      <Text style={[styles.text, compact && styles.textCompact]} numberOfLines={compact ? 1 : 3}>
        {content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.violetSoft,
    borderColor: colors.violetLight,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  barCompact: {
    paddingVertical: 5,
  },
  icon: {
    fontSize: 14,
  },
  text: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 18,
  },
  textCompact: {
    fontSize: fontSizes.xs,
  },
});
