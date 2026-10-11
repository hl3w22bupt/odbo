import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme';
import { moodWeeklyReportViewState, weeklyTrendLabel } from '../utils/weeklyReport';
import type { MoodWeeklyReportResult } from '../types';

interface MoodWeeklyReportPanelProps {
  value: MoodWeeklyReportResult | null | undefined;
}

export function MoodWeeklyReportPanel({ value }: MoodWeeklyReportPanelProps) {
  const view = moodWeeklyReportViewState(value);
  const title =
    view.mode === 'degraded'
      ? '近7日情绪报告暂不可用'
      : view.mode === 'empty'
        ? '近7日还没有足够的情绪记录'
        : '近7日情绪报告';
  const body =
    view.mode === 'degraded'
      ? '数据已安全隐藏，请稍后重试。'
      : view.mode === 'empty'
        ? '完成至少两条心情记录后，这里会给出趋势和一句解释。'
        : view.report.reason;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      {view.mode === 'ready' ? (
        <View style={styles.card}>
          <View style={styles.headlineRow}>
            <Text style={styles.headline}>{view.report.headline}</Text>
            <Text style={styles.trend}>{weeklyTrendLabel(view.report.trend)}</Text>
          </View>
          <Text style={styles.reason}>{body}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.reason}>{body}</Text>
        </View>
      )}
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
});
