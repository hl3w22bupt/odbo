import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radii, spacing } from '../theme';
import { periodInsightViewState } from '../utils/moodPeriodInsight';
import type { PeriodInsightResult, PeriodInsightType } from '../types';

/**
 * v0.10 本周期情绪洞察 · 只读展示（非图表）。
 * 三态契约：degraded（不可用）/ ready+空（暂无洞察）/ ready（逐条洞察文案）。
 */
const INSIGHT_TYPE_LABELS: Record<PeriodInsightType, string> = {
  DOMINANT_MOOD: '主导情绪',
  PERIOD_TREND: '趋势要点',
  ANNOTATION_CORRELATION: '标注关联',
};

interface MoodPeriodInsightPanelProps {
  value: PeriodInsightResult | null | undefined;
}

export function MoodPeriodInsightPanel({ value }: MoodPeriodInsightPanelProps) {
  const view = periodInsightViewState(value);
  const insights = view.mode === 'ready' ? view.value.insights : null;

  const body =
    view.mode === 'degraded'
      ? '情绪洞察暂不可用，请稍后重试。'
      : !insights || insights.length === 0
        ? '本周期还没有足够的情绪记录，暂无洞察。'
        : null;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>本周期情绪洞察</Text>
      <View style={styles.card}>
        {body || !insights ? (
          <Text style={styles.hint}>{body}</Text>
        ) : (
          insights.map((item) => (
            <View key={item.type} style={styles.row}>
              <Text style={styles.badge}>{INSIGHT_TYPE_LABELS[item.type]}</Text>
              <Text style={styles.message}>{item.message}</Text>
            </View>
          ))
        )}
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  badge: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  message: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
});
