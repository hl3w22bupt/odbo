/**
 * 心伴 v0.5 · 情绪修正追加契约
 * 原始 MoodSnapshot 不可变；这里只定义白名单、latest-wins 和降级读契约。
 */
import { AppError } from './errors.js'
import type { ConversationMood, MoodSnapshotContract } from './conversationInsights.js'

export const CORRECTION_MOODS: ConversationMood[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE']
export const CORRECTION_TAG_LIMIT = 3
export const CORRECTION_TAG_LENGTH = 20
export const CORRECTION_REASON_LENGTH = 160
export const CORRECTION_MUTATION_ID_LENGTH = 64

export interface MoodCorrectionInput {
  mood: ConversationMood
  score: -1 | 0 | 1
  tags: string[]
  reason: string
  clientMutationId: string | null
}

export interface MoodCorrectionContract {
  id: number
  conversationId: string
  userId: string
  moodSnapshotId: string
  mood: ConversationMood
  score: -1 | 0 | 1
  tags: string[]
  reason: string
  clientMutationId: string | null
  createdAt: string
}

export type CorrectedMoodPoint = MoodSnapshotContract & {
  tags: string[]
  reason: string
  originalMood: ConversationMood | null
  originalScore: -1 | 0 | 1 | null
  correctionId: number | null
  correctedAt: string | null
}

export interface CorrectionWriteReadContract {
  correction: MoodCorrectionContract | null
  persisted: boolean
  degraded: boolean
}

function invalid(message: string): never {
  throw AppError.badRequest(message)
}

function normalizeTags(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) return invalid('tags 必须是字符串数组')
  if (value.length > CORRECTION_TAG_LIMIT) return invalid(`tags 最多 ${CORRECTION_TAG_LIMIT} 个`)
  const tags = value.map((tag) => {
    if (typeof tag !== 'string') return invalid('tags 必须是字符串数组')
    const normalized = tag.trim()
    if (normalized.length < 1 || normalized.length > CORRECTION_TAG_LENGTH) {
      return invalid(`每个标签必须是 1-${CORRECTION_TAG_LENGTH} 字`)
    }
    return normalized
  })
  return tags
}

function normalizeText(value: unknown, field: string, max: number, required = false): string {
  if (value == null) {
    if (required) return invalid(`${field} 不能为空`)
    return ''
  }
  if (typeof value !== 'string') return invalid(`${field} 必须是字符串`)
  const normalized = value.trim()
  if (required && normalized.length === 0) return invalid(`${field} 不能为空`)
  if (normalized.length > max) return invalid(`${field} 最多 ${max} 字`)
  return normalized
}

export function normalizeCorrectionInput(input: unknown): MoodCorrectionInput {
  const raw = input as Record<string, unknown> | null | undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid('修正输入必须是对象')
  const mood = raw.mood
  if (!CORRECTION_MOODS.includes(mood as ConversationMood)) {
    return invalid('mood 必须是 POSITIVE、NEUTRAL 或 NEGATIVE')
  }
  const score = mood === 'POSITIVE' ? 1 : mood === 'NEGATIVE' ? -1 : 0
  return {
    mood: mood as ConversationMood,
    score,
    tags: normalizeTags(raw.tags),
    reason: normalizeText(raw.reason, 'reason', CORRECTION_REASON_LENGTH),
    clientMutationId:
      raw.clientMutationId == null ? null : normalizeText(raw.clientMutationId, 'clientMutationId', CORRECTION_MUTATION_ID_LENGTH),
  }
}

export function serializeCorrection(row: {
  id: number
  conversationId: string
  userId: string
  moodSnapshotId: string
  mood: string
  score: number
  tags: string | string[]
  reason: string
  clientMutationId: string | null
  createdAt: Date
}): MoodCorrectionContract {
  const mood: ConversationMood =
    row.mood === 'POSITIVE' ? 'POSITIVE' : row.mood === 'NEGATIVE' ? 'NEGATIVE' : 'NEUTRAL'
  const tags = Array.isArray(row.tags)
    ? row.tags.filter(Boolean)
    : row.tags.split(',').filter(Boolean)
  return {
    id: row.id,
    conversationId: row.conversationId,
    userId: row.userId,
    moodSnapshotId: row.moodSnapshotId,
    mood,
    score: row.score > 0 ? 1 : row.score < 0 ? -1 : 0,
    tags,
    reason: row.reason,
    clientMutationId: row.clientMutationId,
    createdAt: row.createdAt.toISOString(),
  }
}

export function applyLatestCorrection(
  point: MoodSnapshotContract,
  correction: MoodCorrectionContract | null,
): CorrectedMoodPoint {
  if (!correction) {
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
  return {
    ...point,
    mood: correction.mood,
    score: correction.score,
    tags: correction.tags,
    reason: correction.reason,
    originalMood: point.mood,
    originalScore: point.score,
    correctionId: correction.id,
    correctedAt: correction.createdAt,
  }
}

export function correctionWriteSuccess(
  correction: MoodCorrectionContract,
): CorrectionWriteReadContract {
  return { correction, persisted: true, degraded: false }
}

export function readableCorrection(
  correction: MoodCorrectionContract | null,
): CorrectionWriteReadContract {
  return correction
    ? { correction, persisted: true, degraded: false }
    : { correction: null, persisted: false, degraded: true }
}
