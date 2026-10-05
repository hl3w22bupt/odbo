import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme';
import { moodInsightViewState } from '../utils/insights';
import type { MoodInsightSummaryResult } from '../types';

interface MoodInsightPanelProps {
  value: MoodInsightSummaryResult | null | undefined;
}

const TREND_LABEL: Record<'IMPROVING' | 'STABLE' | 'WORSENING', string> = {
  IMPROVING: '好转',
  STABLE: '平稳',
  WORSENING: '需要关注',
};

export function MoodInsightPanel({ value }: MoodInsightPanelProps) {
  const view = moodInsightViewState(value);
  const title =
    view.mode === 'degraded'
      ? '情绪洞察暂不可用'
      : view.mode === 'empty'
        ? '再多聊几句，就能看到情绪趋势'
        : '情绪洞察';

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      {view.mode === 'ready' ? (
        <View style={styles.card}>
          <View style={styles.headlineRow}>
            <Text style={styles.headline}>{view.summary.headline}</Text>
            <Text style={styles.trend}>{TREND_LABEL[view.summary.trend]}</Text>
          </View>
          <Text style={styles.reason}>{view.summary.reason}</Text>
          {view.summary.keywords.length > 0 ? (
            <Text style={styles.keywords} numberOfLines={1}>
              关键词：{view.summary.keywords.join(' · ')}
            </Text>
          ) : null}
        </View>
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headline: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  trend: {
    color: colors.primary,
    fontSize: fontSizes.xs,
  },
  reason: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  keywords: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
  },
});
