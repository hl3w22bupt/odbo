import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { HttpHandler, HttpRouteContext } from '../http.js'
import { CSV_HEADER } from '../lib/csvExport.js'

const runDir = await mkdtemp(join(tmpdir(), 'xinban-v012-period-import.'))
const databaseUrl = `file:${join(runDir, 'import.db')}`
type PrismaClientType = import('../generated/prisma/client.js').PrismaClient
let prisma: PrismaClientType
let comparisonModule: typeof import('./moodComparison.js')
let importHandler: HttpHandler
let exportHandler: HttpHandler
let periodCsvHandler: HttpHandler
let periodInsightHandler: HttpHandler
const authUser = { id: 'user_period_import', phone: '13800012000', role: 'USER', status: 'ACTIVE' } as const
const CURRENT_PERIOD = '2026-10-12'
const NEW_PERIOD = '2026-09-28'

function csv(rows: string[]): string {
  return `\ufeff${[CSV_HEADER.join(','), ...rows].join('\r\n')}\r\n`
}

function sourceRows(period = CURRENT_PERIOD): string[] {
  return [
    `${period},${period},count,2`,
    `${period},${period},positive,1`,
    `${period},${period},neutral,0`,
    `${period},${period},negative,1`,
    `${period},${period},averageScore,0`,
  ]
}

function importContext(conversationId: string, body: string | Buffer): HttpRouteContext {
  return {
    body: Buffer.isBuffer(body) ? {} : { csv: body },
    rawBody: Buffer.isBuffer(body) ? body : undefined,
    query: {},
    params: { id: conversationId },
    headers: { 'content-type': 'text/csv' },
    method: 'POST',
    path: `/api/v1/conversations/${conversationId}/mood-period-comparison/import.csv`,
    authUser: authUser as never,
  }
}

function exportContext(conversationId: string): HttpRouteContext {
  return {
    body: {}, query: { periods: '1' }, params: { id: conversationId }, headers: {},
    method: 'GET', path: `/api/v1/conversations/${conversationId}/mood-period-comparison/export.csv`,
    authUser: authUser as never,
  }
}

function periodContext(name: string, periodId: string): HttpRouteContext {
  return {
    body: {}, query: {}, params: { periodId }, headers: {}, method: 'GET',
    path: `/api/v1/periods/${periodId}/${name}`,
    authUser: authUser as never,
  }
}

async function counts(conversationId: string) {
  const [memories, snapshots, ledger] = await Promise.all([
    prisma.conversationMemory.count({ where: { conversationId, userId: authUser.id } }),
    prisma.moodSnapshot.count({ where: { conversationId, userId: authUser.id } }),
    prisma.importedPeriodMetric.count({ where: { conversationId, userId: authUser.id } }),
  ])
  return { memories, snapshots, ledger }
}

beforeAll(async () => {
  process.env.DATABASE_URL = databaseUrl
  execFileSync('npx', ['prisma', 'db', 'push'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
  const [loadedComparisonModule, exportModule, periodModule, dbModule] = await Promise.all([
    import('./moodComparison.js?integration'),
    import('./export.js?integration'),
    import('./period.js?integration'),
    import('../db.js?integration'),
  ])
  comparisonModule = loadedComparisonModule
  prisma = dbModule.prisma
  await prisma.user.create({ data: { id: authUser.id, phone: authUser.phone } })
  for (const id of ['conv_source', 'conv_target', 'conv_new', 'conv_atomic']) {
    await prisma.conversation.create({
      data: { id, userId: authUser.id, mode: 'SINGLE', title: id, status: 'ACTIVE' },
    })
  }
  const sourceMemory = await prisma.conversationMemory.create({
    data: {
      id: 'mem_source_current', conversationId: 'conv_source', userId: authUser.id,
      content: 'source current', status: 'ACTIVE', createdAt: new Date(`${CURRENT_PERIOD}T12:00:00+08:00`),
    },
  })
  await prisma.moodSnapshot.create({
    data: {
      id: 'mood_source_current', conversationId: 'conv_source', userId: authUser.id,
      memoryId: sourceMemory.id, mood: 'NEUTRAL', score: 0, keywords: '',
      createdAt: new Date(`${CURRENT_PERIOD}T12:00:00+08:00`),
    },
  })

  const comparisonHandlers = new Map<string, HttpHandler>()
  comparisonModule.registerMoodComparisonRoutes({ define(name: string, _path: string, _method: string, handler: HttpHandler) { comparisonHandlers.set(name, handler) } } as never)
  importHandler = comparisonHandlers.get('chat::conversation-period-comparison-import-csv')!
  exportHandler = comparisonHandlers.get('chat::conversation-period-comparison-csv')!

  const exportUserHandlers = new Map<string, HttpHandler>()
  exportModule.registerExportRoutes({ define(name: string, _path: string, _method: string, handler: HttpHandler) { exportUserHandlers.set(name, handler) } } as never)

  const periodHandlers = new Map<string, HttpHandler>()
  periodModule.registerPeriodRoutes({ define(name: string, _path: string, _method: string, handler: HttpHandler) { periodHandlers.set(name, handler) } } as never)
  periodCsvHandler = periodHandlers.get('period::csv')!
  periodInsightHandler = periodHandlers.get('period::insight')!
})

afterAll(async () => {
  await prisma?.$disconnect()
  await rm(runDir, { recursive: true, force: true })
})

describe('period csv import persistence', () => {
  it('imports a real export into a clean cycle, stays idempotent, and round-trips value-for-value', async () => {
    const exported = await exportHandler(exportContext('conv_source'))
    expect(exported.status_code).toBe(200)
    const sourceCsv = String(exported.body.data)
    expect(sourceCsv.startsWith('\ufeff')).toBe(true)
    expect(sourceCsv).toContain('2026-10-12,2026-10-12,count,1')

    const first = await importHandler(importContext('conv_target', Buffer.from(sourceCsv, 'utf8')))
    expect(first.status_code).toBe(200)
    expect(first.body.data).toMatchObject({
      received: 5, imported: 5, skipped: 0, failed: 0,
      failures_total: 0, result_code: 'OK',
    })
    expect(await counts('conv_target')).toEqual({ memories: 1, snapshots: 1, ledger: 5 })

    const second = await importHandler(importContext('conv_target', Buffer.from(sourceCsv, 'utf8')))
    expect(second.body.data).toMatchObject({
      received: 5, imported: 0, skipped: 5, failed: 0,
      failures_total: 0, result_code: 'OK',
    })
    expect(await counts('conv_target')).toEqual({ memories: 1, snapshots: 1, ledger: 5 })

    const roundTrip = await exportHandler(exportContext('conv_target'))
    expect(String(roundTrip.body.data)).toBe(sourceCsv)
  })

  it('feeds imported values to existing aggregation and insight for a brand-new period', async () => {
    const imported = await importHandler(importContext('conv_new', csv(sourceRows(NEW_PERIOD))))
    expect(imported.body.data).toMatchObject({ received: 5, imported: 5, failed: 0 })
    expect(await counts('conv_new')).toEqual({ memories: 2, snapshots: 2, ledger: 5 })

    const report = await periodCsvHandler(periodContext('report.csv', NEW_PERIOD))
    expect(report.status_code).toBe(200)
    const reportCsv = String(report.rawBody)
    const reportRow = reportCsv.split(/\r?\n/).find((line) => line.startsWith(`${NEW_PERIOD},${NEW_PERIOD},true,`))
    expect(reportRow?.split(',')).toEqual(expect.arrayContaining(['1', '0', '1', '2', '0', '1', '7', 'PARTIAL']))

    const insight = await periodInsightHandler(periodContext('insight', NEW_PERIOD))
    expect(insight.body.data).toMatchObject({ available: true, degraded: false, periodId: NEW_PERIOD })
    const dominant = insight.body.data.insights.find((item: { type: string }) => item.type === 'DOMINANT_MOOD')
    expect(dominant).toMatchObject({
      value: { mood: 'NEGATIVE', count: 1, share: 0.5 },
      evidence: { sampleSize: 2, source: 'moodPeriodReport.summary.counts' },
    })
  })

  it('rolls the whole transaction back when persistence fails after P0/P1 writes', async () => {
    comparisonModule.__setPeriodImportPersistenceForTests(async () => {
      throw new Error('forced transaction failure')
    })
    try {
      await expect(importHandler(importContext('conv_atomic', csv(sourceRows())))).rejects.toThrow('forced transaction failure')
    } finally {
      comparisonModule.__setPeriodImportPersistenceForTests(null)
    }
    expect(await counts('conv_atomic')).toEqual({ memories: 0, snapshots: 0, ledger: 0 })
  })
})

describe('period csv import file contract', () => {
  it('returns a legal empty result and rejects file-level errors without writes', async () => {
    const empty = await importHandler(importContext('conv_target', ' \r\n'))
    expect(empty.status_code).toBe(200)
    expect(empty.body.data).toMatchObject({ received: 0, imported: 0, skipped: 0, failed: 0, result_code: 'EMPTY_FILE' })

    await expect(importHandler(importContext('conv_target', '\ufeffdate,period_id,dimension,value\r\n')))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_HEADER' })
    await expect(importHandler(importContext('conv_target', Buffer.from([0x00, 0xff, 0xfe]))))
      .rejects.toMatchObject({ statusCode: 400, code: 'ENCODING_ERROR' })
    const oversized = csv(Array.from({ length: 1001 }, (_, index) => `2026-10-12,2026-10-12,count,${index}`))
    await expect(importHandler(importContext('conv_target', oversized)))
      .rejects.toMatchObject({ statusCode: 413, code: 'ROW_LIMIT_EXCEEDED', detail: { limit: 1000 } })
    expect(await counts('conv_target')).toEqual({ memories: 1, snapshots: 1, ledger: 5 })
  })

  it('enforces authentication and conversation ownership before parsing', async () => {
    const anonymous = importContext('conv_target', csv(sourceRows()))
    anonymous.authUser = undefined
    await expect(importHandler(anonymous)).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' })
    await expect(importHandler(importContext('not_owner', csv(sourceRows()))))
      .rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' })
  })

  it('keeps the received count invariant for an all-invalid file', async () => {
    const invalid = csv([
      '2026-10-12,2026-10-13,count,1',
      '2026-10-12,2026-10-12,count,not-number',
    ])
    const result = await importHandler(importContext('conv_atomic', invalid))
    expect(result.status_code).toBe(200)
    expect(result.body.data).toMatchObject({
      received: 2, imported: 0, skipped: 0, failed: 2, failures_total: 2, result_code: 'OK',
    })
    expect(result.body.data.failures.map((item: { line: number }) => item.line)).toEqual([2, 3])
    expect(await counts('conv_atomic')).toEqual({ memories: 0, snapshots: 0, ledger: 0 })
  })
})

describe('period csv import concurrent conflict degradation', () => {
  it('maps a raced unique-key conflict to 409 DUPLICATE and rolls back', async () => {
    const before = await counts('conv_target')
    const originalFind = prisma.importedPeriodMetric.findMany.bind(prisma.importedPeriodMetric)
    let forced = false
    prisma.importedPeriodMetric.findMany = (async (...args: Parameters<typeof originalFind>) => {
      if (forced) return originalFind(...args)
      forced = true
      return []
    }) as typeof prisma.importedPeriodMetric.findMany
    try {
      await expect(importHandler(importContext('conv_target', csv(sourceRows()))))
        .rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE' })
    } finally {
      prisma.importedPeriodMetric.findMany = originalFind
    }
    expect(await counts('conv_target')).toEqual(before)
  })
})
