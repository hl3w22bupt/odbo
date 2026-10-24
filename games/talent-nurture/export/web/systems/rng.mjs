/**
 * rng —— 可注入种子的伪随机数（mulberry32）。
 * 游戏运行用时间种子；契约测试注入固定种子复现随机路径。
 */

export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [lo, hi] 闭区间整数 */
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** min + variance*rand ±：randInt(min, min+variance) 的语义化别名（训练增益 = 6±3） */
export function gainRoll(rng, base, variance) {
  return randInt(rng, base - variance, base + variance);
}
