/**
 * 好感度系统单元测试
 */
import { describe, it, expect } from 'vitest'
import { computeAffectionInfo, AFFECTION_LEVEL_STEPS } from './affection.js'

describe('computeAffectionInfo', () => {
  it('初始好感度为 1 级', () => {
    const info = computeAffectionInfo(0)
    expect(info.level).toBe(1)
    expect(info.value).toBe(0)
    expect(info.progress).toBe(0)
  })

  it('好感度达到阈值升级', () => {
    const info = computeAffectionInfo(AFFECTION_LEVEL_STEPS)
    expect(info.level).toBe(2)
    expect(info.progress).toBe(0)
  })

  it('进度条在级内递增', () => {
    const info = computeAffectionInfo(50)
    expect(info.level).toBe(1)
    expect(info.progress).toBeCloseTo(0.5)
  })

  it('nextLevelAt 正确', () => {
    const info = computeAffectionInfo(250)
    expect(info.nextLevelAt).toBe(300)
  })
})
