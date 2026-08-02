/**
 * 心伴AI · 对话引擎
 * 异步生成回复：随机回复间隔(1-3s) + 输入中状态 + LLM 调用 + 内容过滤。
 * 前端通过消息轮询获取 TYPING → COMPLETED 状态流转。
 */
import { prisma } from '../db.js'
import { config } from '../config.js'
import { getLlmProvider, fallbackReply, type ChatMessage } from './llm.js'
import { buildSystemPrompt, buildMultiSystemPrompt } from './characters.js'
import { filterContent, blockedFallbackReply } from './contentFilter.js'
import { contentAudit } from './audit.js'
import { changeAffection } from './affection.js'
import { logger } from './logger.js'

export interface ReplyContext {
  conversationId: string
  userId: string
  characterId: string
  messageId: string // 待填充的 assistant 消息 id
  customName?: string | null
  includeOthers?: Array<{ id: string; name: string; title: string; type: string }>
}

export function randomReplyDelay(): number {
  const min = config.chatReplyDelayMinMs
  const max = config.chatReplyDelayMaxMs
  return min + Math.random() * Math.max(0, max - min)
}

/**
 * 构建历史消息（最近 N 条，去除未完成消息）。
 */
async function buildHistory(conversationId: string, limit = 12): Promise<ChatMessage[]> {
  const rows = await prisma.message.findMany({
    where: { conversationId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  const messages: ChatMessage[] = []
  for (const row of rows.reverse()) {
    const role = row.role === 'USER' ? 'user' : row.role === 'ASSISTANT' ? 'assistant' : 'system'
    if (role === 'user' || role === 'assistant') {
      messages.push({ role, content: row.content })
    }
  }
  return messages
}

/**
 * 生成单条回复并落库。
 * 供 chat::send / chat::multi / 主动分享 复用。
 */
export async function generateReply(ctx: ReplyContext): Promise<string> {
  const { userId, characterId, messageId, conversationId } = ctx
  const [character, custom, history] = await Promise.all([
    prisma.character.findUnique({ where: { id: characterId } }),
    prisma.characterCustomization.findUnique({
      where: { userId_characterId: { userId, characterId } },
    }),
    buildHistory(conversationId),
  ])

  if (!character) {
    await failMessage(messageId, '角色不存在')
    return ''
  }

  const userMessage = history.filter((m) => m.role === 'user').at(-1)?.content ?? ''

  const customName = custom?.customName ?? ctx.customName ?? undefined
  const charForPrompt: { name: string; title: string; type: string; dialect: string; occupation: string; personality: string; customName?: string } = {
    name: character.name,
    title: character.title,
    type: character.type,
    dialect: character.dialect,
    occupation: character.occupation,
    personality: character.personality,
    ...(customName !== undefined ? { customName } : {}),
  }

  const systemPrompt =
    ctx.includeOthers && ctx.includeOthers.length > 0
      ? buildMultiSystemPrompt(charForPrompt, ctx.includeOthers)
      : buildSystemPrompt(charForPrompt)

  let reply = ''
  try {
    const provider = getLlmProvider()
    if (provider.isConfigured()) {
      reply = await provider.chat({
        system: systemPrompt,
        messages: history,
        temperature: 0.85,
        maxTokens: 512,
      })
    } else {
      reply = fallbackReply(custom?.customName || character.name, userMessage)
    }
  } catch (err) {
    logger.warn('[chat] LLM 调用失败，使用回退回复', { err: String(err), characterId })
    reply = fallbackReply(custom?.customName || character.name, userMessage)
  }

  // 输出内容过滤：命中 BLOCK 词时使用回退文案
  const filtered = await filterContent(reply)
  if (filtered.blocked) {
    await contentAudit({
      userId,
      direction: 'OUT',
      content: reply,
      result: 'BLOCK',
      matchedWord: filtered.matched.join(','),
      messageId,
    })
    reply = blockedFallbackReply()
  } else if (filtered.matched.length > 0) {
    reply = filtered.filtered
    await contentAudit({
      userId,
      direction: 'OUT',
      content: filtered.filtered,
      result: 'REPLACED',
      matchedWord: filtered.matched.join(','),
      messageId,
    })
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { content: reply, status: 'COMPLETED' },
  })
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })
  return reply
}

/**
 * 记录回复失败（把 TYPING 消息置为 FAILED）。
 */
export async function failMessage(messageId: string, reason: string): Promise<void> {
  try {
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'FAILED', content: reason },
    })
  } catch {
    /* noop */
  }
}

/**
 * 输入中动画延迟后生成回复（后台任务）。
 */
export async function runTypingAndReply(ctx: ReplyContext): Promise<void> {
  try {
    const delay = randomReplyDelay()
    await sleep(delay)
    await generateReply(ctx)
  } catch (err) {
    logger.error('[chat] 异步回复失败', { err: String(err), messageId: ctx.messageId })
    await failMessage(ctx.messageId, '回复生成失败，请重试')
  }
}

/**
 * 多角色同台：各伴友按性格异步生成回复。
 */
export async function runMultiReplies(
  contexts: ReplyContext[],
  affectionDeltas: Record<string, number>,
): Promise<void> {
  const tasks = contexts.map(async (ctx) => {
    await sleep(randomReplyDelay() * (0.8 + Math.random() * 0.6))
    const reply = await generateReply(ctx)
    const delta = affectionDeltas[ctx.characterId] ?? 0
    if (delta !== 0) {
      await changeAffection(ctx.userId, ctx.characterId, delta)
    }
    return reply
  })
  await Promise.allSettled(tasks)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 更新主动分享见闻（类型标记 PROACTIVE） */
export async function insertProactiveMessage(opts: {
  conversationId: string
  userId: string
  characterId: string
  content: string
}): Promise<string> {
  const msg = await prisma.message.create({
    data: {
      conversationId: opts.conversationId,
      userId: opts.userId,
      characterId: opts.characterId,
      role: 'ASSISTANT',
      content: opts.content,
      status: 'COMPLETED',
      type: 'PROACTIVE',
      metadata: JSON.stringify({ proactive: true }),
    },
  })
  await prisma.conversation.update({
    where: { id: opts.conversationId },
    data: { lastMessageAt: new Date() },
  })
  return msg.id
}
