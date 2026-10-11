import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../lib/auth.js'
import type { HttpHandler, HttpRouteContext } from '../http.js'
import { registerChatRoutes } from './chat.js'

const prismaMock = vi.hoisted(() => ({
  conversation: { findFirst: vi.fn() },
  conversationMemory: { findMany: vi.fn() },
  moodSnapshot: { findMany: vi.fn(), findUnique: vi.fn() },
  moodCorrection: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

class ContractRouter {
  readonly routes: Array<{ name: string; method: string; path: string }> = []

  define(name: string, path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', _handler: unknown): void {
    this.routes.push({ name, method, path })
  }
}

function captureHandlers(): Map<string, HttpHandler> {
  const handlers = new Map<string, HttpHandler>()
  registerChatRoutes({
    define(name, _path, _method, handler) {
      handlers.set(name, handler)
    },
  } as never)
  return handlers
}

function readContext(id: string): HttpRouteContext {
  return {
    body: {},
    query: {},
    params: { id },
    headers: {},
    method: 'GET',
    path: `/api/v1/conversations/${id}`,
    authUser: { id: 'user_1', phone: '13800000000', role: 'USER', status: 'ACTIVE' } as AuthUser,
  }
}

describe('chat v0.3 read contracts', () => {
  it('exposes the conversation memory read API', () => {
    const router = new ContractRouter()
    registerChatRoutes(router as never)
    expect(router.routes).toContainEqual({
      name: 'chat::conversation-memory',
      method: 'GET',
      path: '/api/v1/conversations/:id/memory',
    })
  })

  it('exposes the structured mood timeline read API', () => {
    const router = new ContractRouter()
    registerChatRoutes(router as never)
    expect(router.routes).toContainEqual({
      name: 'chat::conversation-mood-timeline',
      method: 'GET',
      path: '/api/v1/conversations/:id/mood-timeline',
    })
  })
})

describe('chat v0.3 read handler behavior', () => {
  const conversationId = 'conv_1'
  let handlers: Map<string, HttpHandler>

  beforeEach(() => {
    handlers = captureHandlers()
    vi.clearAllMocks()
    prismaMock.conversation.findFirst.mockResolvedValue({ id: conversationId, userId: 'user_1' })
  })

  it('serves the explicit empty memory state for a fresh conversation', async () => {
    prismaMock.conversationMemory.findMany.mockResolvedValue([])
    const res = await handlers.get('chat::conversation-memory')!(readContext(conversationId))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId,
      available: true,
      degraded: false,
      items: [],
    })
  })

  it('degrades the memory read to an empty list when storage fails', async () => {
    prismaMock.conversationMemory.findMany.mockRejectedValue(new Error('sqlite locked'))
    const res = await handlers.get('chat::conversation-memory')!(readContext(conversationId))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId,
      available: false,
      degraded: true,
      items: [],
    })
  })

  it('serves the explicit empty mood timeline before the first snapshot', async () => {
    prismaMock.moodSnapshot.findMany.mockResolvedValue([])
    const res = await handlers.get('chat::conversation-mood-timeline')!(readContext(conversationId))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId,
      available: true,
      degraded: false,
      points: [],
    })
  })

  it('degrades the mood timeline read to an empty list when storage fails', async () => {
    prismaMock.moodSnapshot.findMany.mockRejectedValue(new Error('sqlite locked'))
    const res = await handlers.get('chat::conversation-mood-timeline')!(readContext(conversationId))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId,
      available: false,
      degraded: true,
      points: [],
    })
  })
})


describe('chat v0.5 mood correction write side', () => {
  const conversationId = 'conv_1'
  const pointId = 'mood_1'
  let handlers: Map<string, HttpHandler>

  const originalPoint = {
    id: pointId,
    conversationId,
    userId: 'user_1',
    characterId: 'char_1',
    sourceMessageId: 'msg_1',
    memoryId: 'memory_1',
    mood: 'POSITIVE',
    score: 1,
    keywords: '开心',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }

  function writeContext(body: Record<string, unknown>): HttpRouteContext {
    return {
      ...readContext(conversationId),
      body,
      method: 'POST',
      params: { id: conversationId, pointId },
      path: `/api/v1/conversations/${conversationId}/mood-points/${pointId}/correction`,
    }
  }

  beforeEach(() => {
    handlers = captureHandlers()
    vi.clearAllMocks()
    prismaMock.conversation.findFirst.mockResolvedValue({ id: conversationId, userId: 'user_1' })
    prismaMock.moodSnapshot.findUnique.mockResolvedValue(originalPoint)
    prismaMock.moodCorrection.findFirst.mockResolvedValue(null)
    prismaMock.moodCorrection.create.mockReset()
  })

  it('test_correction_latest_wins', async () => {
    prismaMock.moodCorrection.create
      .mockResolvedValueOnce({
        id: 11,
        conversationId,
        userId: 'user_1',
        moodSnapshotId: pointId,
        mood: 'NEUTRAL',
        score: 0,
        tags: '状态变化',
        reason: '当时记错了',
        clientMutationId: 'mutation-1',
        createdAt: new Date('2026-01-01T01:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 12,
        conversationId,
        userId: 'user_1',
        moodSnapshotId: pointId,
        mood: 'NEGATIVE',
        score: -1,
        tags: '',
        reason: '第二天更低落',
        clientMutationId: 'mutation-2',
        createdAt: new Date('2026-01-01T02:00:00.000Z'),
      })

    const first = await handlers.get('chat::mood-point-correction')!(
      writeContext({ mood: 'NEUTRAL', tags: ['状态变化'], reason: '当时记错了', clientMutationId: 'mutation-1' }),
    )
    const second = await handlers.get('chat::mood-point-correction')!(
      writeContext({ mood: 'NEGATIVE', reason: '第二天更低落', clientMutationId: 'mutation-2' }),
    )

    expect(first.status_code).toBe(200)
    expect(first.body.data.persisted).toBe(true)
    expect(second.body.data.point).toMatchObject({ id: pointId, mood: 'NEGATIVE', score: -1, correctionId: 12 })
    expect(second.body.data.point.originalMood).toBe('POSITIVE')
  })

  it('test_edit_nonexistent_returns_defined_error', async () => {
    prismaMock.moodSnapshot.findUnique.mockResolvedValue(null)
    await expect(handlers.get('chat::mood-point-correction')!(
      writeContext({ mood: 'NEUTRAL' }),
    )).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: '情绪记录不存在',
    })
  })

  it('test_correction_write_failure_preserves_old_value', async () => {
    prismaMock.moodCorrection.create.mockRejectedValue(new Error('sqlite locked'))
    const res = await handlers.get('chat::mood-point-correction')!(
      writeContext({ mood: 'NEUTRAL', reason: '修正' }),
    )
    expect(res.status_code).toBe(200)
    expect(res.body.data).toMatchObject({
      persisted: false,
      degraded: true,
      correction: null,
    })
    expect(res.body.data.point).toMatchObject({ id: pointId, mood: 'POSITIVE', score: 1 })
  })

  it('replays one client mutation id without creating another correction', async () => {
    const correction = {
      id: 7,
      conversationId,
      userId: 'user_1',
      moodSnapshotId: pointId,
      mood: 'NEGATIVE',
      score: -1,
      tags: '状态变化',
      reason: '更低落',
      clientMutationId: 'same-id',
      createdAt: new Date('2026-01-01T01:00:00.000Z'),
    }
    prismaMock.moodCorrection.findFirst.mockResolvedValue(correction)
    const res = await handlers.get('chat::mood-point-correction')!(
      writeContext({ mood: 'NEUTRAL', clientMutationId: 'same-id' }),
    )
    expect(prismaMock.moodCorrection.create).not.toHaveBeenCalled()
    expect(res.body.data).toMatchObject({ persisted: true, degraded: false, correction: { id: 7 } })
    expect(res.body.data.point).toMatchObject({ mood: 'NEGATIVE', score: -1 })
  })
})

describe('chat v0.4 insight summary', () => {
  const conversationId = 'conv_1'
  let handlers: Map<string, HttpHandler>

  beforeEach(() => {
    handlers = captureHandlers()
    vi.clearAllMocks()
    prismaMock.conversation.findFirst.mockResolvedValue({ id: conversationId, userId: 'user_1' })
  })

  it('exposes the insight summary read API', () => {
    const router = new ContractRouter()
    registerChatRoutes(router as never)
    expect(router.routes).toContainEqual({
      name: 'chat::conversation-insight-summary',
      method: 'GET',
      path: '/api/v1/conversations/:id/insight-summary',
    })
  })

  it('serves the explicit empty insight summary before any valid point', async () => {
    prismaMock.conversationMemory.findMany.mockResolvedValue([])
    prismaMock.moodSnapshot.findMany.mockResolvedValue([])
    const res = await handlers.get('chat::conversation-insight-summary')!(readContext(conversationId))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId,
      available: true,
      degraded: false,
      summary: null,
    })
  })

  it('degrades the insight summary when storage fails', async () => {
    prismaMock.conversationMemory.findMany.mockRejectedValue(new Error('sqlite locked'))
    prismaMock.moodSnapshot.findMany.mockResolvedValue([])
    const res = await handlers.get('chat::conversation-insight-summary')!(readContext(conversationId))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId,
      available: false,
      degraded: true,
      summary: null,
    })
  })

  it('degrades the insight summary when aggregation cannot safely complete', async () => {
    prismaMock.conversationMemory.findMany.mockResolvedValue([
      {
        id: 'mem_1',
        conversationId,
        characterId: 'char_1',
        sourceMessageId: 'msg_1',
        content: '女儿下周生日',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])
    prismaMock.moodSnapshot.findMany.mockResolvedValue([
      {
        id: 'mood_1',
        conversationId,
        characterId: 'char_1',
        sourceMessageId: 'msg_1',
        memoryId: 'mem_1',
        mood: 'POSITIVE',
        score: 1,
        keywords: '开心',
        createdAt: { toISOString() { throw new Error('invalid persisted timestamp') } } as never,
      },
    ])
    const res = await handlers.get('chat::conversation-insight-summary')!(readContext(conversationId))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId,
      available: false,
      degraded: true,
      summary: null,
    })
  })
})
