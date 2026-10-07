import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { HttpHandler, HttpRouteContext } from '../http.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { validImportPayload } from '../lib/importData.test.js'

const runDir = await mkdtemp(join(tmpdir(), 'xinban-v06-import.'))
const databaseUrl = `file:${join(runDir, 'import.db')}`
type PrismaClientType = import('../generated/prisma/client.js').PrismaClient
let prisma: PrismaClientType
let importHandler: HttpHandler
const authUser = { id: 'user_import_1', phone: '13800008888', role: 'USER', status: 'ACTIVE' } as const

function context(payload: unknown): HttpRouteContext {
  return {
    body: payload,
    query: {},
    params: {},
    headers: {},
    method: 'POST',
    path: '/api/v1/import',
    authUser: authUser as never,
  }
}

beforeAll(async () => {
  process.env.DATABASE_URL = databaseUrl
  execFileSync('npx', ['prisma', 'db', 'push'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
  const exportModule = await import('./export.js?integration')
  const importModule = await import('./import.js?integration')
  const dbModule = await import('../db.js?integration')
  prisma = dbModule.prisma
  await prisma.user.create({ data: { id: authUser.id, phone: authUser.phone } })
  await prisma.character.create({ data: { id: 'char_import', name: '导入角色', title: '备份', type: 'INCLUSIVE', occupation: '朋友', personality: '温暖', greeting: '你好' } })

  const importHandlers = new Map<string, HttpHandler>()
  importModule.registerImportRoutes({ define(name: string, _path: string, _method: string, handler: HttpHandler) { importHandlers.set(name, handler) } } as never)
  importHandler = importHandlers.get('user-data::import')!

  const exportHandlers = new Map<string, HttpHandler>()
  exportModule.registerExportRoutes({ define(name: string, _path: string, _method: string, handler: HttpHandler) { exportHandlers.set(name, handler) } } as never)
  exportHandler = exportHandlers.get('user-data::export')!
})

let exportHandler: HttpHandler

afterAll(async () => {
  await prisma?.$disconnect()
  await rm(runDir, { recursive: true, force: true })
})

async function counts() {
  const [conversations, messages, memories, emotions, snapshots, corrections] = await Promise.all([
    prisma.conversation.count({ where: { userId: authUser.id } }),
    prisma.message.count({ where: { userId: authUser.id } }),
    prisma.conversationMemory.count({ where: { userId: authUser.id } }),
    prisma.conversationEmotion.count(),
    prisma.moodSnapshot.count({ where: { userId: authUser.id } }),
    prisma.moodCorrection.count({ where: { userId: authUser.id } }),
  ])
  return { conversations, messages, memories, emotions, snapshots, corrections }
}

describe('json import persistence', () => {
  it('test_import_roundtrip_and_idempotent_anchor', async () => {
    const first = await importHandler(context(validImportPayload))
    expect(first.status_code).toBe(200)
    expect(first.body.data).toMatchObject({
      schemaVersion: 1,
      format: 'xinban-json',
      received: 1,
      imported: 1,
      skipped: 0,
      results: [{ conversationId: 'conv_import_1', status: 'imported' }],
    })
    const firstCounts = await counts()
    expect(firstCounts).toEqual({ conversations: 1, messages: 1, memories: 1, emotions: 1, snapshots: 1, corrections: 1 })

    const exported = await exportHandler(context(undefined))
    expect(exported.status_code).toBe(200)
    expect(exported.body.data.conversations).toEqual(validImportPayload.conversations)

    const second = await importHandler(context(validImportPayload))
    expect(second.status_code).toBe(200)
    expect(second.body.data).toMatchObject({
      received: 1,
      imported: 0,
      skipped: 1,
      results: [{ conversationId: 'conv_import_1', status: 'skipped', reason: 'CONVERSATION_EXISTS' }],
    })
    expect(await counts()).toEqual(firstCounts)
  })

  it('test_import_missing_or_higher_version_rejects_without_write', async () => {
    const before = await counts()
    const missing = JSON.parse(JSON.stringify(validImportPayload)) as Record<string, unknown>
    delete missing.schemaVersion
    const missingRes = await importHandler(context(missing))
    expect(missingRes.status_code).toBe(422)
    expect(missingRes.body.code).toBe('IMPORT_VERSION_MISSING')

    const higher = { ...validImportPayload, schemaVersion: 2 }
    const higherRes = await importHandler(context(higher))
    expect(higherRes.status_code).toBe(422)
    expect(higherRes.body.code).toBe('IMPORT_VERSION_UNSUPPORTED')
    expect(await counts()).toEqual(before)
  })

  it('test_import_schema_rejection_is_whole_batch_and_record_skip_is_isolated', async () => {
    const before = await counts()
    const invalid = JSON.parse(JSON.stringify(validImportPayload)) as Record<string, any>
    delete invalid.conversations[0].id
    const rejected = await importHandler(context(invalid))
    expect(rejected.status_code).toBe(422)
    expect(rejected.body.code).toBe('IMPORT_SCHEMA_REJECTED')
    expect(await counts()).toEqual(before)

    const extra = JSON.parse(JSON.stringify(validImportPayload)) as Record<string, any>
    extra.conversations[0].id = 'conv_import_old'
    extra.conversations[0].messages[0].id = 'msg_import_old'
    extra.conversations[0].memories[0].id = 'memory_import_old'
    extra.conversations[0].moodSnapshots[0].id = 'mood_import_old'
    extra.conversations[0].moodSnapshots[0].corrections[0].clientMutationId = 'import-mutation-old'
    extra.conversations.push({
      id: 'conv_import_new', mode: 'MULTI', title: '新会话', characterId: null,
      createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z',
      messages: [], memories: [], emotion: null, moodSnapshots: [],
    })
    const mixed = await importHandler(context(extra))
    expect(mixed.status_code).toBe(200)
    expect(mixed.body.data).toMatchObject({ received: 2, imported: 1, skipped: 1 })
    expect(mixed.body.data.results).toEqual(expect.arrayContaining([
      { conversationId: 'conv_import_old', status: 'skipped', reason: 'CONVERSATION_EXISTS' },
      { conversationId: 'conv_import_new', status: 'imported' },
    ]))
    expect((await counts()).conversations).toBe(2)
  })
})
