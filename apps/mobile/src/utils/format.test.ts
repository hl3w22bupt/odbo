import { describe, expect, it } from 'vitest';
import {
  affectionLevelLabel,
  avatarLetter,
  centsToYuan,
  clockTime,
  formatNumber,
  genId,
  isLateNight,
  isValidCode,
  isValidPhone,
  timeAgo,
} from './format';

describe('isValidPhone', () => {
  it('accepts 11-digit mainland numbers', () => {
    expect(isValidPhone('13800138000')).toBe(true);
  });
  it('rejects invalid formats', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('23800138000')).toBe(false);
    expect(isValidPhone('138001380001')).toBe(false);
  });
});

describe('isValidCode', () => {
  it('accepts 4-6 digit codes', () => {
    expect(isValidCode('1234')).toBe(true);
    expect(isValidCode('123456')).toBe(true);
  });
  it('rejects others', () => {
    expect(isValidCode('123')).toBe(false);
    expect(isValidCode('1234567')).toBe(false);
    expect(isValidCode('abcd')).toBe(false);
  });
});

describe('centsToYuan', () => {
  it('formats cents as yuan', () => {
    expect(centsToYuan(100)).toBe('1.00');
    expect(centsToYuan(24800)).toBe('248.00');
    expect(centsToYuan(5)).toBe('0.05');
  });
});

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});

describe('affectionLevelLabel', () => {
  it('maps known levels', () => {
    expect(affectionLevelLabel(1)).toBe('初识');
    expect(affectionLevelLabel(3)).toBe('亲近');
    expect(affectionLevelLabel(5)).toBe('知己');
  });
  it('falls back to 初识', () => {
    expect(affectionLevelLabel(99)).toBe('初识');
  });
});

describe('timeAgo', () => {
  it('returns 刚刚 for fresh timestamps', () => {
    expect(timeAgo(new Date())).toBe('刚刚');
  });
  it('returns minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60_000);
    expect(timeAgo(d)).toBe('5 分钟前');
  });
});

describe('clockTime', () => {
  it('formats HH:mm', () => {
    const d = new Date(2026, 0, 1, 9, 5);
    expect(clockTime(d)).toBe('09:05');
  });
});

describe('avatarLetter', () => {
  it('returns first character', () => {
    expect(avatarLetter('林晚晴')).toBe('林');
    expect(avatarLetter('')).toBe('伴');
  });
});

describe('isLateNight', () => {
  it('detects the late-night window', () => {
    expect(isLateNight(new Date(2026, 0, 1, 23, 30))).toBe(true);
    expect(isLateNight(new Date(2026, 0, 1, 3, 0))).toBe(true);
    expect(isLateNight(new Date(2026, 0, 1, 12, 0))).toBe(false);
  });
});

describe('genId', () => {
  it('produces prefixed unique ids', () => {
    const a = genId('conv');
    const b = genId('conv');
    expect(a.startsWith('conv_')).toBe(true);
    expect(a).not.toBe(b);
  });
});
