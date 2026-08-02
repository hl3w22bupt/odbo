/**
 * 心伴AI · 认证路由
 * 手机号验证码登录 / 刷新 / 登出
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { ok } from '../lib/response.js'
import { AppError } from '../lib/errors.js'
import { audit } from '../lib/audit.js'
import { authenticate } from '../http.js'
import {
  assertValidPhone,
  generateCode,
  getSmsProvider,
  isDevFallbackCode,
} from '../lib/sms.js'
import {
  issueTokens,
  refreshTokens,
  revokeSession,
} from '../lib/auth.js'
import { config } from '../config.js'

const CODE_TTL_MS = 5 * 60_000 // 5 分钟
const CODE_RESEND_INTERVAL_MS = 60_000 // 60s 内不可重发
const MAX_VERIFY_ATTEMPTS = 5

async function sendSmsCode(ctx: HttpRouteContext) {
  const body = ctx.body as { phone?: string; purpose?: string }
  const phone = body.phone ?? ''
  assertValidPhone(phone)
  const purpose = body.purpose === 'BIND' ? 'BIND' : 'LOGIN'

  // 防刷：60s 内不可重发
  const last = await prisma.smsCode.findFirst({
    where: { phone, purpose },
    orderBy: { createdAt: 'desc' },
  })
  if (last && Date.now() - last.createdAt.getTime() < CODE_RESEND_INTERVAL_MS) {
    throw AppError.badRequest('验证码发送过于频繁，请稍后再试')
  }

  // 开发期固定验证码 123456；配置密钥后为随机码
  const code = isDevFallbackCode('123456') ? '123456' : generateCode()
  await prisma.smsCode.create({
    data: {
      phone,
      code,
      purpose,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      ip: ctx.ip ?? null,
    },
  })

  await getSmsProvider().send({ phone, code, purpose })
  await audit('SMS_SEND', { userId: null, actor: phone, ip: ctx.ip ?? null, detail: { phone, purpose } })

  // 开发模式返回验证码便于联调
  const data: Record<string, unknown> = { sent: true, expiresIn: CODE_TTL_MS / 1000 }
  if (isDevFallbackCode(code)) {
    data.devCode = code
  }
  return ok(data, '验证码已发送')
}

async function login(ctx: HttpRouteContext) {
  const body = ctx.body as { phone?: string; code?: string }
  const phone = body.phone ?? ''
  const code = body.code ?? ''
  assertValidPhone(phone)
  if (!/^\d{4,6}$/.test(code)) {
    throw AppError.badRequest('验证码格式不正确')
  }

  const devFallback = isDevFallbackCode(code)
  let smsRecord = null
  if (!devFallback) {
    smsRecord = await prisma.smsCode.findFirst({
      where: { phone, purpose: 'LOGIN', used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!smsRecord) throw AppError.badRequest('验证码不存在或已过期，请重新获取')
    if (smsRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw AppError.badRequest('尝试次数过多，请重新获取验证码')
    }
    if (smsRecord.code !== code) {
      await prisma.smsCode.update({
        where: { id: smsRecord.id },
        data: { attempts: { increment: 1 } },
      })
      await audit('LOGIN_FAIL', { actor: phone, ip: ctx.ip ?? null, detail: { phone, reason: 'WRONG_CODE' } })
      throw AppError.badRequest('验证码不正确')
    }
    await prisma.smsCode.update({ where: { id: smsRecord.id }, data: { used: true } })
  }

  let user = await prisma.user.findUnique({ where: { phone } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        nickname: `用户${phone.slice(-4)}`,
        role: 'USER',
        status: 'ACTIVE',
      },
    })
  }
  if (user.status !== 'ACTIVE') {
    throw AppError.forbidden('账号已被停用')
  }

  const tokens = await issueTokens(
    { id: user.id, phone: user.phone, role: user.role, status: user.status },
    { ip: ctx.ip ?? null, userAgent: headerStr(ctx.headers['user-agent']) ?? null },
  )
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
  await audit('LOGIN', { userId: user.id, ip: ctx.ip ?? null, detail: { phone } })

  return ok(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 2 * 3600,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      compliance: {
        aiNotice: config.aiNotice,
      },
    },
    '登录成功',
  )
}

async function refresh(ctx: HttpRouteContext) {
  const body = ctx.body as { refreshToken?: string }
  const token = body.refreshToken ?? ''
  if (!token) throw AppError.badRequest('缺少 refreshToken')
  const tokens = await refreshTokens(token, {
    ip: ctx.ip ?? null,
    userAgent: headerStr(ctx.headers['user-agent']) ?? null,
  })
  await audit('TOKEN_REFRESH', { userId: tokens.sessionId, ip: ctx.ip ?? null })
  return ok({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }, '刷新成功')
}

async function logout(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const body = ctx.body as { sessionId?: string }
  const sessionId = body.sessionId
  if (sessionId) {
    // 仅能吊销自己的会话
    const session = await prisma.deviceSession.findUnique({ where: { id: sessionId } })
    if (session && session.userId === user.id) {
      await revokeSession(sessionId)
    }
  }
  await audit('LOGOUT', { userId: user.id, ip: ctx.ip ?? null })
  return ok(null, '已退出登录')
}

function headerStr(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined
  return Array.isArray(v) ? v[0] : v
}

export function registerAuthRoutes(router: HttpRouter): void {
  router.define('auth::sms-code', '/api/v1/auth/sms-code', 'POST', sendSmsCode)
  router.define('auth::login', '/api/v1/auth/login', 'POST', login)
  router.define('auth::refresh', '/api/v1/auth/refresh', 'POST', refresh)
  router.define('auth::logout', '/api/v1/auth/logout', 'POST', logout)
}
