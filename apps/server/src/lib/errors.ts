/**
 * 心伴AI · 统一错误模型
 * 业务错误携带 HTTP 状态码与错误码，最终由路由层包装为 API 信封。
 */

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'QUOTA_EXCEEDED'
  | 'MEMBER_REQUIRED'
  | 'ANTI_ADDICTION'
  | 'LARGE_PAYMENT_CONFIRM'
  | 'CONTENT_BLOCKED'
  | 'INTERNAL_ERROR'
  | 'SMS_RATE_LIMITED'
  | 'INVALID_CODE'
  | 'PAYMENT_ERROR'

export class AppError extends Error {
  readonly statusCode: number
  readonly code: ErrorCode
  readonly detail: unknown

  constructor(statusCode: number, code: ErrorCode, message: string, detail?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.detail = detail
  }

  static badRequest(message: string, detail?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, detail)
  }

  static unauthorized(message = '未登录或登录已过期'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message = '没有权限执行此操作'): AppError {
    return new AppError(403, 'FORBIDDEN', message)
  }

  static notFound(message = '资源不存在'): AppError {
    return new AppError(404, 'NOT_FOUND', message)
  }

  static conflict(message: string, detail?: unknown): AppError {
    return new AppError(409, 'CONFLICT', message, detail)
  }

  static quotaExceeded(message = '今日免费消息条数已用完', detail?: unknown): AppError {
    return new AppError(429, 'QUOTA_EXCEEDED', message, detail)
  }

  static memberRequired(message = '该功能为会员专属，请开通会员后使用', detail?: unknown): AppError {
    return new AppError(403, 'MEMBER_REQUIRED', message, detail)
  }

  static antiAddiction(message: string, detail?: unknown): AppError {
    return new AppError(423, 'ANTI_ADDICTION', message, detail)
  }

  static largePaymentConfirm(message = '大额支付需要二次确认', detail?: unknown): AppError {
    return new AppError(428, 'LARGE_PAYMENT_CONFIRM', message, detail)
  }

  static contentBlocked(message = '内容包含不适宜词汇，请修改后再发送', detail?: unknown): AppError {
    return new AppError(400, 'CONTENT_BLOCKED', message, detail)
  }

  static internal(message = '服务器内部错误', detail?: unknown): AppError {
    return new AppError(500, 'INTERNAL_ERROR', message, detail)
  }

  static payment(message: string, detail?: unknown): AppError {
    return new AppError(502, 'PAYMENT_ERROR', message, detail)
  }
}
