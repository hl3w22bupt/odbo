import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { HttpHandler, HttpRouteContext } from '../http.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'


const runDir = await mkdtemp(join(tmpdir(), 'xinban-v05-restart.'))
const databaseUrl = `file:${join(runDir, 'restart.db')}`
type PrismaClientType = import('../generated/prisma/client.js').PrismaClient
let prisma: PrismaClientType
let correctionHandler: HttpHandler
const authUser = { id: 'user_restart_1', phone: '13800009999', role: 'USER', status: 'ACTIVE' } as const

beforeAll(async () => {
  process.env.DATABASE_URL = databaseUrl
  execFileSync('npx', ['prisma', 'db', 'push'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })
  const chatModule = await import('./chat.js?integration')
  const dbModule = await import('../db.js?integration')
  prisma = dbModule.prisma
  await prisma.user.create({ data: { id: authUser.id, phone: authUser.phone } })
  await prisma.conversation.create({
    data: { id: 'conv_restart_1', userId: authUser.id, characterId: null, mode: 'SINGLE' },
  })
  await prisma.conversationMemory.create({
    data: {
      id: 'memory_restart_1',
      conversationId: 'conv_restart_1',
      userId: authUser.id,
      content: '今天很开心',
      status: 'ACTIVE',
    },
  })
  await prisma.moodSnapshot.create({
    data: {
      id: 'mood_restart_1',
      conversationId: 'conv_restart_1',
      userId: authUser.id,
      memoryId: 'memory_restart_1',
      mood: 'POSITIVE',
      score: 1,
      keywords: '开心',
    },
  })

  const handlers = new Map<string, HttpHandler>()
  chatModule.registerChatRoutes({
    define(name, _path, _method, handler) {
      handlers.set(name, handler)
    },
  } as never)
  correctionHandler = handlers.get('chat::mood-point-correction')!
})

afterAll(async () => {
  await prisma?.$disconnect()
  await rm(runDir, { recursive: true, force: true })
})

describe('mood correction persistence', () => {
  it('test_edit_persists_across_restart', async () => {
    const response = await correctionHandler({
      body: { mood: 'NEUTRAL', tags: ['状态变化'], reason: '其实是平静', clientMutationId: 'restart-anchor' },
      query: {},
      params: { id: 'conv_restart_1', pointId: 'mood_restart_1' },
      headers: {},
      method: 'POST',
      path: '/api/v1/conversations/conv_restart_1/mood-points/mood_restart_1/correction',
      authUser: authUser as never,
    })
    expect(response.status_code).toBe(200)
    expect(response.body.data).toMatchObject({ persisted: true, degraded: false })

    // 模拟进程重启：关闭旧连接，用同一 SQLite 文件打开全新 PrismaClient。
    await prisma.$disconnect()
    const { PrismaClient } = await import('../generated/prisma/client.js?restart')
    const restarted = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: databaseUrl }) as never,
    })
    try {
      const correction = await restarted.moodCorrection.findUnique({
        where: { clientMutationId: 'restart-anchor' },
      })
      expect(correction).toMatchObject({
        conversationId: 'conv_restart_1',
        moodSnapshotId: 'mood_restart_1',
        mood: 'NEUTRAL',
        score: 0,
        reason: '其实是平静',
      })
      const snapshot = await restarted.moodSnapshot.findUnique({ where: { id: 'mood_restart_1' } })
      expect(snapshot).toMatchObject({ mood: 'POSITIVE', score: 1 })
    } finally {
      await restarted.$disconnect()
    }
  })
})
