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

function context(periodId = '2026-10-05', user: AuthUser | undefined = authUser): HttpRouteContext {
  return {
    body: {}, query: {}, params: { periodId }, headers: {}, method: 'GET',
    path: `/api/v1/periods/${periodId}/comparison`,
    ...(user ? { authUser: user } : {}),
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

describe('period v0.9 routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.conversation.findMany.mockResolvedValue([
      { id: 'conv_1' },
      { id: 'conv_2' },
    ])
    prismaMock.conversationMemory.findMany.mockResolvedValue([
      row('mem_1', 'conv_1', '2026-10-05T00:00:00.000Z', { characterId: null, sourceMessageId: null, content: 'a', status: 'ACTIVE' }),
      row('mem_2', 'conv_2', '2026-10-06T00:00:00.000Z', { characterId: null, sourceMessageId: null, content: 'b', status: 'ACTIVE' }),
      row('mem_old', 'conv_1', '2026-09-28T00:00:00.000Z', { characterId: null, sourceMessageId: null, content: 'old', status: 'ACTIVE' }),
    ])
    prismaMock.moodSnapshot.findMany.mockResolvedValue([
      row('mood_c1', 'conv_1', '2026-10-05T01:00:00.000Z', { characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1', mood: 'POSITIVE', score: 1, keywords: '' }),
      row('mood_c2', 'conv_2', '2026-10-06T01:00:00.000Z', { characterId: null, sourceMessageId: 'msg', memoryId: 'mem_2', mood: 'NEGATIVE', score: -1, keywords: '' }),
      row('mood_p1', 'conv_1', '2026-09-28T01:00:00.000Z', { characterId: null, sourceMessageId: 'msg', memoryId: 'mem_old', mood: 'NEGATIVE', score: -1, keywords: '' }),
    ])
    prismaMock.moodCorrection.findMany.mockResolvedValue([])
  })

  it('exposes both additive period API contracts', () => {
    const registered: Array<Record<string, string>> = []
    registerPeriodRoutes({
      define(name, path, method) { registered.push({ name, path, method }) },
    } as never)
    expect(registered).toContainEqual({
      name: 'period::comparison',
      path: '/api/v1/periods/:periodId/comparison',
      method: 'GET',
    })
    expect(registered).toContainEqual({
      name: 'period::csv',
      path: '/api/v1/periods/:periodId/report.csv',
      method: 'GET',
    })
  })

  it('requires authentication', async () => {
    const unauthenticated = { ...context('2026-10-05') } as HttpRouteContext
    delete (unauthenticated as Partial<HttpRouteContext>).authUser
    await expect(handlers().get('period::comparison')!(unauthenticated)).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    })
  })

  it('returns a legal degraded comparison for an unknown period id', async () => {
    const res = await handlers().get('period::comparison')!(context('2026-10-06'))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      available: false,
      degraded: true,
      periodId: '2026-10-06',
      previousPeriodId: '2026-10-06',
      current: {
        periodId: '2026-10-06', from: '', to: '', sampleSize: 0, coverageDays: 0,
        totalDays: 7, averageScore: 0, completeness: 'EMPTY',
      },
      previous: {
        periodId: '2026-10-06', from: '', to: '', sampleSize: 0, coverageDays: 0,
        totalDays: 7, averageScore: 0, completeness: 'EMPTY',
      },
      trend: { currentAverage: 0, previousAverage: 0, deltaScore: 0 },
      completeness: { current: 'EMPTY', previous: 'EMPTY', overall: 'EMPTY' },
      meta: { skippedUnknownPeriodCount: 1, unknownPeriodIds: ['2026-10-06'] },
      warnings: ['UNKNOWN_PERIOD_SKIPPED'],
    })
  })

  it('compares current and previous periods across only the authenticated user conversations', async () => {
    const res = await handlers().get('period::comparison')!(context())
    expect(res.status_code).toBe(200)
    expect(res.body.data).toMatchObject({
      available: true,
      degraded: false,
      periodId: '2026-10-05',
      previousPeriodId: '2026-09-28',
      current: { sampleSize: 2, coverageDays: 2, averageScore: 0, completeness: 'PARTIAL' },
      previous: { sampleSize: 1, coverageDays: 1, averageScore: -1, completeness: 'PARTIAL' },
      trend: { currentAverage: 0, previousAverage: -1, deltaScore: 1 },
      completeness: { current: 'PARTIAL', previous: 'PARTIAL', overall: 'PARTIAL' },
    })
  })

  it('returns a legal all-empty comparison when the user has no conversations', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([])
    const res = await handlers().get('period::comparison')!(context())
    expect(res.status_code).toBe(200)
    expect(res.body.data).toMatchObject({
      available: true,
      degraded: false,
      current: { sampleSize: 0, coverageDays: 0, completeness: 'EMPTY' },
      previous: { sampleSize: 0, coverageDays: 0, completeness: 'EMPTY' },
      completeness: { overall: 'EMPTY' },
    })
  })

  it('degrades comparison without dirty values and logs loudly', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    prismaMock.conversation.findMany.mockRejectedValue(new Error('sqlite locked'))
    const res = await handlers().get('period::comparison')!(context())
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      available: false,
      degraded: true,
      periodId: '2026-10-05',
      previousPeriodId: '2026-09-28',
      current: {
        periodId: '2026-10-05', from: '', to: '', sampleSize: 0, coverageDays: 0,
        totalDays: 7, averageScore: 0, completeness: 'EMPTY',
      },
      previous: {
        periodId: '2026-09-28', from: '', to: '', sampleSize: 0, coverageDays: 0,
        totalDays: 7, averageScore: 0, completeness: 'EMPTY',
      },
      trend: { currentAverage: 0, previousAverage: 0, deltaScore: 0 },
      completeness: { current: 'EMPTY', previous: 'EMPTY', overall: 'EMPTY' },
    })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('comparison degraded')
    errorSpy.mockRestore()
  })

  it('exports raw CSV with the frozen header and no row-count metadata', async () => {
    const res = await handlers().get('period::csv')!(context())
    expect(res.status_code).toBe(200)
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.rawBody).toBeDefined()
    const lines = res.rawBody!.trimEnd().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('period_id,date,available,degraded,from,to,positive,neutral,negative,sample_size,average_score,coverage_days,total_days,completeness')
    expect(lines[1].startsWith('2026-10-05,2026-10-05,true,false,')).toBe(true)
    expect(lines[2].startsWith('2026-10-05,2026-10-06,true,false,')).toBe(true)
    expect(res.rawBody).not.toContain('row_count')
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="xinban-period-2026-10-05.csv"; filename*=UTF-8\'\''
      + encodeURIComponent('心伴周期-2026-10-05.csv'),
    )
  })
})

describe('period v0.10 insight routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.conversation.findMany.mockResolvedValue([{ id: 'conv_1' }])
    prismaMock.conversationMemory.findMany.mockResolvedValue([
      row('mem_1', 'conv_1', '2026-10-05T00:00:00.000Z', { characterId: null, sourceMessageId: null, content: 'a', status: 'ACTIVE' }),
    ])
    prismaMock.moodSnapshot.findMany.mockResolvedValue([
      row('mood_c1', 'conv_1', '2026-10-05T01:00:00.000Z', { characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1', mood: 'POSITIVE', score: 1, keywords: '' }),
      row('mood_c2', 'conv_1', '2026-10-06T01:00:00.000Z', { characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1', mood: 'NEGATIVE', score: -1, keywords: '' }),
    ])
    prismaMock.moodCorrection.findMany.mockResolvedValue([])
  })

  it('registers the additive insight route in the periods family', () => {
    const registered: Array<Record<string, string>> = []
    registerPeriodRoutes({
      define(name, path, method) { registered.push({ name, path, method }) },
    } as never)
    expect(registered).toContainEqual({
      name: 'period::insight',
      path: '/api/v1/periods/:periodId/insight',
      method: 'GET',
    })
  })

  it('requires authentication', async () => {
    const unauthenticated = { ...context('2026-10-05') } as HttpRouteContext
    delete (unauthenticated as Partial<HttpRouteContext>).authUser
    await expect(handlers().get('period::insight')!(unauthenticated)).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    })
  })

  it('returns an additive legal degraded empty state for an unknown insight period', async () => {
    const res = await handlers().get('period::insight')!(context('2026-10-06'))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId: 'user_1',
      available: false,
      degraded: true,
      periodId: '2026-10-06',
      insights: [],
      meta: { skippedUnknownPeriodCount: 1, unknownPeriodIds: ['2026-10-06'] },
      warnings: ['UNKNOWN_PERIOD_SKIPPED'],
    })
  })

  it('emits value-level insights equal to recomputed rule values', async () => {
    const res = await handlers().get('period::insight')!(context())
    expect(res.status_code).toBe(200)
    expect(res.body.data).toMatchObject({ available: true, degraded: false, periodId: '2026-10-05' })
    const insights = res.body.data.insights as Array<Record<string, unknown>>
    expect(insights.map((item) => item.type)).toEqual(['DOMINANT_MOOD', 'PERIOD_TREND'])
    // 独立重算：counts {positive:1, negative:1} 平票 → NEGATIVE；均分 (1-1)/2=0；趋势 split 后 recent<prev → WORSENING
    expect(insights[0]?.value).toEqual({ mood: 'NEGATIVE', count: 1, share: 0.5 })
    expect(insights[1]?.value).toEqual({ trend: 'WORSENING', sampleSize: 2, averageScore: 0, coverageDays: 2 })
    expect(insights[0]?.evidence).toMatchObject({
      periodId: '2026-10-05', from: '2026-10-04T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z', sampleSize: 2,
    })
    expect(typeof insights[0]?.message).toBe('string')
    expect((insights[0]?.message as string).length).toBeGreaterThan(0)
  })

  it('surfaces annotation correlation when corrections apply to in-period samples', async () => {
    prismaMock.moodCorrection.findMany.mockResolvedValue([
      {
        id: 1, conversationId: 'conv_1', userId: 'user_1', moodSnapshotId: 'mood_c1',
        mood: 'NEGATIVE', score: -1, tags: '', reason: '更正', clientMutationId: null,
        createdAt: new Date('2026-10-05T02:00:00.000Z'),
      },
    ])
    const res = await handlers().get('period::insight')!(context())
    const insights = res.body.data.insights as Array<Record<string, unknown>>
    expect(insights.map((item) => item.type)).toEqual(['DOMINANT_MOOD', 'PERIOD_TREND', 'ANNOTATION_CORRELATION'])
    // latest-wins 修正后：mood_c1 变 NEGATIVE，counts {positive:0, negative:2} → 主导 NEGATIVE count 2
    expect(insights[0]?.value).toEqual({ mood: 'NEGATIVE', count: 2, share: 1 })
    expect(insights[2]?.value).toEqual({ correctedSamples: 1, sampleSize: 2 })
  })

  it('returns a legal empty structure when the user has no conversations', async () => {
    prismaMock.conversation.findMany.mockResolvedValue([])
    const res = await handlers().get('period::insight')!(context())
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId: 'user_1', available: true, degraded: false,
      periodId: '2026-10-05', insights: [],
    })
  })

  it('degrades to an empty safe structure and logs loudly on aggregation failure', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    prismaMock.conversation.findMany.mockRejectedValue(new Error('sqlite locked'))
    const res = await handlers().get('period::insight')!(context())
    expect(res.status_code).toBe(200)
    expect(res.body.data).toEqual({
      conversationId: 'user_1', available: false, degraded: true,
      periodId: '2026-10-05', insights: [],
    })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('insight degraded')
    errorSpy.mockRestore()
  })
})
