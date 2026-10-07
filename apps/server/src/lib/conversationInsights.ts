/**
 * 心伴 v0.3 · 会话记忆与情绪轨迹
 * 纯函数层负责提取、契约序列化与降级兜底；路由层负责鉴权和 Prisma 持久化。
 */

import { applyLatestCorrection, serializeCorrection, type MoodCorrectionContract, type CorrectedMoodPoint } from './moodCorrections.js'

export type ConversationMood = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'

export interface ConversationMemoryContract {
  id: string
  conversationId: string
  characterId: string | null
  sourceMessageId: string | null
  content: string
  status: 'ACTIVE' | 'QUARANTINED'
  createdAt: string
}

export interface MemoryReadContract {
  conversationId: string
  available: boolean
  degraded: boolean
  items: ConversationMemoryContract[]
}

export interface MoodSnapshotContract {
  id: string
  conversationId: string
  characterId: string | null
  sourceMessageId: string | null
  memoryId: string | null
  mood: ConversationMood
  score: -1 | 0 | 1
  keywords: string[]
  createdAt: string
}

export interface MoodTimelineContract {
  conversationId: string
  available: boolean
  degraded: boolean
  points: MoodSnapshotContract[]
}

const MEMORY_MAX_LENGTH = 160
const MEMORY_LIMIT = 20

export function normalizeMemoryContent(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, MEMORY_MAX_LENGTH)
}

export function extractMemoryContent(content: string): string {
  return normalizeMemoryContent(content)
}

export function memoryReadEmpty(conversationId: string): MemoryReadContract {
  return { conversationId, available: true, degraded: false, items: [] }
}

export function memoryReadDegraded(conversationId: string): MemoryReadContract {
  return { conversationId, available: false, degraded: true, items: [] }
}

export function moodTimelineEmpty(conversationId: string): MoodTimelineContract {
  return { conversationId, available: true, degraded: false, points: [] }
}

export function moodTimelineDegraded(conversationId: string): MoodTimelineContract {
  return { conversationId, available: false, degraded: true, points: [] }
}

export function serializeMemory(row: {
  id: string
  conversationId: string
  characterId: string | null
  sourceMessageId: string | null
  content: string
  status: string
  createdAt: Date
}): ConversationMemoryContract {
  return {
    id: row.id,
    conversationId: row.conversationId,
    characterId: row.characterId,
    sourceMessageId: row.sourceMessageId,
    content: row.content,
    status: row.status === 'QUARANTINED' ? 'QUARANTINED' : 'ACTIVE',
    createdAt: row.createdAt.toISOString(),
  }
}

/** 降级态是契约的一部分：存储不可用时必须返回空列表，不能把半写/脏数据展示给用户。 */
export interface MemoryWriteResult<T> {
  memory: T | null
  read: MemoryReadContract
}

/**
 * P0 写路径统一降级器：记忆写失败时主聊天继续，读回契约强制为空。
 */
export async function persistMemoryOrDegrade<T>(
  conversationId: string,
  write: () => Promise<T>,
): Promise<MemoryWriteResult<T>> {
  try {
    const memory = await write()
    return { memory, read: memoryReadEmpty(conversationId) }
  } catch {
    return { memory: null, read: memoryReadDegraded(conversationId) }
  }
}

export function readableMemories(
  conversationId: string,
  rows: Array<Parameters<typeof serializeMemory>[0]>,
  degraded = false,
): MemoryReadContract {
  if (degraded) return memoryReadDegraded(conversationId)
  return {
    conversationId,
    available: true,
    degraded: false,
    items: rows
      .filter((row) => row.status === 'ACTIVE' && normalizeMemoryContent(row.content).length > 0)
      .slice(0, MEMORY_LIMIT)
      .map(serializeMemory),
  }
}

const POSITIVE_WORDS = ['开心', '高兴', '喜欢', '舒服', '顺利', '幸福', '满意', '不错', '舒心', '笑']
const NEGATIVE_WORDS = ['难过', '伤心', '孤独', '焦虑', '烦', '累', '生气', '失望', '害怕', '不舒服']

export function classifyMood(content: string): {
  mood: ConversationMood
  score: -1 | 0 | 1
  keywords: string[]
} {
  const text = content.toLowerCase()
  const positive = POSITIVE_WORDS.filter((word) => text.includes(word.toLowerCase()))
  const negative = NEGATIVE_WORDS.filter((word) => text.includes(word.toLowerCase()))
  if (positive.length > negative.length) return { mood: 'POSITIVE', score: 1, keywords: positive }
  if (negative.length > positive.length) return { mood: 'NEGATIVE', score: -1, keywords: negative }
  return { mood: 'NEUTRAL', score: 0, keywords: [] }
}

export function serializeMood(row: {
  id: string
  conversationId: string
  characterId: string | null
  sourceMessageId: string | null
  memoryId: string | null
  mood: string
  score: number
  keywords: string | string[]
  createdAt: Date
}): MoodSnapshotContract {
  const mood: ConversationMood =
    row.mood === 'POSITIVE' ? 'POSITIVE' : row.mood === 'NEGATIVE' ? 'NEGATIVE' : 'NEUTRAL'
  return {
    id: row.id,
    conversationId: row.conversationId,
    characterId: row.characterId,
    sourceMessageId: row.sourceMessageId,
    memoryId: row.memoryId,
    mood,
    score: row.score > 0 ? 1 : row.score < 0 ? -1 : 0,
    keywords: Array.isArray(row.keywords)
      ? row.keywords.filter(Boolean)
      : row.keywords.split(',').filter(Boolean),
    createdAt: row.createdAt.toISOString(),
  }
}

export function readableMoodTimeline(
  conversationId: string,
  rows: Array<Parameters<typeof serializeMood>[0]>,
  degraded = false,
  correctionRows: Array<Parameters<typeof serializeCorrection>[0]> = [],
): MoodTimelineContract {
  if (degraded) return moodTimelineDegraded(conversationId)
  const latest = new Map<string, MoodCorrectionContract>()
  for (const row of correctionRows) {
    const correction = serializeCorrection(row)
    const current = latest.get(correction.moodSnapshotId)
    if (!current || current.createdAt < correction.createdAt || (current.createdAt === correction.createdAt && current.id < correction.id)) {
      latest.set(correction.moodSnapshotId, correction)
    }
  }
  return {
    conversationId,
    available: true,
    degraded: false,
    points: rows
      .slice(0, 50)
      .map(serializeMood)
      .map((point): CorrectedMoodPoint => {
        if (!point.id) {
          return {
            ...point,
            tags: [],
            reason: '',
            originalMood: null,
            originalScore: null,
            correctionId: null,
            correctedAt: null,
          }
        }
        return applyLatestCorrection(point, latest.get(point.id) ?? null)
      }),
  }
}

export { applyLatestCorrection, serializeCorrection as serializeMoodCorrection } from './moodCorrections.js'
