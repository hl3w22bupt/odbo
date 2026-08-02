/**
 * 心伴AI · 审计日志
 * 登录 / 支付 / 管理操作均落库（操作人 / 动作 / 时间 / IP）。
 */
import { prisma } from '../db.js'
import { logger } from './logger.js'

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAIL'
  | 'LOGOUT'
  | 'SMS_SEND'
  | 'SMS_VERIFY'
  | 'TOKEN_REFRESH'
  | 'ORDER_CREATE'
  | 'ORDER_PAY'
  | 'PAY_CALLBACK'
  | 'PAY_CONFIRM'
  | 'GIFT_SEND'
  | 'CUSTOMIZE'
  | 'IMAGE_GENERATE'
  | 'ADMIN_USER_LIST'
  | 'ADMIN_USER_BAN'
  | 'ADMIN_USER_UNBAN'
  | 'ADMIN_CHARACTER_CREATE'
  | 'ADMIN_CHARACTER_UPDATE'
  | 'ADMIN_PRODUCT_CREATE'
  | 'ADMIN_SENSITIVE_ADD'
  | 'ADMIN_AUDIT_LIST'

export interface AuditOptions {
  userId?: string | null
  actor?: string | null
  ip?: string | null
  detail?: Record<string, unknown>
}

/**
 * 写审计日志。失败不影响主流程（仅记录告警）。
 */
export async function audit(action: AuditAction, opts: AuditOptions = {}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        actor: opts.actor ?? opts.userId ?? null,
        action,
        detail: JSON.stringify(opts.detail ?? {}),
        ip: opts.ip ?? null,
      },
    })
  } catch (err) {
    logger.warn('audit log write failed', { action, err: String(err) })
  }
}

/**
 * 写内容审核日志。失败不影响主流程。
 */
export async function contentAudit(opts: {
  userId?: string | null
  direction: 'IN' | 'OUT'
  content: string
  result: 'PASS' | 'BLOCK' | 'REPLACED'
  matchedWord?: string | null
  messageId?: string | null
}): Promise<void> {
  try {
    await prisma.contentAuditLog.create({
      data: {
        userId: opts.userId ?? null,
        direction: opts.direction,
        content: opts.content,
        result: opts.result,
        matchedWord: opts.matchedWord ?? null,
        messageId: opts.messageId ?? null,
      },
    })
  } catch (err) {
    logger.warn('content audit write failed', { err: String(err) })
  }
}
