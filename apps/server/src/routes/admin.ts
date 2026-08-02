/**
 * 心伴AI · 管理端路由（RBAC：ADMIN）
 * 用户管理 / 角色管理 / 审计日志 / 内容审核 / 敏感词管理 / 统计
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { authenticate } from '../http.js'
import { ok } from '../lib/response.js'
import { requireRole } from '../lib/auth.js'
import { AppError } from '../lib/errors.js'
import { audit } from '../lib/audit.js'
import { invalidateSensitiveCache } from '../lib/contentFilter.js'

async function adminGuard(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  return requireRole(user, ['ADMIN'])
}

async function listUsers(ctx: HttpRouteContext) {
  const admin = await adminGuard(ctx)
  const page = Math.max(1, Number.parseInt(ctx.query.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(ctx.query.pageSize ?? '20', 10) || 20))
  const phone = ctx.query.phone
  const where: Record<string, unknown> = {}
  if (phone) where.phone = { contains: phone }
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  await audit('ADMIN_USER_LIST', { userId: admin.id, ip: ctx.ip ?? null, detail: { page, pageSize } })
  return ok({
    total,
    page,
    pageSize,
    items: items.map((u) => ({
      id: u.id,
      phone: u.phone,
      nickname: u.nickname,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
    })),
  })
}

async function setUserStatus(ctx: HttpRouteContext, status: 'BANNED' | 'ACTIVE') {
  const admin = await adminGuard(ctx)
  const userId = ctx.params.id
  if (!userId) throw AppError.badRequest('缺少用户 id')
  if (userId === admin.id) throw AppError.badRequest('不能操作自己的账号')
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw AppError.notFound('用户不存在')
  await prisma.user.update({ where: { id: userId }, data: { status } })
  await audit(status === 'BANNED' ? 'ADMIN_USER_BAN' : 'ADMIN_USER_BAN', {
    userId: admin.id,
    ip: ctx.ip ?? null,
    detail: { targetUserId: userId, action: status },
  })
  return ok({ id: userId, status }, status === 'BANNED' ? '用户已封禁' : '用户已解封')
}

async function listCharacters(ctx: HttpRouteContext) {
  const admin = await adminGuard(ctx)
  const characters = await prisma.character.findMany({ orderBy: { createdAt: 'asc' } })
  return ok(
    characters.map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      type: c.type,
      tier: c.tier,
      isMemberOnly: c.isMemberOnly,
      dialect: c.dialect,
      occupation: c.occupation,
      status: c.status,
      createdAt: c.createdAt,
    })),
  )
}

async function createCharacter(ctx: HttpRouteContext) {
  const admin = await adminGuard(ctx)
  const body = ctx.body as {
    name: string
    title?: string
    type?: string
    tier?: string
    isMemberOnly?: boolean
    dialect?: string
    occupation?: string
    personality?: string
    greeting?: string
    avatarUrl?: string
    voice?: string
    tags?: string[]
  }
  if (!body.name) throw AppError.badRequest('角色名必填')
  const character = await prisma.character.create({
    data: {
      name: body.name,
      title: body.title ?? 'AI伴侣',
      type: body.type === 'POSSESSIVE' ? 'POSSESSIVE' : 'INCLUSIVE',
      tier: body.tier === 'VIP' ? 'VIP' : 'FREE',
      isMemberOnly: Boolean(body.isMemberOnly),
      dialect: body.dialect ?? 'MANDARIN',
      occupation: body.occupation ?? '',
      personality: body.personality ?? '',
      greeting: body.greeting ?? '',
      avatarUrl: body.avatarUrl ?? null,
      voice: body.voice ?? null,
      tags: Array.isArray(body.tags) ? body.tags.join(',') : '',
    },
  })
  await audit('ADMIN_CHARACTER_CREATE', { userId: admin.id, ip: ctx.ip ?? null, detail: { characterId: character.id } })
  return ok({ id: character.id }, '角色已创建')
}

async function updateCharacter(ctx: HttpRouteContext) {
  const admin = await adminGuard(ctx)
  const id = ctx.params.id
  if (!id) throw AppError.badRequest('缺少角色 id')
  const character = await prisma.character.findUnique({ where: { id } })
  if (!character) throw AppError.notFound('角色不存在')
  const body = ctx.body as Record<string, unknown>
  const data: Record<string, unknown> = {}
  const strField = (k: string) => typeof body[k] === 'string' ? (body[k] as string) : undefined
  const name = strField('name')
  if (name) data.name = name
  if (body.title !== undefined && typeof body.title === 'string') data.title = body.title
  if (body.type === 'INCLUSIVE' || body.type === 'POSSESSIVE') data.type = body.type
  if (body.tier === 'FREE' || body.tier === 'VIP') data.tier = body.tier
  if (typeof body.isMemberOnly === 'boolean') data.isMemberOnly = body.isMemberOnly
  const dialect = strField('dialect')
  if (dialect) data.dialect = dialect
  const occupation = strField('occupation')
  if (occupation) data.occupation = occupation
  const personality = strField('personality')
  if (personality) data.personality = personality
  const greeting = strField('greeting')
  if (greeting) data.greeting = greeting
  const avatarUrl = strField('avatarUrl')
  if (avatarUrl) data.avatarUrl = avatarUrl
  const voice = strField('voice')
  if (voice) data.voice = voice
  if (body.status === 'ACTIVE' || body.status === 'DISABLED') data.status = body.status
  if (Array.isArray(body.tags)) data.tags = (body.tags as string[]).join(',')

  const updated = await prisma.character.update({ where: { id }, data })
  await audit('ADMIN_CHARACTER_UPDATE', { userId: admin.id, ip: ctx.ip ?? null, detail: { characterId: id } })
  return ok({ id: updated.id }, '角色已更新')
}

async function listAuditLogs(ctx: HttpRouteContext) {
  const admin = await adminGuard(ctx)
  const page = Math.max(1, Number.parseInt(ctx.query.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(ctx.query.pageSize ?? '20', 10) || 20))
  const action = ctx.query.action
  const where: Record<string, unknown> = {}
  if (action) where.action = action
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  await audit('ADMIN_AUDIT_LIST', { userId: admin.id, ip: ctx.ip ?? null })
  return ok({
    total,
    page,
    pageSize,
    items: items.map((a) => ({
      id: a.id,
      actor: a.actor,
      action: a.action,
      detail: (() => {
        try {
          return JSON.parse(a.detail)
        } catch {
          return {}
        }
      })(),
      ip: a.ip,
      createdAt: a.createdAt,
    })),
  })
}

async function listContentAuditLogs(ctx: HttpRouteContext) {
  const admin = await adminGuard(ctx)
  const page = Math.max(1, Number.parseInt(ctx.query.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(ctx.query.pageSize ?? '20', 10) || 20))
  const [total, items] = await Promise.all([
    prisma.contentAuditLog.count(),
    prisma.contentAuditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  return ok({ total, page, pageSize, items })
}

async function addSensitiveWord(ctx: HttpRouteContext) {
  const admin = await adminGuard(ctx)
  const body = ctx.body as { word?: string; level?: string; category?: string }
  const word = body.word?.trim()
  if (!word) throw AppError.badRequest('敏感词必填')
  const level = body.level === 'FLAG' ? 'FLAG' : 'BLOCK'
  const existing = await prisma.sensitiveWord.findUnique({ where: { word } })
  if (existing) throw AppError.conflict('敏感词已存在')
  await prisma.sensitiveWord.create({ data: { word, level, category: body.category ?? null } })
  invalidateSensitiveCache()
  await audit('ADMIN_SENSITIVE_ADD', { userId: admin.id, ip: ctx.ip ?? null, detail: { word, level } })
  return ok({ word, level }, '敏感词已添加')
}

async function stats(ctx: HttpRouteContext) {
  const admin = await adminGuard(ctx)
  void admin
  const [userCount, characterCount, orderCount, messageCount, paidOrders] = await Promise.all([
    prisma.user.count(),
    prisma.character.count(),
    prisma.order.count(),
    prisma.message.count(),
    prisma.order.count({ where: { status: 'PAID' } }),
  ])
  return ok({ userCount, characterCount, orderCount, messageCount, paidOrderCount: paidOrders })
}

export function registerAdminRoutes(router: HttpRouter): void {
  router.define('admin::users', '/api/v1/admin/users', 'GET', listUsers)
  router.define('admin::user-ban', '/api/v1/admin/users/:id/ban', 'POST', (ctx) => setUserStatus(ctx, 'BANNED'))
  router.define('admin::user-unban', '/api/v1/admin/users/:id/unban', 'POST', (ctx) => setUserStatus(ctx, 'ACTIVE'))
  router.define('admin::characters', '/api/v1/admin/characters', 'GET', listCharacters)
  router.define('admin::character-create', '/api/v1/admin/characters', 'POST', createCharacter)
  router.define('admin::character-update', '/api/v1/admin/characters/:id', 'PUT', updateCharacter)
  router.define('admin::audit-logs', '/api/v1/admin/audit-logs', 'GET', listAuditLogs)
  router.define('admin::content-audit-logs', '/api/v1/admin/content-audit-logs', 'GET', listContentAuditLogs)
  router.define('admin::sensitive-add', '/api/v1/admin/sensitive-words', 'POST', addSensitiveWord)
  router.define('admin::stats', '/api/v1/admin/stats', 'GET', stats)
}
