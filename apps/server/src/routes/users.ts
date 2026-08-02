/**
 * 心伴AI · 用户路由
 * 个人资料 / 状态聚合（配额、会员、防沉迷、合规提示）
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { ok } from '../lib/response.js'
import { authenticate } from '../http.js'
import { AppError } from '../lib/errors.js'
import { getQuotaStatus, hasActiveMembership } from '../lib/quota.js'
import { checkAntiAddiction } from '../lib/antiAddiction.js'
import { config } from '../config.js'

async function me(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) throw AppError.notFound('用户不存在')
  return ok({
    id: dbUser.id,
    phone: dbUser.phone,
    nickname: dbUser.nickname,
    avatarUrl: dbUser.avatarUrl,
    role: dbUser.role,
    gender: dbUser.gender,
    age: dbUser.age,
    createdAt: dbUser.createdAt,
  })
}

async function updateMe(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const body = ctx.body as { nickname?: string; avatarUrl?: string; gender?: string; age?: number }
  const data: { nickname?: string; avatarUrl?: string; gender?: string; age?: number } = {}
  if (typeof body.nickname === 'string') {
    if (body.nickname.length > 20) throw AppError.badRequest('昵称最长 20 个字符')
    data.nickname = body.nickname.trim()
  }
  if (typeof body.avatarUrl === 'string' && body.avatarUrl.length > 0) data.avatarUrl = body.avatarUrl
  if (body.gender === 'MALE' || body.gender === 'FEMALE') data.gender = body.gender
  if (typeof body.age === 'number') {
    if (body.age < 0 || body.age > 150) throw AppError.badRequest('年龄不合法')
    data.age = body.age
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data })
  return ok({ id: updated.id, nickname: updated.nickname, avatarUrl: updated.avatarUrl })
}

async function myStatus(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const [quota, membership, antiAddiction] = await Promise.all([
    getQuotaStatus(user.id),
    (async () => {
      const active = await hasActiveMembership(user.id)
      if (!active) return null
      const m = await prisma.membership.findFirst({
        where: { userId: user.id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'desc' },
      })
      return m ? { plan: m.plan, startedAt: m.startedAt, expiresAt: m.expiresAt } : null
    })(),
    checkAntiAddiction(user.id),
  ])
  return ok({
    quota: {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
      unlimited: quota.unlimited,
    },
    membership,
    antiAddiction: {
      blocked: antiAddiction.blocked,
      reason: antiAddiction.reason,
      message: antiAddiction.message,
      lateNightBlock: config.antiAddictionLateNight,
    },
    compliance: {
      aiNotice: config.aiNotice,
      largePaymentThresholdCny: config.largePaymentThresholdCny,
    },
  })
}

export function registerUserRoutes(router: HttpRouter): void {
  router.define('users::me', '/api/v1/users/me', 'GET', me)
  router.define('users::me-update', '/api/v1/users/me', 'PATCH', updateMe)
  router.define('users::status', '/api/v1/users/me/status', 'GET', myStatus)
}
