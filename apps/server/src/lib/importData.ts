/**
 * 心伴 v0.6 · 用户数据导入冻结 schema
 * 输入复用 v0.5 导出契约；schema 校验失败必须整批拒绝，不允许半套数据进入路由。
 */
import { AppError } from './errors.js'
import {
  EXPORT_FORMAT,
  EXPORT_SCHEMA_VERSION,
  type ExportConversationContract,
  type UserExportContract,
} from './exportData.js'

export const IMPORT_SCHEMA_VERSION = EXPORT_SCHEMA_VERSION
export const IMPORT_FORMAT = EXPORT_FORMAT

function schemaRejected(message: string, detail?: unknown): never {
  throw new AppError(422, 'IMPORT_SCHEMA_REJECTED', message, detail)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') schemaRejected(`${field} 必须是非空字符串`, { field })
  return value
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') schemaRejected(`${field} 必须是字符串或 null`, { field })
  return value
}

function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
    schemaRejected(`${field} 必须是 ISO 时间`, { field })
  }
  return value
}

function objectValue(value: unknown, field: string): Record<string, unknown> {
  if (!isObject(value)) schemaRejected(`${field} 必须是对象`, { field })
  return value
}

function arrayValue<T = unknown>(value: unknown, field: string): T[] {
  if (!Array.isArray(value)) schemaRejected(`${field} 必须是数组`, { field })
  return value as T[]
}

function numberValue(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) schemaRejected(`${field} 必须是数字`, { field })
  return value
}

function integerWith(value: number, field: string, allowed: number[]): number {
  if (!Number.isInteger(value) || !allowed.includes(value)) {
    schemaRejected(`${field} 只允许 ${allowed.join('/')}`, { field })
  }
  return value
}

function parseConversation(value: unknown): ExportConversationContract {
  if (!isObject(value)) schemaRejected('conversation 必须是对象', { field: 'conversation' })
  const messages = arrayValue<Record<string, unknown>>(value.messages, 'conversation.messages')
    .map((raw, index) => {
      const field = `conversation.messages.${index}`
      return {
        id: requiredString(raw.id, `${field}.id`),
        role: requiredString(raw.role, `${field}.role`),
        content: typeof raw.content === 'string' ? raw.content : schemaRejected(`${field}.content 必须是字符串`, { field: `${field}.content` }),
        status: requiredString(raw.status, `${field}.status`),
        type: requiredString(raw.type, `${field}.type`),
        metadata: objectValue(raw.metadata, `${field}.metadata`),
        createdAt: isoDate(raw.createdAt, `${field}.createdAt`),
      }
    })
  const memories = arrayValue<Record<string, unknown>>(value.memories, 'conversation.memories')
    .map((raw, index) => {
      const field = `conversation.memories.${index}`
      return {
        id: requiredString(raw.id, `${field}.id`),
        characterId: optionalString(raw.characterId, `${field}.characterId`),
        sourceMessageId: optionalString(raw.sourceMessageId, `${field}.sourceMessageId`),
        content: requiredString(raw.content, `${field}.content`),
        status: requiredString(raw.status, `${field}.status`),
        createdAt: isoDate(raw.createdAt, `${field}.createdAt`),
      }
    })
  const emotion = value.emotion === null || value.emotion === undefined ? null : (() => {
    const raw = objectValue(value.emotion, 'conversation.emotion')
    const score = numberValue(raw.score, 'conversation.emotion.score')
    const version = numberValue(raw.version, 'conversation.emotion.version')
    if (!Number.isInteger(version) || version < 1) schemaRejected('conversation.emotion.version 必须是正整数')
    return {
      emotion: requiredString(raw.emotion, 'conversation.emotion.emotion'),
      score,
      version,
      payload: objectValue(raw.payload, 'conversation.emotion.payload'),
      updatedAt: isoDate(raw.updatedAt, 'conversation.emotion.updatedAt'),
    }
  })()
  const moodSnapshots = arrayValue<Record<string, unknown>>(value.moodSnapshots, 'conversation.moodSnapshots')
    .map((raw, index) => {
      const field = `conversation.moodSnapshots.${index}`
      const corrections = arrayValue<Record<string, unknown>>(raw.corrections, `${field}.corrections`).map((item, correctionIndex) => {
        const correctionField = `${field}.corrections.${correctionIndex}`
        const id = numberValue(item.id, `${correctionField}.id`)
        if (!Number.isInteger(id) || id < 1) schemaRejected(`${correctionField}.id 必须是正整数`)
        return {
          id,
          mood: requiredString(item.mood, `${correctionField}.mood`),
          score: integerWith(numberValue(item.score, `${correctionField}.score`), `${correctionField}.score`, [-1, 0, 1]),
          tags: arrayValue<string>(item.tags, `${correctionField}.tags`).map((tag, tagIndex) => requiredString(tag, `${correctionField}.tags.${tagIndex}`)),
          reason: typeof item.reason === 'string' ? item.reason : schemaRejected(`${correctionField}.reason 必须是字符串`),
          clientMutationId: optionalString(item.clientMutationId, `${correctionField}.clientMutationId`),
          createdAt: isoDate(item.createdAt, `${correctionField}.createdAt`),
        }
      })
      return {
        id: requiredString(raw.id, `${field}.id`),
        characterId: optionalString(raw.characterId, `${field}.characterId`),
        sourceMessageId: optionalString(raw.sourceMessageId, `${field}.sourceMessageId`),
        memoryId: optionalString(raw.memoryId, `${field}.memoryId`),
        mood: requiredString(raw.mood, `${field}.mood`),
        score: integerWith(numberValue(raw.score, `${field}.score`), `${field}.score`, [-1, 0, 1]),
        keywords: arrayValue<string>(raw.keywords, `${field}.keywords`).map((keyword, keywordIndex) => requiredString(keyword, `${field}.keywords.${keywordIndex}`)),
        createdAt: isoDate(raw.createdAt, `${field}.createdAt`),
        corrections,
      }
    })

  return {
    id: requiredString(value.id, 'conversation.id'),
    mode: requiredString(value.mode, 'conversation.mode'),
    title: optionalString(value.title, 'conversation.title'),
    characterId: optionalString(value.characterId, 'conversation.characterId'),
    createdAt: isoDate(value.createdAt, 'conversation.createdAt'),
    updatedAt: isoDate(value.updatedAt, 'conversation.updatedAt'),
    messages,
    memories,
    emotion,
    moodSnapshots,
  }
}

export function assertImportPayload(input: unknown): UserExportContract {
  if (!isObject(input)) throw new AppError(422, 'IMPORT_SCHEMA_REJECTED', '导入数据必须是 JSON 对象')
  if (!Object.hasOwn(input, 'schemaVersion')) {
    throw new AppError(422, 'IMPORT_VERSION_MISSING', '缺少 schemaVersion，整批拒收')
  }
  const version = numberValue(input.schemaVersion, 'schemaVersion')
  if (version > IMPORT_SCHEMA_VERSION) {
    throw new AppError(422, 'IMPORT_VERSION_UNSUPPORTED', `schemaVersion ${version} 高于当前支持的 ${IMPORT_SCHEMA_VERSION}`, {
      received: version,
      supported: IMPORT_SCHEMA_VERSION,
    })
  }
  if (input.format !== IMPORT_FORMAT) schemaRejected('format 必须是 xinban-json')
  const conversations = arrayValue<unknown>(input.conversations, 'conversations').map(parseConversation)

  const conversationIds = new Set<string>()
  const messageIds = new Set<string>()
  const memoryIds = new Set<string>()
  const moodIds = new Set<string>()
  const mutationIds = new Set<string>()
  const correctionIds = new Set<number>()
  for (const conversation of conversations) {
    if (conversation.mode !== 'SINGLE' && conversation.mode !== 'MULTI') schemaRejected('conversation.mode 只允许 SINGLE/MULTI')
    if (conversation.mode === 'SINGLE' && !conversation.characterId) schemaRejected('SINGLE conversation 缺少 characterId')
    if (!conversationIds.add(conversation.id)) schemaRejected('conversation.id 在批次内重复')
    for (const message of conversation.messages) {
      if (!['USER', 'ASSISTANT', 'SYSTEM'].includes(message.role)) schemaRejected('message.role 不合法')
      if (!messageIds.add(message.id)) schemaRejected('message.id 在批次内重复')
      if (message.metadata === undefined) schemaRejected('message.metadata 必须是对象')
    }
    for (const memory of conversation.memories) {
      if (!['ACTIVE', 'QUARANTINED'].includes(memory.status)) schemaRejected('memory.status 不合法')
      if (!memoryIds.add(memory.id)) schemaRejected('memory.id 在批次内重复')
      if (memory.sourceMessageId && !conversation.messages.some((message) => message.id === memory.sourceMessageId)) {
        schemaRejected('memory.sourceMessageId 引用不存在', { memoryId: memory.id })
      }
    }
    for (const mood of conversation.moodSnapshots) {
      if (!['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(mood.mood)) schemaRejected('mood 值不合法')
      if (!moodIds.add(mood.id)) schemaRejected('moodSnapshot.id 在批次内重复')
      if (mood.memoryId && !conversation.memories.some((memory) => memory.id === mood.memoryId)) {
        schemaRejected('moodSnapshot.memoryId 引用不存在', { moodId: mood.id })
      }
      if (mood.sourceMessageId && !conversation.messages.some((message) => message.id === mood.sourceMessageId)) {
        schemaRejected('moodSnapshot.sourceMessageId 引用不存在', { moodId: mood.id })
      }
      for (const correction of mood.corrections) {
        if (!['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(correction.mood)) schemaRejected('correction.mood 不合法')
        if (!correctionIds.add(correction.id)) schemaRejected('correction.id 在批次内重复')
        if (correction.clientMutationId && !mutationIds.add(correction.clientMutationId)) {
          schemaRejected('clientMutationId 在批次内重复')
        }
      }
    }
  }

  return {
    schemaVersion: version as typeof IMPORT_SCHEMA_VERSION,
    format: input.format as typeof IMPORT_FORMAT,
    exportedAt: isoDate(input.exportedAt, 'exportedAt'),
    conversations,
  }
}
