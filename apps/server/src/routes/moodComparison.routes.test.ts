import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../lib/auth.js'
import type { HttpHandler, HttpRouteContext } from '../http.js'
import {
  __resetMoodComparisonSourceForTests,
  __setMoodComparisonSourceForTests,
  encodeCsvCell,
  registerMoodComparisonRoutes,
} from './moodComparison.js'

const prismaMock = vi.hoisted(() => ({
  conversation: { findFirst: vi.fn() },
  conversationMemory: { findMany: vi.fn() },
  moodSnapshot: { findMany: vi.fn() },
  moodCorrection: { findMany: vi.fn() },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

const NOW = new Date('2026-10-07T02:00:00.000Z')
const DAY = 86_400_000
const conversationId = 'conv_1'

function memoryRow(id: string, createdAt: Date) {
  return {
    id,
    conversationId,
    characterId: 'char_1',
    sourceMessageId: `msg_${id}`,
    content: '女儿下周生日',
    status: 'ACTIVE',
    createdAt,
  }
}

function moodRow(id: string, score: -1 | 0 | 1, createdAt: Date) {
  const mood = score > 0 ? 'POSITIVE' : score < 0 ? 'NEGATIVE' : 'NEUTRAL'
  return {
    id,
    conversationId,
    characterId: 'char_1',
    sourceMessageId: `msg_${id}`,
    memoryId: 'mem_1',
    mood,
    score,
    keywords: '',
    createdAt,
  }
}

function twoCycleRows() {
  return {
    memoryRows: [memoryRow('mem_1', new Date(Date.parse('2025-12-30T00:00:00Z')))],
    moodRows: [
      moodRow('old', 0, new Date(Date.parse('2025-12-30T00:00:00Z'))),
      moodRow('previous', -1, new Date(NOW.getTime() - 8 * DAY)),
      moodRow('current', 1, new Date(NOW.getTime() - DAY)),
    ],
    correctionRows: [],
  }
}

function mockSource(rows = twoCycleRows()) {
  prismaMock.conversation.findFirst.mockResolvedValue({ id: conversationId, userId: 'user_1' })
  prismaMock.conversationMemory.findMany.mockResolvedValue(rows.memoryRows)
  prismaMock.moodSnapshot.findMany.mockResolvedValue(rows.moodRows)
  prismaMock.moodCorrection.findMany.mockResolvedValue(rows.correctionRows)
}

function context(id = conversationId, query: Record<string, string> = {}): HttpRouteContext {
  return {
    body: {},
    query,
    params: { id },
    headers: {},
    method: 'GET',
    path: `/api/v1/conversations/${id}/mood-period-comparison`,
    authUser: { id: 'user_1', phone: '13800000000', role: 'USER', status: 'ACTIVE' } as AuthUser,
  }
}

function captureHandlers(): Map<string, HttpHandler> {
  const handlers = new Map<string, HttpHandler>()
  registerMoodComparisonRoutes({
    define(name, _path, _method, handler) {
      handlers.set(name, handler)
    },
  } as never)
  return handlers
}

function csvRows(body: string): string[][] {
  return body
    .replace(/^\ufeff/, '')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.replace(/^"(.*)"$/s, '$1').replace(/""/g, '"')))
}

describe('mood period comparison and CSV export', () => {
  let handlers: Map<string, HttpHandler>

  beforeEach(() => {
    handlers = captureHandlers()
    vi.useFakeTimers({ now: NOW })
    vi.clearAllMocks()
  })

  afterEach(() => {
    __resetMoodComparisonSourceForTests()
    vi.useRealTimers()
  })

  it('exposes the frozen comparison and CSV routes', () => {
    const routes: Array<{ name: string; method: string; path: string }> = []
    registerMoodComparisonRoutes({
      define(name, path, method) {
        routes.push({ name, method, path })
      },
    } as never)
    expect(routes).toContainEqual({
      name: 'chat::conversation-period-comparison',
      method: 'GET',
      path: '/api/v1/conversations/:id/mood-period-comparison',
    })
    expect(routes).toContainEqual({
      name: 'chat::conversation-period-comparison-csv',
      method: 'GET',
      path: '/api/v1/conversations/:id/mood-period-comparison/export.csv',
    })
  })

  it('rejects a period count above the frozen N=3 limit', async () => {
    mockSource()
    await expect(handlers.get('chat::conversation-period-comparison')!(context(conversationId, { periods: '4' })))
      .rejects.toMatchObject({ code: 'PERIOD_COUNT_REJECTED', statusCode: 400 })
  })

  it('aggregates two known cycles and recalculates adjacent trends', async () => {
    mockSource()
    const res = await handlers.get('chat::conversation-period-comparison')!(context(conversationId, { periods: '2' }))
    expect(res.status_code).toBe(200)
    const data = res.body.data as any
    expect(data).toMatchObject({
      conversationId,
      available: true,
      degraded: false,
      granularity: 'NATURAL_WEEK',
      requestedPeriods: 2,
      failedPeriodIds: [],
    })
    expect(data.periods.map((period: any) => period.id)).toEqual(['2026-09-28', '2026-10-05'])
    expect(data.periods[0]).toMatchObject({
      empty: false,
      aggregateValues: { count: 1, positive: 0, neutral: 0, negative: 1, averageScore: -1 },
      completeness: { expectedPoints: 5, actualPoints: 5, ratio: 1, status: 'COMPLETE' },
    })
    expect(data.periods[1]).toMatchObject({
      empty: false,
      aggregateValues: { count: 1, positive: 1, neutral: 0, negative: 0, averageScore: 1 },
      completeness: { expectedPoints: 5, actualPoints: 5, ratio: 1, status: 'COMPLETE' },
    })
    expect(data.completeness).toEqual({
      expectedPoints: 10,
      actualPoints: 10,
      ratio: 1,
      status: 'COMPLETE',
    })
    const rate = (dimension: string) =>
      data.trendPairs.find((pair: any) => pair.dimension === dimension)
    expect(rate('count')).toMatchObject({ previousValue: 1, nextValue: 1, rate: 0, direction: 'STABLE', empty: false })
    expect(rate('negative')).toMatchObject({ previousValue: 1, nextValue: 0, rate: -1, direction: 'DOWN', empty: false })
    expect(rate('averageScore')).toMatchObject({ previousValue: -1, nextValue: 1, rate: -2, direction: 'DOWN', empty: false })
    expect(rate('positive')).toMatchObject({ previousValue: 0, nextValue: 1, rate: null, direction: null, empty: true })
    expect(data.overallTrends).toEqual([
      { dimension: 'count', rate: 0, direction: 'STABLE', empty: false },
      { dimension: 'positive', rate: null, direction: null, empty: true },
      { dimension: 'neutral', rate: null, direction: null, empty: true },
      { dimension: 'negative', rate: -1, direction: 'DOWN', empty: false },
      { dimension: 'averageScore', rate: -2, direction: 'DOWN', empty: false },
    ])
  })

  it('pads only missing source cycles and keeps one requested cycle exact', async () => {
    mockSource({ memoryRows: [], moodRows: [], correctionRows: [] })
    for (const periods of [1, 2, 3]) {
      const res = await handlers.get('chat::conversation-period-comparison')!(context(conversationId, { periods: String(periods) }))
      const data = res.body.data as any
      expect(data.periods).toHaveLength(periods)
      expect(data.periods.every((period: any) => period.empty && period.aggregateValues.count === null)).toBe(true)
      expect(data.completeness.status).toBe('EMPTY')
    }
    const one = (await handlers.get('chat::conversation-period-comparison')!(context(conversationId, { periods: '1' }))).body.data as any
    expect(one.periods[0].id).toBe('2026-10-05')
    expect(one.trendPairs).toEqual([])
  })

  it('distinguishes one empty period from overall partial completeness', async () => {
    const rows = twoCycleRows()
    mockSource({
      memoryRows: rows.memoryRows,
      moodRows: rows.moodRows.filter((row) => row.id === 'current'),
      correctionRows: [],
    })
    const res = await handlers.get('chat::conversation-period-comparison')!(context(conversationId, { periods: '2' }))
    const data = res.body.data as any
    expect(data.periods[0]).toMatchObject({
      empty: true,
      aggregateValues: {
        count: null,
        positive: null,
        neutral: null,
        negative: null,
        averageScore: null,
      },
      completeness: { expectedPoints: 5, actualPoints: 0, ratio: 0, status: 'EMPTY' },
    })
    expect(data.periods[1].completeness).toEqual({
      expectedPoints: 5,
      actualPoints: 5,
      ratio: 1,
      status: 'COMPLETE',
    })
    expect(data.completeness).toEqual({
      expectedPoints: 10,
      actualPoints: 5,
      ratio: 0.5,
      status: 'PARTIAL',
    })
  })

  it('aligns weekly boundaries across a Gregorian year boundary', async () => {
    vi.setSystemTime(new Date('2026-01-06T02:00:00.000Z'))
    mockSource({ memoryRows: [], moodRows: [], correctionRows: [] })
    const res = await handlers.get('chat::conversation-period-comparison')!(context(conversationId, { periods: '2' }))
    const data = res.body.data as any
    expect(data.periods.map((period: any) => [period.id, period.from, period.to])).toEqual([
      ['2025-12-29', '2025-12-28T16:00:00.000Z', '2026-01-04T16:00:00.000Z'],
      ['2026-01-05', '2026-01-04T16:00:00.000Z', '2026-01-11T16:00:00.000Z'],
    ])
  })

  it('exports a non-empty parseable CSV whose data-row count matches five enabled dimensions', async () => {
    mockSource()
    const res = await handlers.get('chat::conversation-period-comparison-csv')!(context(conversationId, { periods: '2' }))
    expect(res.status_code).toBe(200)
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="xinban-period-2026-10-05.csv"; filename*=UTF-8\'\''
      + encodeURIComponent('心伴周期-2026-10-05.csv'),
    )
    expect(res.headers['x-report-row-count']).toBe('10')
    expect(res.headers['x-report-empty']).toBe('false')
    expect(res.headers['x-report-degraded']).toBe('false')
    expect(typeof res.headers['x-report-generated-at']).toBe('string')
    expect(res.headers['x-report-generated-at']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    const rows = csvRows(String(res.body.data))
    expect(rows[0]).toEqual(['period_id', 'date', 'dimension', 'value'])
    expect(rows).toHaveLength(11)
    expect(rows.slice(1, 6)).toEqual([
      ['2026-09-28', '2026-09-28', 'count', '1'],
      ['2026-09-28', '2026-09-28', 'positive', '0'],
      ['2026-09-28', '2026-09-28', 'neutral', '0'],
      ['2026-09-28', '2026-09-28', 'negative', '1'],
      ['2026-09-28', '2026-09-28', 'averageScore', '-1'],
    ])
    expect(rows[10]).toEqual(['2026-10-05', '2026-10-05', 'averageScore', '1'])
  })

  it('escapes RFC 4180 control characters in CSV cells', () => {
    expect(encodeCsvCell('x,"y"\nz')).toBe('"x,""y""\nz"')
  })

  it('returns the comparison JSON degraded state after an injected source failure retries once', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: conversationId, userId: 'user_1' })
    __setMoodComparisonSourceForTests(() => Promise.reject(new Error('sqlite locked')))
    const res = await handlers.get('chat::conversation-period-comparison')!(context(conversationId, { periods: '2' }))
    expect(res.status_code).toBe(200)
    expect(res.body.data).toMatchObject({
      conversationId,
      available: false,
      degraded: true,
      requestedPeriods: 2,
      periods: [],
      completeness: { expectedPoints: 10, actualPoints: 0, status: 'EMPTY' },
    })
  })

  it('returns a machine-readable no-file signal for empty source data', async () => {
    mockSource({ memoryRows: [], moodRows: [], correctionRows: [] })
    const res = await handlers.get('chat::conversation-period-comparison-csv')!(context(conversationId))
    expect(res.status_code).toBe(204)
    expect(res.body.data).toBeNull()
    expect(res.headers).toMatchObject({
      'x-report-empty': 'true',
      'x-report-available': 'true',
      'x-report-degraded': 'false',
      'x-report-partial': 'false',
    })
  })

  it('retries an injected source failure once and returns a JSON degraded signal without a file', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: conversationId, userId: 'user_1' })
    __setMoodComparisonSourceForTests(() => Promise.reject(new Error('sqlite locked')))
    const errorSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const res = await handlers.get('chat::conversation-period-comparison-csv')!(context(conversationId))
    expect(res.status_code).toBe(200)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res.headers).toMatchObject({
      'x-report-available': 'false',
      'x-report-degraded': 'true',
      'x-report-partial': 'false',
      'x-report-empty': 'false',
    })
    expect(res.body.data).toEqual({
      available: false,
      degraded: true,
      attempts: 2,
      partial: false,
    })
    errorSpy.mockRestore()
  })

  it('returns a usable CSV with degraded and partial signals when one cycle source fails', async () => {
    const rows = twoCycleRows()
    prismaMock.conversation.findFirst.mockResolvedValue({ id: conversationId, userId: 'user_1' })
    __setMoodComparisonSourceForTests(() => Promise.resolve({ ...rows, failedPeriodIndexes: [0] }))
    const res = await handlers.get('chat::conversation-period-comparison-csv')!(context(conversationId, { periods: '2' }))
    expect(res.status_code).toBe(200)
    expect(res.headers).toMatchObject({
      'x-report-row-count': '5',
      'x-report-available': 'true',
      'x-report-degraded': 'true',
      'x-report-partial': 'true',
    })
    const rowsParsed = csvRows(String(res.body.data))
    expect(rowsParsed).toHaveLength(6)
    expect(rowsParsed.slice(1).every((row) => row[0] === '2026-10-05')).toBe(true)
  })

  it('rejects oversized source data with the frozen limit', async () => {
    mockSource({
      memoryRows: [memoryRow('mem_1', new Date(NOW.getTime() - DAY))],
      moodRows: Array.from({ length: 1001 }, (_, index) => moodRow(`mood_${index}`, 1, new Date(NOW.getTime() - DAY))),
      correctionRows: [],
    })
    await expect(handlers.get('chat::conversation-period-comparison-csv')!(context(conversationId)))
      .rejects.toMatchObject({ code: 'CSV_EXPORT_TOO_LARGE', statusCode: 413, message: expect.stringContaining('limit=1000') })
  })

  it('pulls one row beyond the frozen limit so the 413 guard is reachable in production', async () => {
    mockSource()
    await handlers.get('chat::conversation-period-comparison-csv')!(context(conversationId))
    const call = prismaMock.moodSnapshot.findMany.mock.calls[0][0] as { take?: number }
    expect(call.take).toBe(1001)
  })
})
