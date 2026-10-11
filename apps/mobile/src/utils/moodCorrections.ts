import type { MoodSnapshot } from '../types';

export interface MoodCorrectionForm {
  mood: MoodSnapshot['mood'];
  tags: string[];
  reason: string;
}

const CORRECTION_TAGS = ['状态变化', '记录有误', '原因补充'] as const;

export function correctionTagOptions(): readonly string[] {
  return CORRECTION_TAGS;
}

export function createCorrectionForm(point: Pick<MoodSnapshot, 'mood'>): MoodCorrectionForm {
  return { mood: point.mood, tags: [], reason: '' };
}

export function applyMoodCorrection(
  previous: MoodSnapshot,
  next: MoodSnapshot | null | undefined,
): MoodSnapshot {
  return next ?? previous;
}

export function correctionFallbackNotice(result: { degraded: boolean; persisted: boolean }): string | null {
  return result.degraded || !result.persisted ? '修正暂未保存，已显示原值' : null;
}
