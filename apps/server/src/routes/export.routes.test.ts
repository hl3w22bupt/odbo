import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../lib/auth.js'
import type { HttpHandler, HttpRouteContext } from '../http.js'
import { registerExportRoutes } from './export.js'

const prismaMock = vi.hoisted(() => ({
  conversation: { findMany: vi.fn() },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

function context(): HttpRouteContext {
  return {
    body: {}, query: {}, params: {}, headers: {}, method: 'GET', path: '/api/v1/export',
    authUser: { id: 'user_1', phone: '13800000000', role: 'USER', status: 'ACTIVE' } as AuthUser,
  }
}

function handlers(): Map<string, HttpHandler> {
  const map = new Map<string, HttpHandler>()
  registerExportRoutes({ define(name, _path, _method, handler) { map.set(name, handler) } } as never)
  return map
}

describe('export route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('test_export_empty_db_returns_valid_empty', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([])
    const res = await handlers().get('user-data::export')!(context())
    expect(res.status_code).toBe(200)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res.body.code).toBe('OK')
    expect(res.body.data).toMatchObject({ schemaVersion: 1, format: 'xinban-json', conversations: [] })
  })

  it('serializes the frozen export schema and redacts credential tables', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([])
    const res = await handlers().get('user-data::export')!(context())
    expect(Object.keys(res.body.data).sort()).toEqual(['conversations', 'exportedAt', 'format', 'schemaVersion'])
    expect(JSON.stringify(res.body.data)).not.toContain('refreshToken')
    expect(JSON.stringify(res.body.data)).not.toContain('accessToken')
  })
})
