import type {
  PeriodInsightComparisonDegradedReason,
  PeriodInsightComparisonItem,
  PeriodInsightComparisonResult,
  PeriodInsightType,
} from '../types';

/** v0.11 跨周期洞察视图状态：纯函数；第 4 类、坏 direction/rate 或降级原因未知均整体不可信。 */

export type PeriodInsightComparisonViewState =
  | { mode: 'empty'; value: null }
  | { mode: 'degraded'; value: null; reason: PeriodInsightComparisonDegradedReason }
  | { mode: 'ready'; value: PeriodInsightComparisonResult };

const INSIGHT_TYPES: readonly PeriodInsightType[] = [
  'DOMINANT_MOOD',
  'PERIOD_TREND',
  'ANNOTATION_CORRELATION',
];
const DIRECTIONS = ['UP', 'STABLE', 'DOWN'] as const;
const COMPARISON_SOURCE_BY_TYPE: Record<PeriodInsightType, string> = {
  DOMINANT_MOOD: 'moodPeriodInsightComparison.dominant',
  PERIOD_TREND: 'moodPeriodInsightComparison.trend',
  ANNOTATION_CORRELATION: 'moodPeriodInsightComparison.annotation',
};

const EMPTY_REASONS = ['PERIOD_EMPTY', 'METRIC_MISSING', 'ZERO_BASE'] as const;
const DEGRADED_REASONS = ['SOURCE_DEGRADED', 'AGGREGATION_FAILED'] as const;

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPeriodId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidItem(item: PeriodInsightComparisonItem): boolean {
  if (!item || !INSIGHT_TYPES.includes(item.type)) return false;
  if (item.status === 'EMPTY') {
    return item.value === null &&
      item.reason !== null &&
      EMPTY_REASONS.includes(item.reason as (typeof EMPTY_REASONS)[number]) &&
      isPeriodId(item.evidence?.fromPeriodId) &&
      isPeriodId(item.evidence?.toPeriodId) &&
      isInt(item.evidence?.fromSampleSize) &&
      isInt(item.evidence?.toSampleSize) &&
      typeof item.message === 'string' &&
      item.message !== '';
  }
  if (item.status !== 'READY' || item.reason !== null || !item.value) return false;
  const value = item.value as unknown as Record<string, unknown>;
  return DIRECTIONS.includes(value.direction as (typeof DIRECTIONS)[number]) &&
    isFiniteNumber(value.rate) &&
    isPeriodId(value.fromPeriodId) &&
    isPeriodId(value.toPeriodId) &&
    isFiniteNumber(value.fromValue) &&
    isFiniteNumber(value.toValue) &&
    item.evidence?.source === COMPARISON_SOURCE_BY_TYPE[item.type] &&
    typeof item.message === 'string' &&
    item.message !== '';
}

export function periodInsightComparisonViewState(
  value: PeriodInsightComparisonResult | null | undefined,
): PeriodInsightComparisonViewState {
  if (value?.insights?.some((item) => !item || !INSIGHT_TYPES.includes(item.type))) {
    return { mode: 'degraded', value: null, reason: 'SOURCE_DEGRADED' };
  }
  if (!value || !value.available || value.degraded) {
    const reason = DEGRADED_REASONS.includes(value?.degradedReason as (typeof DEGRADED_REASONS)[number])
      ? value?.degradedReason as PeriodInsightComparisonDegradedReason
      : 'SOURCE_DEGRADED';
    return { mode: 'degraded', value: null, reason };
  }
  const valid = Boolean(
    typeof value.conversationId === 'string' &&
      value.conversationId !== '' &&
      isPeriodId(value.targetPeriodId) &&
      value.granularity === 'NATURAL_WEEK' &&
      value.timezone === 'UTC+8' &&
      (value.requestedPeriods === 1 || value.requestedPeriods === 2 || value.requestedPeriods === 3) &&
      value.periodIds.length === value.requestedPeriods &&
      value.periodIds.every(isPeriodId) &&
      Array.isArray(value.periods) &&
      value.periods.length === value.requestedPeriods &&
      value.periods.every((period) => (
        isPeriodId(period.periodId) &&
        typeof period.available === 'boolean' &&
        typeof period.degraded === 'boolean' &&
        typeof period.empty === 'boolean' &&
        Array.isArray(period.insights)
      )) &&
      Array.isArray(value.insights) &&
      value.insights.every(isValidItem),
  );
  if (!valid || value.insights.length === 0) return { mode: 'empty', value: null };
  return { mode: 'ready', value };
}
