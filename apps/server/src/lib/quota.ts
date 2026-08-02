/**
 * 心伴AI · 每日消息配额
 * 免费用户 120 条/日（按 用户+日期 计数）；会员无限。
 */
import { prisma } from '../db.js'
import { config } from '../config.js'
import { AppError } from './errors.js'
import { logger } from './logger.js'

export function todayString(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface QuotaStatus {
  used: number
  limit: number
  remaining: number
  unlimited: boolean
  date: string
}

/**
 * 查询用户是否具备有效会员（未过期）。
 */
export async function hasActiveMembership(userId: string): Promise<boolean> {
  const now = new Date()
  const active = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
    orderBy: { expiresAt: 'desc' },
  })
  return Boolean(active)
}

/**
 * 获取当日配额状态。
 */
export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
  const unlimited = await hasActiveMembership(userId)
  if (unlimited) {
    return { used: 0, limit: 0, remaining: Infinity, unlimited: true, date: todayString() }
  }
  const date = todayString()
  const quota = await prisma.quota.upsert({
    where: { userId_date: { userId, date } },
    update: {},
    create: { userId, date, used: 0, limit: config.freeDailyQuota },
  })
  return {
    used: quota.used,
    limit: quota.limit,
    remaining: Math.max(0, quota.limit - quota.used),
    unlimited: false,
    date,
  }
}

/**
 * 消费一条配额。若超限则抛出 QUOTA_EXCEEDED（附会员引导）。
 */
export async function consumeQuota(userId: string): Promise<QuotaStatus> {
  const unlimited = await hasActiveMembership(userId)
  if (unlimited) {
    return { used: 0, limit: 0, remaining: Infinity, unlimited: true, date: todayString() }
  }
  const date = todayString()
  const quota = await prisma.quota.upsert({
    where: { userId_date: { userId, date } },
    update: {},
    create: { userId, date, used: 0, limit: config.freeDailyQuota },
  })
  if (quota.used >= quota.limit) {
    throw AppError.quotaExceeded(
      '今日免费消息条数已用完，开通会员可无限畅聊',
      { used: quota.used, limit: quota.limit, upgradeHint: true },
    )
  }
  const updated = await prisma.quota.update({
    where: { id: quota.id },
    data: { used: { increment: 1 } },
  })
  return {
    used: updated.used,
    limit: updated.limit,
    remaining: Math.max(0, updated.limit - updated.used),
    unlimited: false,
    date,
  }
}

/**
 * 刷新配额（把历史过期行重置，可选）。
 */
export async function resetExpiredQuota(userId: string): Promise<void> {
  const today = todayString()
  const stale = await prisma.quota.findMany({ where: { userId, date: { not: today } } })
  if (stale.length > 0) {
    logger.info('清理历史配额行', { userId, count: stale.length })
  }
}
