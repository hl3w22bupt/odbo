import type {
  PeriodInsightEvidence,
  PeriodInsightItem,
  PeriodInsightResult,
  PeriodInsightType,
} from '../types';

/** v0.10 情绪洞察视图状态：纯函数、确定性；未知第 4 类或 schema 违例 → 整体不可信（empty）。 */

export type PeriodInsightViewState =
  | { mode: 'empty'; value: null }
  | { mode: 'degraded'; value: null }
  | { mode: 'ready'; value: PeriodInsightResult };

const INSIGHT_TYPES: readonly PeriodInsightType[] = [
  'DOMINANT_MOOD',
  'PERIOD_TREND',
  'ANNOTATION_CORRELATION',
];

const MOODS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
const TRENDS = ['IMPROVING', 'STABLE', 'WORSENING'] as const;

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 当前东八区自然周周一（YYYY-MM-DD）；now 注入，禁真实时钟。与服务端冻结口径一致。 */
export function currentPeriodId(now: Date): string {
  const shifted = now.getTime() + CST_OFFSET_MS;
  const dayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  const weekday = new Date(dayStartShifted).getUTCDay(); // 0=Sun..6=Sat
  const mondayShifted = dayStartShifted - ((weekday + 6) % 7) * DAY_MS;
  return new Date(mondayShifted).toISOString().slice(0, 10);
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidEvidence(evidence: PeriodInsightEvidence): boolean {
  return Boolean(
    evidence &&
      typeof evidence === 'object' &&
      /^\d{4}-\d{2}-\d{2}$/.test(evidence.periodId ?? '') &&
      typeof evidence.from === 'string' &&
      !Number.isNaN(Date.parse(evidence.from)) &&
      typeof evidence.to === 'string' &&
      !Number.isNaN(Date.parse(evidence.to)) &&
      isInt(evidence.sampleSize) &&
      evidence.sampleSize >= 0 &&
      typeof evidence.source === 'string' &&
      evidence.source !== '',
  );
}

function isValidInsightValue(item: PeriodInsightItem): boolean {
  const value = item.value as Record<string, unknown>;
  switch (item.type) {
    case 'DOMINANT_MOOD':
      return Boolean(
        MOODS.includes(value.mood as (typeof MOODS)[number]) &&
          isInt(value.count) &&
          value.count >= 0 &&
          isFiniteNumber(value.share) &&
          value.share >= 0 &&
          value.share <= 1,
      );
    case 'PERIOD_TREND':
      return Boolean(
        TRENDS.includes(value.trend as (typeof TRENDS)[number]) &&
          isInt(value.sampleSize) &&
          value.sampleSize >= 0 &&
          isFiniteNumber(value.averageScore) &&
          isInt(value.coverageDays) &&
          value.coverageDays >= 0 &&
          value.coverageDays <= 7,
      );
    case 'ANNOTATION_CORRELATION':
      return Boolean(
        isInt(value.correctedSamples) &&
          value.correctedSamples >= 0 &&
          isInt(value.sampleSize) &&
          value.sampleSize >= 0,
      );
    default:
      return false; // 第 4 类（未知类型）判红
  }
}

function isValidInsight(item: PeriodInsightItem): boolean {
  return Boolean(
    item &&
      typeof item === 'object' &&
      INSIGHT_TYPES.includes(item.type) &&
      item.value &&
      typeof item.value === 'object' &&
      isValidInsightValue(item) &&
      isValidEvidence(item.evidence) &&
      typeof item.message === 'string' &&
      item.message !== '',
  );
}

export function periodInsightViewState(value: PeriodInsightResult | null | undefined): PeriodInsightViewState {
  if (!value || value.degraded || !value.available) return { mode: 'degraded', value: null };
  const valid = Boolean(
    typeof value.conversationId === 'string' &&
      value.conversationId !== '' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.periodId ?? '') &&
      Array.isArray(value.insights) &&
      value.insights.every(isValidInsight),
  );
  if (!valid) return { mode: 'empty', value: null };
  return { mode: 'ready', value };
}
