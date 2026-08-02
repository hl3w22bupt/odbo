/**
 * 心伴AI · 认证与鉴权
 * JWT 访问令牌 + 刷新令牌（jose），RBAC 角色控制。
 */
import { SignJWT, jwtVerify } from 'jose'
import { randomUUID } from 'node:crypto'
import { prisma } from '../db.js'
import { config } from '../config.js'
import { AppError } from './errors.js'

export const ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export interface AuthUser {
  id: string
  phone: string
  role: string
  status: string
}

export interface AccessTokenPayload {
  sub: string
  role: string
  type: 'access'
}

export interface RefreshTokenPayload {
  sub: string
  sid: string
  type: 'refresh'
}

function secretFor(kind: 'access' | 'refresh'): Uint8Array {
  const key = kind === 'access' ? config.accessTokenSecret : config.refreshTokenSecret
  return new TextEncoder().encode(key)
}

function ttlSeconds(ttl: string): number {
  // 支持 '2h' / '30d' / '900' / '900s' 等
  const m = /^(\d+)(s|m|h|d)?$/.exec(ttl)
  if (!m) return 7200
  const n = Number.parseInt(m[1] ?? '7200', 10)
  switch (m[2]) {
    case 'm':
      return n * 60
    case 'h':
      return n * 3600
    case 'd':
      return n * 86400
    default:
      return n
  }
}

export async function generateAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ sub: user.id, role: user.role, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds(config.accessTokenTtl))
    .sign(secretFor('access'))
}

export async function generateRefreshToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ sub: userId, sid: sessionId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds(config.refreshTokenTtl))
    .sign(secretFor('refresh'))
}

/**
 * 校验访问令牌，返回用户信息（含数据库状态检查）。
 */
export async function verifyAccessToken(token: string): Promise<AuthUser> {
  try {
    const { payload } = await jwtVerify(token, secretFor('access'))
    if (payload.type !== 'access' || typeof payload.sub !== 'string') {
      throw AppError.unauthorized()
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) throw AppError.unauthorized('用户不存在')
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'FORBIDDEN', '账号已被停用')
    }
    return { id: user.id, phone: user.phone, role: user.role, status: user.status }
  } catch (e) {
    if (e instanceof AppError) throw e
    throw AppError.unauthorized()
  }
}

/**
 * 校验刷新令牌并返回 payload。
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secretFor('refresh'))
    if (payload.type !== 'refresh' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw AppError.unauthorized('刷新令牌无效')
    }
    return { sub: payload.sub, sid: payload.sid, type: 'refresh' }
  } catch {
    throw AppError.unauthorized('刷新令牌无效或已过期')
  }
}

/**
 * 创建登录会话，返回令牌对。sessionId 即 DeviceSession.id。
 */
export async function issueTokens(
  user: AuthUser,
  opts: { ip?: string | null; userAgent?: string | null },
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const sessionId = randomUUID()
  const refreshToken = await generateRefreshToken(user.id, sessionId)
  await prisma.deviceSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + ttlSeconds(config.refreshTokenTtl) * 1000),
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
    },
  })
  const accessToken = await generateAccessToken(user)
  return { accessToken, refreshToken, sessionId }
}

/**
 * 刷新令牌轮换：验证旧刷新令牌 → 撤销旧会话 → 签发新令牌对。
 */
export async function refreshTokens(
  refreshToken: string,
  opts: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ accessToken: string; refreshToken: string; sessionId: string; userId: string }> {
  const payload = await verifyRefreshToken(refreshToken)
  const session = await prisma.deviceSession.findUnique({ where: { id: payload.sid } })
  if (!session || session.revoked) {
    throw AppError.unauthorized('登录会话已失效，请重新登录')
  }
  if (session.refreshToken !== refreshToken) {
    throw AppError.unauthorized('刷新令牌不匹配')
  }
  if (session.expiresAt < new Date()) {
    throw AppError.unauthorized('登录已过期，请重新登录')
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.unauthorized('账号不可用')
  }
  // 撤销旧会话，创建新会话
  await prisma.deviceSession.update({
    where: { id: session.id },
    data: { revoked: true },
  })
  const tokens = await issueTokens(
    { id: user.id, phone: user.phone, role: user.role, status: user.status },
    opts,
  )
  return { ...tokens, userId: user.id }
}

/**
 * 吊销指定会话（登出）。
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.deviceSession.updateMany({
    where: { id: sessionId },
    data: { revoked: true },
  })
}

export function requireRole(authUser: AuthUser | undefined, roles: Role[]): AuthUser {
  if (!authUser) throw AppError.unauthorized()
  if (!roles.includes(authUser.role as Role)) throw AppError.forbidden()
  return authUser
}

export function extractBearerToken(authorization: string | string[] | undefined): string | undefined {
  if (!authorization) return undefined
  const value = Array.isArray(authorization) ? (authorization[0] ?? '') : authorization
  const m = /^Bearer\s+(.+)$/i.exec(value)
  return m?.[1]
}
