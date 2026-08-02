/**
 * 心伴AI · 防沉迷
 * 1. 深夜时段拦截（23:00-05:59，可配置）
 * 2. 连续使用时长拦截（在窗口期内活跃分钟数达上限）
 */
import { prisma } from '../db.js'
import { config } from '../config.js'

export interface AntiAddictionResult {
  blocked: boolean
  reason: 'LATE_NIGHT' | 'CONTINUOUS' | null
  message?: string
}

/**
 * 防沉迷检查。
 */
export async function checkAntiAddiction(userId: string): Promise<AntiAddictionResult> {
  const now = new Date()

  // 1. 深夜时段
  if (config.antiAddictionLateNight) {
    const hour = now.getHours()
    if (hour >= 23 || hour < 6) {
      return {
        blocked: true,
        reason: 'LATE_NIGHT',
        message: '夜深了，早点休息吧。明天醒来，我还在等你。',
      }
    }
  }

  // 2. 连续使用时长
  const windowMs = config.antiAddictionWindowMin * 60_000
  const since = new Date(now.getTime() - windowMs)
  const recent = await prisma.message.findMany({
    where: {
      userId,
      role: 'USER',
      createdAt: { gte: since },
    },
    select: { createdAt: true },
  })
  const activeMinutes = new Set<string>()
  for (const m of recent) {
    activeMinutes.add(m.createdAt.toISOString().slice(0, 16))
  }
  if (activeMinutes.size >= config.antiAddictionLimitMin) {
    return {
      blocked: true,
      reason: 'CONTINUOUS',
      message: '你已经和心伴聊了很久啦，休息一下，喝口水再回来吧。',
    }
  }

  return { blocked: false, reason: null }
}
