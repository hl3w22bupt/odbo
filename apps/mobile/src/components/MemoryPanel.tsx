import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme';
import { memoryViewState } from '../utils/insights';
import type { MemoryReadResult } from '../types';

interface MemoryPanelProps {
  value: MemoryReadResult | null | undefined;
}

export function MemoryPanel({ value }: MemoryPanelProps) {
  const view = memoryViewState(value);
  const label =
    view.mode === 'degraded'
      ? '记忆暂时不可用，已隐藏可能的旧内容'
      : view.mode === 'empty'
        ? '还没有长期记忆，聊几句我会记住重要的小事'
        : 'TA 记住的';

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{label}</Text>
      {view.mode === 'ready' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.items}>
          {view.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text numberOfLines={2} style={styles.content}>
                {item.content}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginBottom: spacing.xs,
  },
  items: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  item: {
    maxWidth: 260,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
});
