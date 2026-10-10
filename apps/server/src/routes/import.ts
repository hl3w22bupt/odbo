/**
 * 心伴 v0.6 · 用户数据导入路由（JSON only）
 * schema 非法在 lib 层整批拒绝；已存在会话按记录跳过，不阻断批次。
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { authenticate } from '../http.js'
import { fail, ok } from '../lib/response.js'
import { fromError } from '../lib/response.js'
import { assertImportPayload } from '../lib/importData.js'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

type ImportResult = {
  conversationId: string
  status: 'imported' | 'skipped'
  reason?: string
}

type ImportSummary = {
  schemaVersion: 1
  format: 'xinban-json'
  received: number
  imported: number
  skipped: number
  results: ImportResult[]
}

function jsonText(value: Record<string, unknown>): string {
  return JSON.stringify(value)
}

function characterIds(conversation: ReturnType<typeof assertImportPayload>['conversations'][number]): string[] {
  return [
    conversation.characterId,
    ...conversation.memories.map((memory) => memory.characterId ?? null),
    ...conversation.moodSnapshots.map((mood) => mood.characterId ?? null),
  ].filter((value): value is string => Boolean(value))
}

async function createConversationBundle(
  tx: TransactionClient,
  conversation: ReturnType<typeof assertImportPayload>['conversations'][number],
  userId: string,
): Promise<void> {
  await tx.conversation.create({
    data: {
      id: conversation.id,
      userId,
      characterId: conversation.characterId,
      mode: conversation.mode,
      title: conversation.title,
      status: 'ACTIVE',
      lastMessageAt: new Date(conversation.updatedAt),
      createdAt: new Date(conversation.createdAt),
      updatedAt: new Date(conversation.updatedAt),
    },
  })

  if (conversation.messages.length) {
    await tx.message.createMany({
      data: conversation.messages.map((message) => ({
        id: message.id,
        conversationId: conversation.id,
        userId,
        characterId: conversation.characterId,
        role: message.role,
        content: message.content,
        status: message.status,
        type: message.type,
        metadata: jsonText(message.metadata),
        createdAt: new Date(message.createdAt),
      })),
    })
  }

  if (conversation.memories.length) {
    await tx.conversationMemory.createMany({
      data: conversation.memories.map((memory) => ({
        id: memory.id,
        conversationId: conversation.id,
        userId,
        characterId: memory.characterId,
        sourceMessageId: memory.sourceMessageId,
        content: memory.content,
        status: memory.status,
        createdAt: new Date(memory.createdAt),
        updatedAt: new Date(memory.createdAt),
      })),
    })
  }

  if (conversation.emotion) {
    await tx.conversationEmotion.create({
      data: {
        conversationId: conversation.id,
        emotion: conversation.emotion.emotion,
        score: conversation.emotion.score,
        version: conversation.emotion.version,
        payload: jsonText(conversation.emotion.payload),
        updatedAt: new Date(conversation.emotion.updatedAt),
      },
    })
  }

  if (conversation.moodSnapshots.length) {
    await tx.moodSnapshot.createMany({
      data: conversation.moodSnapshots.map((mood) => ({
        id: mood.id,
        conversationId: conversation.id,
        userId,
        characterId: mood.characterId,
        sourceMessageId: mood.sourceMessageId,
        memoryId: mood.memoryId,
        mood: mood.mood,
        score: mood.score,
        keywords: mood.keywords.join(','),
        createdAt: new Date(mood.createdAt),
      })),
    })
  }

  const corrections = conversation.moodSnapshots.flatMap((mood) => mood.corrections.map((correction) => ({
    id: correction.id,
    conversationId: conversation.id,
    userId,
    moodSnapshotId: mood.id,
    mood: correction.mood,
    score: correction.score,
    tags: correction.tags.join(','),
    reason: correction.reason,
    clientMutationId: correction.clientMutationId,
    createdAt: new Date(correction.createdAt),
  })))
  if (corrections.length) await tx.moodCorrection.createMany({ data: corrections })
}

async function importUserData(ctx: HttpRouteContext) {
  try {
  const user = await authenticate(ctx)
  const envelope = ctx.body
  const payload = envelope && typeof envelope === 'object' && !Array.isArray(envelope) &&
    (envelope as Record<string, unknown>).data && typeof (envelope as Record<string, unknown>).data === 'object' &&
    !Array.isArray((envelope as Record<string, unknown>).data)
    ? (envelope as Record<string, unknown>).data
    : ctx.body
  const parsed = assertImportPayload(payload)
  const conversationIds = parsed.conversations.map((conversation) => conversation.id)
  const candidateCharacterIds = [...new Set(parsed.conversations.flatMap(characterIds))]

  const [existingConversations, existingCharacters] = await Promise.all([
    conversationIds.length
      ? prisma.conversation.findMany({ where: { id: { in: conversationIds } }, select: { id: true } })
      : Promise.resolve([] as Array<{ id: string }>),
    candidateCharacterIds.length
      ? prisma.character.findMany({ where: { id: { in: candidateCharacterIds } }, select: { id: true } })
      : Promise.resolve([] as Array<{ id: string }>),
  ])
  const existingConversationIds = new Set(existingConversations.map((row) => row.id))
  const existingCharacterIds = new Set(existingCharacters.map((row) => row.id))

  const results: ImportResult[] = []
  for (const conversation of parsed.conversations) {
    if (existingConversationIds.has(conversation.id)) {
      results.push({ conversationId: conversation.id, status: 'skipped', reason: 'CONVERSATION_EXISTS' })
      continue
    }
    const missingCharacterId = characterIds(conversation).find((id) => !existingCharacterIds.has(id))
    if (missingCharacterId) {
      results.push({ conversationId: conversation.id, status: 'skipped', reason: 'CHARACTER_NOT_FOUND' })
      continue
    }
    await prisma.$transaction(async (tx) => createConversationBundle(tx, conversation, user.id))
    results.push({ conversationId: conversation.id, status: 'imported' })
  }

  const summary: ImportSummary = {
    schemaVersion: parsed.schemaVersion,
    format: parsed.format,
    received: parsed.conversations.length,
    imported: results.filter((result) => result.status === 'imported').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    results,
  }
  return ok(summary, '用户数据导入成功')
  } catch (error) {
    return fromError(error)
  }
}

export function registerImportRoutes(router: HttpRouter): void {
  router.define('user-data::import', '/api/v1/import', 'POST', importUserData)
}
