/**
 * 内容过滤单元测试（自建敏感词库）
 */
import { describe, it, expect } from 'vitest'
import { filterContent, blockedFallbackReply } from './contentFilter.js'

describe('filterContent', () => {
  it('正常文本通过', async () => {
    const result = await filterContent('今天天气不错，我们去公园走走吧')
    expect(result.passed).toBe(true)
    expect(result.blocked).toBe(false)
    expect(result.filtered).toBe('今天天气不错，我们去公园走走吧')
  })

  it('命中 BLOCK 词阻断', async () => {
    const result = await filterContent('有没有赌博的渠道')
    expect(result.blocked).toBe(true)
    expect(result.passed).toBe(false)
    expect(result.matched).toContain('赌博')
  })

  it('命中 FLAG 词替换', async () => {
    const result = await filterContent('我们加微信聊吧')
    expect(result.blocked).toBe(false)
    expect(result.filtered).not.toContain('微信')
    expect(result.matched).toContain('加微信')
  })

  it('回退文案非空', () => {
    expect(blockedFallbackReply().length).toBeGreaterThan(0)
  })
})
