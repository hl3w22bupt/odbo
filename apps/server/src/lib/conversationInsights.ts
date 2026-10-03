/**
 * 心伴 v0.3 · 会话记忆与情绪轨迹
 * 纯函数层负责提取、契约序列化与降级兜底；路由层负责鉴权和 Prisma 持久化。
 */

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
