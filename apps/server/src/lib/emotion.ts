/**
 * 心伴 v0.2 · 会话情绪伴生态持久化
 * 会话/消息是主链路；本模块写入失败只记录日志，不得阻断聊天响应。
 */
import { prisma } from '../db.js'
import { AppError } from './errors.js'
import { logger } from './logger.js'

export const EMOTION_STATES = ['NEUTRAL', 'POSITIVE', 'CALM', 'ANXIOUS', 'SAD'] as const
export type EmotionState = (typeof EMOTION_STATES)[number]

export interface EmotionInput {
  emotion: EmotionState
  score: number
  version?: number
  payload?: Record<string, unknown>
}

export interface EmotionRecord extends Required<EmotionInput> {
  conversationId: string
}

export interface PersistedEmotionRow {
  conversationId: string
  emotion: string
  score: number
  version: number
  payload: string
}

export const DEFAULT_EMOTION: EmotionRecord = Object.freeze({
  conversationId: '',
  emotion: 'NEUTRAL',
  score: 0,
  version: 1,
  payload: {},
})

function isEmotionState(value: unknown): value is EmotionState {
  return typeof value === 'string' && (EMOTION_STATES as readonly string[]).includes(value)
}

function normalizePayload(value: unknown): Record<string, unknown> {
  if (value == null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

/** 旧/坏数据兼容策略：不可识别值一律丢弃，回退默认伴生态。 */
export function normalizeEmotion(value: unknown, conversationId = ''): EmotionRecord {
  const raw = value as Partial<EmotionInput> | null | undefined
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_EMOTION, conversationId }
  if (!isEmotionState(raw.emotion)) return { ...DEFAULT_EMOTION, conversationId }

  const score = typeof raw.score === 'number' && Number.isFinite(raw.score) ? raw.score : 0
  const version = typeof raw.version === 'number' && Number.isInteger(raw.version) && raw.version > 0
    ? raw.version
    : 1

  return {
    conversationId,
    emotion: raw.emotion,
    score: Math.max(-1, Math.min(1, score)),
    version,
    payload: normalizePayload(raw.payload),
  }
}

function toCreateData(conversationId: string, input: EmotionInput) {
  const normalized = normalizeEmotion({ ...input, conversationId }, conversationId)
  return {
    conversationId,
    emotion: normalized.emotion,
    score: normalized.score,
    version: normalized.version,
    payload: JSON.stringify(normalized.payload),
  }
}

function normalizePersisted(row: PersistedEmotionRow): EmotionRecord {
  let payload: unknown
  try {
    payload = JSON.parse(row.payload)
  } catch {
    payload = row.payload
  }
  return normalizeEmotion({ ...row, payload }, row.conversationId)
}

export async function createEmotion(conversationId: string, input: EmotionInput) {
  if (!conversationId) throw AppError.badRequest('缺少会话 id')
  try {
    return normalizePersisted(await prisma.conversationEmotion.create({ data: toCreateData(conversationId, input) }))
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw AppError.conflict('该会话已有情绪伴生态')
    }
    throw err
  }
}

export async function getEmotion(conversationId: string) {
  if (!conversationId) throw AppError.badRequest('缺少会话 id')
  const row = await prisma.conversationEmotion.findUnique({ where: { conversationId } })
  if (!row) return { ...DEFAULT_EMOTION, conversationId }
  return normalizePersisted(row)
}

export async function updateEmotion(conversationId: string, input: EmotionInput) {
  if (!conversationId) throw AppError.badRequest('缺少会话 id')
  const normalized = normalizeEmotion({ ...input, conversationId }, conversationId)
  try {
    return normalizePersisted(await prisma.conversationEmotion.update({
      where: { conversationId },
      data: {
        emotion: normalized.emotion,
        score: normalized.score,
        version: normalized.version,
        payload: JSON.stringify(normalized.payload),
      },
    }))
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      throw AppError.notFound('情绪伴生态不存在')
    }
    throw err
  }
}

export async function upsertEmotion(conversationId: string, input: EmotionInput) {
  if (!conversationId) throw AppError.badRequest('缺少会话 id')
  return normalizePersisted(await prisma.conversationEmotion.upsert({
    where: { conversationId },
    update: toCreateData(conversationId, input),
    create: toCreateData(conversationId, input),
  }))
}

export async function deleteEmotion(conversationId: string) {
  if (!conversationId) throw AppError.badRequest('缺少会话 id')
  try {
    await prisma.conversationEmotion.delete({ where: { conversationId } })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      throw AppError.notFound('情绪伴生态不存在')
    }
    throw err
  }
  return true
}

export async function safeUpsertEmotionFromContent(
  conversationId: string,
  content: string,
): Promise<boolean> {
  try {
    const emotion = classifyEmotion(content)
    await upsertEmotion(conversationId, emotion)
    return true
  } catch (err) {
    logger.warn('[emotion] 伴生态写入失败，主链路继续', {
      conversationId,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

/** 确定性关键词分类，保证离线冒烟与测试可重复。 */
export function classifyEmotion(content: string): EmotionInput {
  const text = content.toLowerCase()
  if (/(开心|高兴|谢谢|感谢|幸福|happy|thank)/.test(text)) {
    return { emotion: 'POSITIVE', score: 0.8, version: 1, payload: { source: 'keyword' } }
  }
  if (/(焦虑|担心|害怕|紧张|anxious|worried)/.test(text)) {
    return { emotion: 'ANXIOUS', score: -0.6, version: 1, payload: { source: 'keyword' } }
  }
  if (/(难过|孤独|伤心|sad|lonely)/.test(text)) {
    return { emotion: 'SAD', score: -0.7, version: 1, payload: { source: 'keyword' } }
  }
  if (/(平静|放松|休息|calm|relax)/.test(text)) {
    return { emotion: 'CALM', score: 0.3, version: 1, payload: { source: 'keyword' } }
  }
  return { emotion: 'NEUTRAL', score: 0, version: 1, payload: { source: 'keyword' } }
}
