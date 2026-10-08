/**
 * 心伴 v0.5 · 用户数据导出冻结 schema
 * 路由只负责授权和查询；这里做 schema 版本、安全序列化和空结构。
 */

export const EXPORT_SCHEMA_VERSION = 1 as const
export const EXPORT_FORMAT = 'xinban-json' as const

export interface ExportConversationContract {
  id: string
  mode: string
  title: string | null
  characterId: string | null
  createdAt: string
  updatedAt: string
  messages: Array<{
    id: string
    role: string
    content: string
    status: string
    type: string
    metadata: Record<string, unknown>
    createdAt: string
  }>
  memories: Array<{
    id: string
    characterId: string | null
    sourceMessageId: string | null
    content: string
    status: string
    createdAt: string
  }>
  emotion: {
    emotion: string
    score: number
    version: number
    payload: Record<string, unknown>
    updatedAt: string
  } | null
  moodSnapshots: Array<{
    id: string
    characterId: string | null
    sourceMessageId: string | null
    memoryId: string | null
    mood: string
    score: number
    keywords: string[]
    createdAt: string
    corrections: Array<{
      id: number
      mood: string
      score: number
      tags: string[]
      reason: string
      clientMutationId: string | null
      createdAt: string
    }>
  }>
}

export interface UserExportContract {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION
  format: typeof EXPORT_FORMAT
  exportedAt: string
  conversations: ExportConversationContract[]
}

function iso(value: Date): string {
  return value.toISOString()
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || value.trim() === '') return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function normalizedMood(value: string): string {
  return value === 'POSITIVE' || value === 'NEGATIVE' ? value : 'NEUTRAL'
}

function normalizedScore(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0
}

export function serializeExport(
  conversations: Array<Record<string, unknown>>,
  exportedAt = new Date(),
): UserExportContract {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    format: EXPORT_FORMAT,
    exportedAt: iso(exportedAt),
    conversations: conversations.map((raw) => {
      const messages = (raw.messages as Array<Record<string, unknown>> | undefined) ?? []
      const memories = (raw.memories as Array<Record<string, unknown>> | undefined) ?? []
      const moodSnapshots = (raw.moodSnapshots as Array<Record<string, unknown>> | undefined) ?? []
      const emotion = raw.emotion as Record<string, unknown> | null | undefined
      return {
        id: String(raw.id ?? ''),
        mode: String(raw.mode ?? 'SINGLE'),
        title: (raw.title as string | null | undefined) ?? null,
        characterId: (raw.characterId as string | null | undefined) ?? null,
        createdAt: iso(raw.createdAt as Date),
        updatedAt: iso(raw.updatedAt as Date),
        messages: messages.map((message) => ({
          id: String(message.id ?? ''),
          role: String(message.role ?? 'USER'),
          content: String(message.content ?? ''),
          status: String(message.status ?? 'COMPLETED'),
          type: String(message.type ?? 'TEXT'),
          metadata: parseJsonObject(message.metadata),
          createdAt: iso(message.createdAt as Date),
        })),
        memories: memories.map((memory) => ({
          id: String(memory.id ?? ''),
          characterId: (memory.characterId as string | null | undefined) ?? null,
          sourceMessageId: (memory.sourceMessageId as string | null | undefined) ?? null,
          content: String(memory.content ?? ''),
          status: memory.status === 'QUARANTINED' ? 'QUARANTINED' : 'ACTIVE',
          createdAt: iso(memory.createdAt as Date),
        })),
        emotion: emotion
          ? {
              emotion: String(emotion.emotion ?? 'NEUTRAL'),
              score: Number(emotion.score ?? 0),
              version: Number(emotion.version ?? 1),
              payload: parseJsonObject(emotion.payload),
              updatedAt: iso(emotion.updatedAt as Date),
            }
          : null,
        moodSnapshots: moodSnapshots.map((mood) => {
          const corrections = (mood.corrections as Array<Record<string, unknown>> | undefined) ?? []
          return {
            id: String(mood.id ?? ''),
            characterId: (mood.characterId as string | null | undefined) ?? null,
            sourceMessageId: (mood.sourceMessageId as string | null | undefined) ?? null,
            memoryId: (mood.memoryId as string | null | undefined) ?? null,
            mood: normalizedMood(String(mood.mood ?? 'NEUTRAL')),
            score: normalizedScore(Number(mood.score ?? 0)),
            keywords: String(mood.keywords ?? '').split(',').filter(Boolean),
            createdAt: iso(mood.createdAt as Date),
            corrections: corrections.map((correction) => ({
              id: Number(correction.id ?? 0),
              mood: normalizedMood(String(correction.mood ?? 'NEUTRAL')),
              score: normalizedScore(Number(correction.score ?? 0)),
              tags: String(correction.tags ?? '').split(',').filter(Boolean),
              reason: String(correction.reason ?? ''),
              clientMutationId: (correction.clientMutationId as string | null | undefined) ?? null,
              createdAt: iso(correction.createdAt as Date),
            })),
          }
        }),
      }
    }),
  }
}
