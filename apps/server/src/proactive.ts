/**
 * 心伴AI · 主动分享见闻（定时推送）
 * 通过 iii cron trigger 周期触发：扫描符合条件的会话，让伴友主动分享生活见闻。
 */
import type { IIIClient } from 'iii-sdk'
import { prisma } from './db.js'
import { config } from './config.js'
import { logger } from './lib/logger.js'
import { getLlmProvider, fallbackReply, type ChatMessage } from './lib/llm.js'
import { buildSystemPrompt } from './lib/characters.js'
import type { ReplyContext } from './lib/chatEngine.js'
const PROACTIVE_SYSTEM_HINT = `
（这是主动分享场景）不要用问候语开头，不要问对方"在不在"。直接自然地分享一件你今天遇到的生活见闻、一个念头或一段心情，像老朋友随口提起一样，字数 30-90 字。结尾可以轻轻带一句，但不要逼对方回复。`

/**
 * cron 触发的主处理函数。
 * 逐会话检查：距离上条用户消息超过阈值、且用户侧最近一条是用户消息、且当前无进行中的回复。
 */
export async function runProactiveShare(): Promise<number> {
  const idleMs = config.proactiveShareIdleMin * 60_000
  const cutoff = new Date(Date.now() - idleMs)

  const conversations = await prisma.conversation.findMany({
    where: {
      status: 'ACTIVE',
      lastMessageAt: { lt: cutoff },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
  })

  let triggered = 0
  for (const conversation of conversations) {
    try {
      // 最近一条消息必须存在，且不为进行中的占位消息
      const lastMsg = await prisma.message.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
      })
      if (!lastMsg || lastMsg.status === 'TYPING' || lastMsg.status === 'PENDING') continue

      // 单角色模式需要角色
      if (conversation.mode === 'SINGLE' && !conversation.characterId) continue
      if (conversation.mode === 'MULTI') continue // 多角色主动分享复杂度高，先跳过

      // 检查该会话近 30 分钟是否已有主动分享
      const recentProactive = await prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
          type: 'PROACTIVE',
          createdAt: { gt: new Date(Date.now() - 30 * 60_000) },
        },
      })
      if (recentProactive) continue

      const character = conversation.characterId
        ? await prisma.character.findUnique({ where: { id: conversation.characterId } })
        : null
      if (!character) continue

      // 生成主动消息：先占位 TYPING，再异步完成（或直接生成）
      const placeholder = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId: conversation.userId,
          characterId: character.id,
          role: 'ASSISTANT',
          content: '',
          status: 'TYPING',
          type: 'PROACTIVE',
        },
      })

      const custom = await prisma.characterCustomization.findUnique({
        where: { userId_characterId: { userId: conversation.userId, characterId: character.id } },
      })

      const context: ReplyContext = {
        conversationId: conversation.id,
        userId: conversation.userId,
        characterId: character.id,
        messageId: placeholder.id,
        customName: custom?.customName ?? null,
      }

      void (async () => {
        try {
          const history = await buildHistoryForProactive(conversation.id)
          const provider = getLlmProvider()
          let reply: string
          if (provider.isConfigured()) {
            const customName = custom?.customName ?? undefined
            const charForPrompt: { name: string; title: string; type: string; dialect: string; occupation: string; personality: string; customName?: string } = {
              name: character.name,
              title: character.title,
              type: character.type,
              dialect: character.dialect,
              occupation: character.occupation,
              personality: character.personality,
              ...(customName !== undefined ? { customName } : {}),
            }
            const system = buildSystemPrompt(charForPrompt) + PROACTIVE_SYSTEM_HINT
            reply = await provider.chat({ system, messages: history, temperature: 0.9, maxTokens: 200 })
          } else {
            reply = fallbackReply(custom?.customName || character.name, '主动分享')
          }
          await prisma.message.update({
            where: { id: placeholder.id },
            data: { content: reply, status: 'COMPLETED' },
          })
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
          })
          triggered += 1
          logger.info('[proactive] 主动分享已发送', { conversationId: conversation.id, characterId: character.id })
        } catch (err) {
          logger.warn('[proactive] 主动分享生成失败', { err: String(err), conversationId: conversation.id })
          await prisma.message.update({
            where: { id: placeholder.id },
            data: { status: 'FAILED', content: '' },
          })
        }
      })()
    } catch (err) {
      logger.warn('[proactive] 处理会话失败', { err: String(err), conversationId: conversation.id })
    }
  }
  return triggered
}

async function buildHistoryForProactive(conversationId: string, limit = 8): Promise<ChatMessage[]> {
  const rows = await prisma.message.findMany({
    where: { conversationId, status: 'COMPLETED', type: { not: 'PROACTIVE' } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  const messages: ChatMessage[] = []
  for (const row of rows.reverse()) {
    if (row.role === 'USER') messages.push({ role: 'user', content: row.content })
    else if (row.role === 'ASSISTANT') messages.push({ role: 'assistant', content: row.content })
  }
  return messages
}

/**
 * 注册 cron 触发器（每 PROACTIVE_SHARE_INTERVAL_MIN 分钟）。
 * 同时注册一个可手动调用的内部函数（调试）。
 */
export function registerProactiveCron(worker: IIIClient): void {
  worker.registerFunction('chat::proactive-share', async () => {
    const count = await runProactiveShare()
    return { status_code: 200, body: { code: 'OK', data: { triggered: count } }, headers: {} }
  })

  const expression = `0 */${Math.max(1, Math.min(59, config.proactiveShareIntervalMin))} * * * *`
  worker.registerTrigger({
    type: 'cron',
    function_id: 'chat::proactive-share',
    config: { expression },
  })
  logger.info(`[cron] 主动分享见闻已注册：${expression}`)
}
