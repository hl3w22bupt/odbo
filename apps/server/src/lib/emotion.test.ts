/**
 * 会话情绪伴生态 CRUD 与写失败降级测试
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const emotionDelegate = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
}))

const logger = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('../db.js', () => ({ prisma: { conversationEmotion: emotionDelegate } }))
vi.mock('./logger.js', () => ({ logger }))

import {
  classifyEmotion,
  createEmotion,
  deleteEmotion,
  getEmotion,
  safeUpsertEmotionFromContent,
  updateEmotion,
  upsertEmotion,
} from './emotion.js'

describe('会话情绪 CRUD happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createEmotion 持久化合法情绪', async () => {
    emotionDelegate.create.mockResolvedValue({
      conversationId: 'conv-1',
      emotion: 'POSITIVE',
      score: 0.8,
      version: 1,
      payload: '{"source":"keyword"}',
    })
    await expect(createEmotion('conv-1', {
      emotion: 'POSITIVE',
      score: 0.8,
      payload: { source: 'keyword' },
    })).resolves.toMatchObject({ conversationId: 'conv-1', emotion: 'POSITIVE' })
    expect(emotionDelegate.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        emotion: 'POSITIVE',
        score: 0.8,
        version: 1,
        payload: '{"source":"keyword"}',
      },
    })
  })

  it('getEmotion 丢弃旧/坏 payload 与未知情绪，回退默认', async () => {
    emotionDelegate.findUnique.mockResolvedValue({
      conversationId: 'conv-old',
      emotion: 'UNKNOWN',
      score: Number.NaN,
      version: 0,
      payload: '{broken',
    })
    await expect(getEmotion('conv-old')).resolves.toEqual({
      conversationId: 'conv-old',
      emotion: 'NEUTRAL',
      score: 0,
      version: 1,
      payload: {},
    })
  })

  it('updateEmotion 边界分数被夹紧到 [-1, 1]', async () => {
    emotionDelegate.update.mockResolvedValue({
      conversationId: 'conv-2',
      emotion: 'ANXIOUS',
      score: -1,
      version: 4,
      payload: '{}',
    })
    await expect(updateEmotion('conv-2', { emotion: 'ANXIOUS', score: -9, version: 4 })).resolves.toMatchObject({
      score: -1,
      version: 4,
    })
  })

  it('upsertEmotion 覆盖现有伴生态', async () => {
    emotionDelegate.upsert.mockResolvedValue({
      conversationId: 'conv-3',
      emotion: 'CALM',
      score: 0.3,
      version: 1,
      payload: '{"source":"keyword"}',
    })
    await expect(upsertEmotion('conv-3', classifyEmotion('现在很平静'))).resolves.toMatchObject({
      emotion: 'CALM',
      score: 0.3,
    })
  })

  it('deleteEmotion 删除伴生态', async () => {
    emotionDelegate.delete.mockResolvedValue({})
    await expect(deleteEmotion('conv-4')).resolves.toBe(true)
    expect(emotionDelegate.delete).toHaveBeenCalledWith({ where: { conversationId: 'conv-4' } })
  })
})

describe('写失败降级', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('safeUpsertEmotionFromContent 持久层抛错时返回 false 且不阻断主链路', async () => {
    emotionDelegate.upsert.mockRejectedValue(new Error('no such table: ConversationEmotion'))
    await expect(safeUpsertEmotionFromContent('conv-5', '我今天很开心')).resolves.toBe(false)
    expect(emotionDelegate.upsert).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith('[emotion] 伴生态写入失败，主链路继续', expect.objectContaining({
      conversationId: 'conv-5',
    }))
  })
})
