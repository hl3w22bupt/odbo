/**
 * 心伴AI · 对话路由
 * 单角色 / 多角色同台 / 会话管理 / 消息轮询
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { ok, created } from '../lib/response.js'
import { authenticate } from '../http.js'
import { AppError } from '../lib/errors.js'
import { consumeQuota, getQuotaStatus } from '../lib/quota.js'
import { checkAntiAddiction } from '../lib/antiAddiction.js'
import { filterContent } from '../lib/contentFilter.js'
import { contentAudit } from '../lib/audit.js'
import {
  runTypingAndReply,
  runMultiReplies,
  type ReplyContext,
} from '../lib/chatEngine.js'
import { getAffectionsForUser } from '../lib/affection.js'
import { hasActiveMembership } from '../lib/quota.js'
import { logger } from '../lib/logger.js'
import {
  createEmotion,
  deleteEmotion,
  getEmotion,
  safeUpsertEmotionFromContent,
  updateEmotion,
  EMOTION_STATES,
  type EmotionInput,
} from '../lib/emotion.js'

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

function serializeMessage(m: {
  id: string
  conversationId: string
  characterId: string | null
  role: string
  content: string
  status: string
  type: string
  metadata: string
  createdAt: Date
}) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    characterId: m.characterId,
    role: m.role,
    content: m.content,
    status: m.status,
    type: m.type,
    metadata: safeJson(m.metadata),
    createdAt: m.createdAt,
  }
}

async function createConversation(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const body = ctx.body as { characterId?: string; mode?: string; title?: string }
  const mode = body.mode === 'MULTI' ? 'MULTI' : 'SINGLE'

  if (mode === 'SINGLE') {
    if (!body.characterId) throw AppError.badRequest('单角色模式需要 characterId')
    const character = await prisma.character.findUnique({ where: { id: body.characterId } })
    if (!character || character.status !== 'ACTIVE') throw AppError.notFound('角色不存在')
    const isMember = await hasActiveMembership(user.id)
    if (character.isMemberOnly && !isMember) {
      throw AppError.memberRequired('该角色为会员专属，开通会员后可解锁')
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      characterId: mode === 'SINGLE' ? (body.characterId ?? null) : null,
      mode,
      title: typeof body.title === 'string' ? body.title.slice(0, 50) : null,
    },
  })
  return created({ ...conversation, messages: [] })
}

async function listConversations(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const page = Math.max(1, Number.parseInt(ctx.query.page ?? '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(ctx.query.pageSize ?? '20', 10) || 20))
  const mode = ctx.query.mode

  const where: Record<string, unknown> = { userId: user.id, status: 'ACTIVE' }
  if (mode === 'SINGLE' || mode === 'MULTI') where.mode = mode

  const [total, items] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { character: true },
    }),
  ])

  const data = items.map((c) => ({
    id: c.id,
    mode: c.mode,
    title: c.title,
    characterId: c.characterId,
    character: c.character
      ? { id: c.character.id, name: c.character.name, title: c.character.title, avatarUrl: c.character.avatarUrl }
      : null,
    lastMessageAt: c.lastMessageAt,
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
  }))

  return ok({ items: data, total, page, pageSize })
}

async function conversationDetail(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const id = ctx.params.id
  if (!id) throw AppError.badRequest('缺少会话 id')
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: user.id },
    include: { character: true },
  })
  if (!conversation) throw AppError.notFound('会话不存在')
  return ok({
    id: conversation.id,
    mode: conversation.mode,
    title: conversation.title,
    characterId: conversation.characterId,
    character: conversation.character
      ? { id: conversation.character.id, name: conversation.character.name, title: conversation.character.title }
      : null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  })
}

/**
 * 消息轮询：GET /conversations/:id/messages?after=<messageId>&limit=50
 * 兼容"消息落库 + 前端轮询"兜底方案（输入中状态通过 status=TYPING 呈现）。
 */
async function listMessages(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const id = ctx.params.id
  if (!id) throw AppError.badRequest('缺少会话 id')
  const limit = Math.min(100, Math.max(1, Number.parseInt(ctx.query.limit ?? '50', 10) || 50))
  const after = ctx.query.after

  const conversation = await prisma.conversation.findFirst({ where: { id, userId: user.id } })
  if (!conversation) throw AppError.notFound('会话不存在')

  const where: Record<string, unknown> = { conversationId: id }
  if (after) {
    const afterMsg = await prisma.message.findUnique({ where: { id: after } })
    if (afterMsg) {
      where.createdAt = { gt: afterMsg.createdAt }
    }
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  return ok({
    conversationId: id,
    items: messages.map(serializeMessage),
    hasMore: messages.length >= limit,
  })
}

/**
 * 单角色聊天发送。
 * 返回用户消息 + 输入中的占位回复（TYPING），后台异步生成回复。
 */
async function chatSend(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const body = ctx.body as { conversationId?: string; characterId?: string; content?: string }
  const content = (body.content ?? '').trim()
  if (!body.characterId) throw AppError.badRequest('缺少 characterId')
  if (!content) throw AppError.badRequest('消息内容不能为空')
  if (content.length > 2000) throw AppError.badRequest('消息过长（最多 2000 字）')

  const character = await prisma.character.findUnique({ where: { id: body.characterId } })
  if (!character || character.status !== 'ACTIVE') throw AppError.notFound('角色不存在')

  const [isMember, antiAddiction] = await Promise.all([
    hasActiveMembership(user.id),
    checkAntiAddiction(user.id),
  ])
  if (character.isMemberOnly && !isMember) {
    throw AppError.memberRequired('该角色为会员专属，开通会员后可解锁')
  }
  if (antiAddiction.blocked) {
    throw AppError.antiAddiction(antiAddiction.message ?? '请稍后再试', { reason: antiAddiction.reason })
  }

  // 输入内容过滤
  const inputFilter = await filterContent(content)
  if (inputFilter.blocked) {
    await contentAudit({
      userId: user.id,
      direction: 'IN',
      content,
      result: 'BLOCK',
      matchedWord: inputFilter.matched.join(','),
    })
    throw AppError.contentBlocked()
  }
  const safeContent = inputFilter.matched.length > 0 ? inputFilter.filtered : content
  if (inputFilter.matched.length > 0) {
    await contentAudit({
      userId: user.id,
      direction: 'IN',
      content: safeContent,
      result: 'REPLACED',
      matchedWord: inputFilter.matched.join(','),
    })
  }

  // 配额
  const quota = await consumeQuota(user.id)

  // 会话（复用或新建）
  let conversation: { id: string }
  if (body.conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: body.conversationId, userId: user.id, status: 'ACTIVE' },
    })
    if (!existing) throw AppError.notFound('会话不存在')
    conversation = existing
  } else {
    conversation = await prisma.conversation.create({
      data: { userId: user.id, characterId: character.id, mode: 'SINGLE', title: character.title },
    })
  }

  const [userMessage, pendingMessage] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: user.id,
        characterId: character.id,
        role: 'USER',
        content: safeContent,
        status: 'COMPLETED',
        type: 'TEXT',
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: user.id,
        characterId: character.id,
        role: 'ASSISTANT',
        content: '',
        status: 'TYPING',
        type: 'TEXT',
      },
    }),
  ])

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  })
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })

  // 情绪是伴生数据：真实持久层失败时只降级记日志，不影响已落库的消息与响应。
  await safeUpsertEmotionFromContent(conversation.id, safeContent)

  // 后台生成回复
  const ctx2: ReplyContext = {
    conversationId: conversation.id,
    userId: user.id,
    characterId: character.id,
    messageId: pendingMessage.id,
  }
  void runTypingAndReply(ctx2).catch((err) => logger.error('[chat] background reply failed', { err: String(err) }))

  const affection = await getAffectionsForUser(user.id, [character.id])

  return ok(
    {
      conversationId: conversation.id,
      userMessage: serializeMessage(userMessage),
      assistantMessage: serializeMessage(pendingMessage),
      quota: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        unlimited: quota.unlimited,
      },
      affection: affection[character.id],
      typing: true,
    },
    '消息已发送，回复生成中',
  )
}

/**
 * 多角色同台发送。
 * 返回用户消息 + 每位伴友的输入中占位回复 + 好感度进度条。
 */
async function chatMultiSend(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const body = ctx.body as { conversationId?: string; characterIds?: string[]; content?: string }
  const content = (body.content ?? '').trim()
  const characterIds = Array.isArray(body.characterIds) ? [...new Set(body.characterIds)] : []
  if (characterIds.length < 2) throw AppError.badRequest('多角色模式至少需要 2 位伴友')
  if (characterIds.length > 4) throw AppError.badRequest('一次最多 4 位伴友同台')
  if (!content) throw AppError.badRequest('消息内容不能为空')

  const [isMember, antiAddiction] = await Promise.all([
    hasActiveMembership(user.id),
    checkAntiAddiction(user.id),
  ])
  if (antiAddiction.blocked) {
    throw AppError.antiAddiction(antiAddiction.message ?? '请稍后再试', { reason: antiAddiction.reason })
  }

  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds }, status: 'ACTIVE' },
  })
  if (characters.length !== characterIds.length) throw AppError.notFound('部分角色不存在')

  const lockedCharacter = characters.find((c) => c.isMemberOnly)
  if (lockedCharacter && !isMember) {
    throw AppError.memberRequired(`角色「${lockedCharacter.name}」为会员专属`)
  }

  // 输入内容过滤
  const inputFilter = await filterContent(content)
  if (inputFilter.blocked) {
    await contentAudit({ userId: user.id, direction: 'IN', content, result: 'BLOCK', matchedWord: inputFilter.matched.join(',') })
    throw AppError.contentBlocked()
  }
  const safeContent = inputFilter.matched.length > 0 ? inputFilter.filtered : content
  if (inputFilter.matched.length > 0) {
    await contentAudit({ userId: user.id, direction: 'IN', content: safeContent, result: 'REPLACED', matchedWord: inputFilter.matched.join(',') })
  }

  const quota = await consumeQuota(user.id)

  let conversation: { id: string }
  if (body.conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: body.conversationId, userId: user.id, status: 'ACTIVE', mode: 'MULTI' },
    })
    if (!existing) throw AppError.notFound('会话不存在')
    conversation = existing
  } else {
    conversation = await prisma.conversation.create({
      data: { userId: user.id, characterId: null, mode: 'MULTI', title: '多人同台' },
    })
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      userId: user.id,
      characterId: null,
      role: 'USER',
      content: safeContent,
      status: 'COMPLETED',
      type: 'TEXT',
    },
  })

  // 为每位伴友创建 TYPING 占位
  const pendingMessages = await prisma.$transaction(
    characters.map((c) =>
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId: user.id,
          characterId: c.id,
          role: 'ASSISTANT',
          content: '',
          status: 'TYPING',
          type: 'TEXT',
        },
      }),
    ),
  )

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  })
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })

  // 各伴友互相知晓在场他人 → 性格隐性博弈
  const othersByChar = new Map<string, Array<{ id: string; name: string; title: string; type: string }>>()
  for (const c of characters) {
    othersByChar.set(
      c.id,
      characters.filter((o) => o.id !== c.id).map((o) => ({ id: o.id, name: o.name, title: o.title, type: o.type })),
    )
  }

  const contexts: ReplyContext[] = characters.map((c, i) => ({
    conversationId: conversation.id,
    userId: user.id,
    characterId: c.id,
    messageId: pendingMessages[i]!.id,
    ...(othersByChar.get(c.id) ? { includeOthers: othersByChar.get(c.id)! } : {}),
  }))

  // 好感度增减：对话型伴友小幅上涨
  const deltas: Record<string, number> = {}
  for (const c of characters) deltas[c.id] = c.type === 'POSSESSIVE' ? 3 : 2
  void runMultiReplies(contexts, deltas).catch((err) =>
    logger.error('[chat] multi reply failed', { err: String(err) }),
  )

  const affections = await getAffectionsForUser(
    user.id,
    characters.map((c) => c.id),
  )

  return ok(
    {
      conversationId: conversation.id,
      userMessage: serializeMessage(userMessage),
      characters: characters.map((c, i) => ({
        characterId: c.id,
        name: c.name,
        title: c.title,
        type: c.type,
        assistantMessage: serializeMessage(pendingMessages[i]!),
        affection: affections[c.id] ?? { value: 0, level: 1, progress: 0 },
      })),
      quota: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        unlimited: quota.unlimited,
      },
      typing: true,
    },
    '多角色消息已发送',
  )
}

/**
 * 主动分享见闻（内部函数，供 cron 触发；同时暴露为可手动触发的接口用于演示）。
 */
async function proactiveShareNow(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const characterId = ctx.body?.characterId as string | undefined
  const character = await prisma.character.findUnique({ where: { id: characterId ?? '' } })
  if (!character) throw AppError.notFound('角色不存在')

  const conversation = await prisma.conversation.findFirst({
    where: { userId: user.id, characterId: character.id, status: 'ACTIVE', mode: 'SINGLE' },
    orderBy: { updatedAt: 'desc' },
  })
  if (!conversation) throw AppError.notFound('暂无会话，请先开始聊天')

  const { insertProactiveMessage, generateReply } = await import('../lib/chatEngine.js')
  const placeholder = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      userId: user.id,
      characterId: character.id,
      role: 'ASSISTANT',
      content: '',
      status: 'TYPING',
      type: 'PROACTIVE',
    },
  })
  void generateReply({
    conversationId: conversation.id,
    userId: user.id,
    characterId: character.id,
    messageId: placeholder.id,
  }).catch(() => insertProactiveMessage({
    conversationId: conversation.id,
    userId: user.id,
    characterId: character.id,
    content: '（我刚刚看到窗外的晚霞，突然想跟你分享这一刻。）',
  }))

  return ok({ triggered: true, messageId: placeholder.id }, '已触发主动分享')
}

function parseEmotionBody(body: Record<string, unknown>): EmotionInput {
  const emotion = body.emotion
  if (typeof emotion !== 'string' || !(EMOTION_STATES as readonly string[]).includes(emotion)) {
    throw AppError.badRequest('emotion 不合法')
  }
  const rawScore = body.score ?? 0
  if (typeof rawScore !== 'number' || !Number.isFinite(rawScore)) {
    throw AppError.badRequest('score 必须是有限数字')
  }
  const rawVersion = body.version ?? 1
  if (typeof rawVersion !== 'number' || !Number.isInteger(rawVersion) || rawVersion < 1) {
    throw AppError.badRequest('version 必须是正整数')
  }
  if (body.payload != null && (typeof body.payload !== 'object' || Array.isArray(body.payload))) {
    throw AppError.badRequest('payload 必须是对象')
  }
  return {
    emotion: emotion as EmotionInput['emotion'],
    score: Math.max(-1, Math.min(1, rawScore)),
    version: rawVersion,
    payload: (body.payload ?? {}) as Record<string, unknown>,
  }
}

async function requireOwnedConversation(id: string | undefined, userId: string) {
  if (!id) throw AppError.badRequest('缺少会话 id')
  const conversation = await prisma.conversation.findFirst({ where: { id, userId } })
  if (!conversation) throw AppError.notFound('会话不存在')
  return conversation
}

async function createConversationEmotion(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const conversation = await requireOwnedConversation(ctx.params.id, user.id)
  const input = parseEmotionBody(ctx.body)
  const item = await createEmotion(conversation.id, input)
  return created(item)
}

async function getConversationEmotion(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const conversation = await requireOwnedConversation(ctx.params.id, user.id)
  return ok(await getEmotion(conversation.id))
}

async function updateConversationEmotion(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const conversation = await requireOwnedConversation(ctx.params.id, user.id)
  const input = parseEmotionBody(ctx.body)
  return ok(await updateEmotion(conversation.id, input))
}

async function deleteConversationEmotion(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const conversation = await requireOwnedConversation(ctx.params.id, user.id)
  await deleteEmotion(conversation.id)
  return ok({ conversationId: conversation.id, deleted: true })
}

export function registerChatRoutes(router: HttpRouter): void {
  router.define('chat::create-conversation', '/api/v1/conversations', 'POST', createConversation)
  router.define('chat::list-conversations', '/api/v1/conversations', 'GET', listConversations)
  router.define('chat::conversation-detail', '/api/v1/conversations/:id', 'GET', conversationDetail)
  router.define('chat::list-messages', '/api/v1/conversations/:id/messages', 'GET', listMessages)
  router.define('chat::send', '/api/v1/chat/send', 'POST', chatSend)
  router.define('chat::multi-send', '/api/v1/chat/multi/send', 'POST', chatMultiSend)
  router.define('chat::proactive-now', '/api/v1/chat/proactive', 'POST', proactiveShareNow)
  router.define('chat::emotion-create', '/api/v1/conversations/:id/emotion', 'POST', createConversationEmotion)
  router.define('chat::emotion-read', '/api/v1/conversations/:id/emotion', 'GET', getConversationEmotion)
  router.define('chat::emotion-update', '/api/v1/conversations/:id/emotion', 'PATCH', updateConversationEmotion)
  router.define('chat::emotion-delete', '/api/v1/conversations/:id/emotion', 'DELETE', deleteConversationEmotion)
}
