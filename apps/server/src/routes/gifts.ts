/**
 * 心伴AI · 礼物系统路由
 * 礼物列表（限量/会员锁）/ 送礼（即时情绪反馈：回语 + 好感度 + 浮动动画）
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { ok } from '../lib/response.js'
import { authenticate } from '../http.js'
import { AppError } from '../lib/errors.js'
import { audit } from '../lib/audit.js'
import { changeAffection, getAffectionsForUser } from '../lib/affection.js'
import { hasActiveMembership } from '../lib/quota.js'
import { logger } from '../lib/logger.js'

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

function serializeGift(g: {
  id: string
  name: string
  description: string | null
  price: number
  icon: string | null
  imageUrl: string | null
  isLimited: boolean
  memberOnly: boolean
  stock: number | null
}) {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    price: g.price,
    priceYuan: (g.price / 100).toFixed(2),
    icon: g.icon,
    imageUrl: g.imageUrl,
    isLimited: g.isLimited,
    memberOnly: g.memberOnly,
    stock: g.stock,
  }
}

async function listGifts(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const isMember = await hasActiveMembership(user.id)
  const gifts = await prisma.gift.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { price: 'asc' },
  })
  return ok(
    gifts.map((g) => ({
      ...serializeGift(g),
      locked: g.memberOnly && !isMember,
      unlockHint: g.memberOnly && !isMember ? '会员专属礼物' : undefined,
    })),
  )
}

/**
 * 送礼：返回符合人设的回语 + 好感度增减 + 浮动动画数据。
 */
async function sendGift(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const giftId = ctx.params.id
  if (!giftId) throw AppError.badRequest('缺少礼物 id')
  const body = ctx.body as { characterId?: string; quantity?: number }
  const characterId = body.characterId
  if (!characterId) throw AppError.badRequest('缺少 characterId')

  const [gift, character] = await Promise.all([
    prisma.gift.findUnique({ where: { id: giftId } }),
    prisma.character.findUnique({ where: { id: characterId } }),
  ])
  if (!gift || gift.status !== 'ACTIVE') throw AppError.notFound('礼物不存在')
  if (!character || character.status !== 'ACTIVE') throw AppError.notFound('角色不存在')

  const isMember = await hasActiveMembership(user.id)
  if (gift.memberOnly && !isMember) {
    throw AppError.memberRequired('该礼物为会员专属，开通会员后可赠送')
  }
  if (gift.isLimited && !isMember) {
    throw AppError.memberRequired('限量礼物需会员身份方可赠送')
  }
  if (gift.isLimited && gift.stock !== null && gift.stock <= 0) {
    throw AppError.conflict('该限量礼物已赠罄')
  }

  const quantity = Math.min(99, Math.max(1, body.quantity ?? 1))
  const amount = gift.price * quantity

  // 扣除限量库存
  if (gift.isLimited && gift.stock !== null) {
    const updated = await prisma.gift.updateMany({
      where: { id: gift.id, stock: { gt: 0 } },
      data: { stock: { decrement: quantity } },
    })
    if (updated.count === 0) throw AppError.conflict('该限量礼物已赠罄')
  }

  // 解析回语（按人设名）与好感度效果
  const replies = safeJson(gift.replies) as Record<string, string>
  const effect = safeJson(gift.effect) as { affection?: number } | null
  const reply =
    replies[character.name] ??
    replies[character.title] ??
    `谢谢你送我的${gift.name}，我心里特别暖。`

  const affectionDelta = (effect?.affection ?? 5) * quantity
  const affection = await changeAffection(user.id, characterId, affectionDelta)

  // 浮动动画数据（前端据此播放）
  const animation = {
    type: 'float-up',
    text: gift.name,
    emoji: gift.icon ?? '🎁',
    duration: 2000,
    intensity: quantity > 5 ? 'high' : 'medium',
  }

  await prisma.giftTransaction.create({
    data: {
      userId: user.id,
      giftId: gift.id,
      characterId,
      amount,
      reply,
      affectionDelta,
      animation: JSON.stringify(animation),
    },
  })
  await audit('GIFT_SEND', {
    userId: user.id,
    ip: ctx.ip ?? null,
    detail: { giftId, giftName: gift.name, characterId, quantity, amount, affectionDelta },
  })
  logger.info('[gift] 送礼', { gift: gift.name, characterId, quantity })

  return ok(
    {
      gift: { id: gift.id, name: gift.name, icon: gift.icon, isLimited: gift.isLimited },
      character: { id: character.id, name: character.name, title: character.title },
      reply,
      affection,
      affectionDelta,
      animation,
      amount,
      quantity,
      remainingStock: gift.isLimited ? (gift.stock !== null ? gift.stock - quantity : null) : null,
    },
    '礼物已送出',
  )
}

async function affectionStatus(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const characterId = ctx.params.characterId
  if (!characterId) throw AppError.badRequest('缺少角色 id')
  const character = await prisma.character.findUnique({ where: { id: characterId } })
  if (!character) throw AppError.notFound('角色不存在')
  const affections = await getAffectionsForUser(user.id, [characterId])
  return ok({ characterId, affection: affections[characterId] })
}

export function registerGiftRoutes(router: HttpRouter): void {
  router.define('gifts::list', '/api/v1/gifts', 'GET', listGifts)
  router.define('gifts::send', '/api/v1/gifts/:id/send', 'POST', sendGift)
  router.define('gifts::affection', '/api/v1/characters/:characterId/affection', 'GET', affectionStatus)
}
