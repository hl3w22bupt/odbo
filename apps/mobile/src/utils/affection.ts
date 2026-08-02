/**
 * 好感度（Affection）纯逻辑
 * 与后端 affection.ts 的算法保持一致：
 *  - value 累计好感值
 *  - level 由 value 映射（5 级）
 *  - progress 为当前级别内的进度 0-1
 */

export const AFFECTION_LEVEL_STEPS = [0, 50, 150, 350, 700, 1200];

/** 由好感值计算 level 与 progress */
export function computeAffection(value: number): {
  value: number;
  level: number;
  progress: number;
} {
  const clamped = Math.max(0, Math.floor(value));
  let level = 1;
  for (let i = 1; i < AFFECTION_LEVEL_STEPS.length; i++) {
    if (clamped >= AFFECTION_LEVEL_STEPS[i]!) {
      level = i + 1;
    } else {
      break;
    }
  }
  const floor = AFFECTION_LEVEL_STEPS[level - 1] ?? 0;
  const ceil = AFFECTION_LEVEL_STEPS[level] ?? floor + 1;
  const span = Math.max(1, ceil - floor);
  const progress = Math.min(1, Math.max(0, (clamped - floor) / span));
  return { value: clamped, level, progress };
}

/** 增量后重新计算 */
export function applyAffectionDelta(
  current: { value: number; level: number; progress: number },
  delta: number,
): { value: number; level: number; progress: number } {
  return computeAffection((current.value ?? 0) + delta);
}

/** 格式化好感值显示 */
export function formatAffectionValue(value: number): string {
  return String(Math.max(0, Math.floor(value)));
}
