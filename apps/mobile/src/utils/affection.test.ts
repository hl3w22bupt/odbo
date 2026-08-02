import { describe, expect, it } from 'vitest';
import { AFFECTION_LEVEL_STEPS, applyAffectionDelta, computeAffection, formatAffectionValue } from './affection';

describe('computeAffection', () => {
  it('maps 0 to level 1 with 0 progress', () => {
    const r = computeAffection(0);
    expect(r).toEqual({ value: 0, level: 1, progress: 0 });
  });

  it('maps boundary values to the next level', () => {
    expect(computeAffection(50).level).toBe(2);
    expect(computeAffection(150).level).toBe(3);
    expect(computeAffection(350).level).toBe(4);
    expect(computeAffection(700).level).toBe(5);
    expect(computeAffection(1200).level).toBe(6);
  });

  it('progress is between 0 and 1 within a level', () => {
    const r = computeAffection(100);
    expect(r.level).toBe(2);
    expect(r.progress).toBeGreaterThan(0);
    expect(r.progress).toBeLessThan(1);
  });

  it('clamps negative values to 0', () => {
    const r = computeAffection(-10);
    expect(r.value).toBe(0);
    expect(r.level).toBe(1);
  });

  it('monotonic steps are ascending', () => {
    for (let i = 1; i < AFFECTION_LEVEL_STEPS.length; i++) {
      expect(AFFECTION_LEVEL_STEPS[i]!).toBeGreaterThan(AFFECTION_LEVEL_STEPS[i - 1]!);
    }
  });
});

describe('applyAffectionDelta', () => {
  it('increments value and recomputes level', () => {
    const r = applyAffectionDelta({ value: 40, level: 1, progress: 0.8 }, 20);
    expect(r.value).toBe(60);
    expect(r.level).toBe(2);
  });
});

describe('formatAffectionValue', () => {
  it('floors and non-negative', () => {
    expect(formatAffectionValue(12.9)).toBe('12');
    expect(formatAffectionValue(-3)).toBe('0');
  });
});
