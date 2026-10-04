import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../lib/auth.js'
import type { HttpHandler, HttpRouteContext } from '../http.js'
import { registerChatRoutes } from './chat.js'

const prismaMock = vi.hoisted(() => ({
  conversation: { findFirst: vi.fn() },
  conversationMemory: { findMany: vi.fn() },
  moodSnapshot: { findMany: vi.fn() },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

class ContractRouter {
  readonly routes: Array<{ name: string; method: string; path: string }> = []

  define(name: string, path: string, method: 'GET' | 'POST', _handler: unknown): void {
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
