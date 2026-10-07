/**
 * 心伴 v0.5 · 用户数据导出路由（JSON only）
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { authenticate } from '../http.js'
import { ok } from '../lib/response.js'
import { serializeExport } from '../lib/exportData.js'

async function exportUserData(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      emotion: true,
    },
  })

  // Prisma 7 当前 relation graph 不含 memory -> corrections 的可复用命名；
  // 显式查询保证 schema 稳定，并避免未定义关系泄漏到导出契约。
  const conversationIds = conversations.map((conversation) => conversation.id)
  const [memories, moodSnapshots, corrections] = await Promise.all([
    conversationIds.length
      ? prisma.conversationMemory.findMany({
          where: { conversationId: { in: conversationIds }, userId: user.id },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
    conversationIds.length
      ? prisma.moodSnapshot.findMany({
          where: { conversationId: { in: conversationIds }, userId: user.id },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
    conversationIds.length
      ? prisma.moodCorrection.findMany({
          where: { conversationId: { in: conversationIds }, userId: user.id },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      : Promise.resolve([]),
  ])

  const rows = conversations.map((conversation) => ({
    ...conversation,
    memories: memories.filter((row) => row.conversationId === conversation.id),
    moodSnapshots: moodSnapshots
      .filter((row) => row.conversationId === conversation.id)
      .map((row) => ({
        ...row,
        corrections: corrections.filter((correction) => correction.moodSnapshotId === row.id),
      })),
  }))

  return ok(serializeExport(rows), '用户数据导出成功')
}

export function registerExportRoutes(router: HttpRouter): void {
  router.define('user-data::export', '/api/v1/export', 'GET', exportUserData)
}
