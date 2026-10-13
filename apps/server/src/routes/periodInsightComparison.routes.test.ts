import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../lib/auth.js'
import type { HttpHandler, HttpRouteContext } from '../http.js'
import { logger } from '../lib/logger.js'
import { registerPeriodRoutes } from './period.js'

const prismaMock = vi.hoisted(() => ({
  conversation: { findMany: vi.fn() },
  conversationMemory: { findMany: vi.fn() },
  moodSnapshot: { findMany: vi.fn() },
  moodCorrection: { findMany: vi.fn() },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

const authUser = { id: 'user_1', phone: '13800000000', role: 'USER', status: 'ACTIVE' } as AuthUser

function context(periodId = '2026-10-05', query: Record<string, string> = {}): HttpRouteContext {
  return {
    body: {},
    query,
    params: { periodId },
    headers: {},
    method: 'GET',
    path: `/api/v1/periods/${periodId}/insight/comparison`,
    authUser,
  }
}

function handlers(): Map<string, HttpHandler> {
  const map = new Map<string, HttpHandler>()
  registerPeriodRoutes({
    define(name, _path, _method, handler) { map.set(name, handler) },
  } as never)
  return map
}

function row(id: string, conversationId: string, at: string, extra: Record<string, unknown> = {}) {
  return { id, conversationId, userId: 'user_1', createdAt: new Date(at), ...extra }
}

describe('period v0.11 insight comparison route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.conversation.findMany.mockResolvedValue([{ id: 'conv_1' }])
    prismaMock.conversationMemory.findMany.mockResolvedValue([
      row('mem_1', 'conv_1', '2026-09-01T00:00:00.000Z', {
        characterId: null, sourceMessageId: null, content: 'a', status: 'ACTIVE',
      }),
    ])
    prismaMock.moodSnapshot.findMany.mockResolvedValue([
      row('mood_a', 'conv_1', '2026-09-21T01:00:00.000Z', { characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1', mood: 'POSITIVE', score: 1, keywords: '' }),
      row('mood_b', 'conv_1', '2026-09-28T01:00:00.000Z', { characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1', mood: 'NEUTRAL', score: 0, keywords: '' }),
      row('mood_c', 'conv_1', '2026-10-05T01:00:00.000Z', { characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1', mood: 'NEUTRAL', score: 0, keywords: '' }),
    ])
    prismaMock.moodCorrection.findMany.mockResolvedValue([])
  })

  it('exposes the additive route without changing existing route ids', () => {
    const registered: Array<Record<string, string>> = []
    registerPeriodRoutes({
      define(name, path, method) { registered.push({ name, path, method }) },
    } as never)
    expect(registered).toContainEqual({
      name: 'period::insight-comparison',
      path: '/api/v1/periods/:periodId/insight/comparison',
      method: 'GET',
    })
  })

  it('returns three-period value-level comparison for the authenticated user', async () => {
    const res = await handlers().get('period::insight-comparison')!(context())
    expect(res.status_code).toBe(200)
    const data = res.body.data as Record<string, any>
    expect(data).toMatchObject({
      available: true,
      degraded: false,
      degradedReason: null,
      targetPeriodId: '2026-10-05',
      requestedPeriods: 3,
      periodIds: ['2026-09-21', '2026-09-28', '2026-10-05'],
    })
    const trend = data.insights.find((item: any) => item.type === 'PERIOD_TREND')
    expect(trend).toMatchObject({
      status: 'READY',
      reason: null,
      value: {
        direction: 'DOWN',
        rate: -1,
        fromPeriodId: '2026-09-21',
        toPeriodId: '2026-10-05',
        fromValue: 1,
        toValue: 0,
      },
    })
    expect(trend.message).toBe('周期 2026-09-21 vs 2026-10-05：平均分下降趋势 -100%。')
  })

  it('supports legal 1/2 periods and defaults to 3', async () => {
    const one = await handlers().get('period::insight-comparison')!(context('2026-10-05', { periods: '1' }))
    const two = await handlers().get('period::insight-comparison')!(context('2026-10-05', { periods: '2' }))
    expect(one.body.data).toMatchObject({ requestedPeriods: 1, periodIds: ['2026-10-05'] })
    expect(two.body.data).toMatchObject({ requestedPeriods: 2, periodIds: ['2026-09-28', '2026-10-05'] })
  })

  it('rejects over-limit and non-integer periods with the dedicated code', async () => {
    await expect(handlers().get('period::insight-comparison')!(context('2026-10-05', { periods: '4' })))
      .rejects.toMatchObject({ statusCode: 400, code: 'PERIOD_INSIGHT_COUNT_REJECTED' })
    await expect(handlers().get('period::insight-comparison')!(context('2026-10-05', { periods: 'foo' })))
      .rejects.toMatchObject({ statusCode: 400, code: 'PERIOD_INSIGHT_COUNT_REJECTED' })
  })

  it('rejects an invalid target period with the frozen 404 code', async () => {
    await expect(handlers().get('period::insight-comparison')!(context('2026-10-06')))
      .rejects.toMatchObject({ statusCode: 404, code: 'PERIOD_INSIGHT_TARGET_NOT_FOUND' })
  })

  it('returns all-empty 200 when the user has no active conversations', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([])
    const res = await handlers().get('period::insight-comparison')!(context())
    expect(res.status_code).toBe(200)
    expect(res.body.data).toMatchObject({
      available: true,
      degraded: false,
      degradedReason: null,
      insights: [],
      periods: [
        { periodId: '2026-09-21', empty: true },
        { periodId: '2026-09-28', empty: true },
        { periodId: '2026-10-05', empty: true },
      ],
    })
  })

  it('degrades aggregation failures with a closed reason and loud log', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    prismaMock.conversation.findMany.mockRejectedValue(new Error('sqlite locked'))
    const res = await handlers().get('period::insight-comparison')!(context())
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId: 'user_1',
      available: false,
      degraded: true,
      degradedReason: 'AGGREGATION_FAILED',
      granularity: 'NATURAL_WEEK',
      timezone: 'UTC+8',
      targetPeriodId: '2026-10-05',
      requestedPeriods: 3,
      periodIds: ['2026-09-21', '2026-09-28', '2026-10-05'],
      periods: [],
      insights: [],
    })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('insight comparison degraded')
    errorSpy.mockRestore()
  })
})
