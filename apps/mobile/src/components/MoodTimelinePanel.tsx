import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme';
import { moodViewState } from '../utils/insights';
import type { MoodTimelineResult } from '../types';

interface MoodTimelinePanelProps {
  value: MoodTimelineResult | null | undefined;
}

const MOOD_META: Record<'POSITIVE' | 'NEUTRAL' | 'NEGATIVE', { icon: string; label: string }> = {
  POSITIVE: { icon: '😊', label: '积极' },
  NEUTRAL: { icon: '😐', label: '平稳' },
  NEGATIVE: { icon: '😞', label: '低落' },
};

export function MoodTimelinePanel({ value }: MoodTimelinePanelProps) {
  const view = moodViewState(value);
  const label =
    view.mode === 'degraded'
      ? '情绪轨迹暂不可用'
      : view.mode === 'empty'
        ? '还没有情绪快照，从一句今天的心情开始'
        : '情绪轨迹';

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{label}</Text>
      {view.mode === 'ready' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.points}>
          {view.points.map((point) => {
            const meta = MOOD_META[point.mood];
            return (
              <View key={point.id} style={styles.point}>
                <Text style={styles.icon}>{meta.icon}</Text>
                <Text style={styles.caption}>{meta.label}</Text>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  title: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginBottom: spacing.xs,
  },
  points: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  point: {
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  icon: { fontSize: 20 },
  caption: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
  },
});
