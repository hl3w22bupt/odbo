/**
 * 角色（人设）提示词单元测试
 */
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildMultiSystemPrompt, CHARACTER_SEEDS } from './characters.js'

const LIN = CHARACTER_SEEDS[0]!

describe('角色常量', () => {
  it('内置 4 位人设', () => {
    expect(CHARACTER_SEEDS.length).toBe(4)
    const names = CHARACTER_SEEDS.map((c) => c.name)
    expect(names).toContain('林晚晴')
    expect(names).toContain('阿秀')
    expect(names).toContain('小满')
    expect(names).toContain('苏雅')
  })

  it('免费角色：林晚晴/阿秀；会员角色：小满/苏雅', () => {
    const free = CHARACTER_SEEDS.filter((c) => c.tier === 'FREE').map((c) => c.name)
    const vip = CHARACTER_SEEDS.filter((c) => c.tier === 'VIP').map((c) => c.name)
    expect(free.sort()).toEqual(['林晚晴', '阿秀'])
    expect(vip.sort()).toEqual(['小满', '苏雅'])
  })

  it('方言覆盖 普通话/川渝话/粤语', () => {
    const dialects = CHARACTER_SEEDS.map((c) => c.dialect)
    expect(dialects).toContain('MANDARIN')
    expect(dialects).toContain('SICHUAN')
    expect(dialects).toContain('CANTONESE')
  })
})

describe('buildSystemPrompt', () => {
  it('包含人设核心与合规约束', () => {
    const prompt = buildSystemPrompt(LIN)
    expect(prompt).toContain('AI 虚拟情感陪伴角色')
    expect(prompt).toContain('你是「林晚晴」')
    expect(prompt).toContain('不是真实人类')
  })

  it('定制名生效', () => {
    const prompt = buildSystemPrompt({ ...LIN, customName: '晚晴' })
    expect(prompt).toContain('你是「晚晴」')
  })
})

describe('buildMultiSystemPrompt', () => {
  it('多角色同台注入他人信息', () => {
    const prompt = buildMultiSystemPrompt(LIN, [
      { name: '阿秀', title: '爽朗直爽', type: 'INCLUSIVE' },
      { name: '小满', title: '俏皮灵动', type: 'POSSESSIVE' },
    ])
    expect(prompt).toContain('同台陪伴')
    expect(prompt).toContain('阿秀')
    expect(prompt).toContain('小满')
  })
})
