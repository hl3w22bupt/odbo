/**
 * 心伴AI · HTTP 响应工具
 * 统一 API 信封：{ code, message, data }
 * 兼容 iii 引擎 http trigger 的 { status_code, body, headers } 返回契约。
 */
import type { AppError } from './errors.js'

export interface ApiEnvelope<T = unknown> {
  code: string
  message: string
  data: T
}

export interface HttpResponse {
  status_code: number
  headers: Record<string, string>
  body: ApiEnvelope<unknown>
}

export function ok<T>(data: T, message = 'ok'): HttpResponse {
  return {
    status_code: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: { code: 'OK', message, data },
  }
}

export function created<T>(data: T, message = 'created'): HttpResponse {
  return {
    status_code: 201,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: { code: 'OK', message, data },
  }
}

export function fail(statusCode: number, code: string, message: string, detail?: unknown): HttpResponse {
  return {
    status_code: statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: { code, message, data: detail ?? null },
  }
}

export function fromError(err: unknown): HttpResponse {
  const e = err as AppError
  if (e && typeof e === 'object' && 'statusCode' in e && 'code' in e) {
    return fail(e.statusCode, e.code, e.message, e.detail)
  }
  if (err instanceof Error) {
    return fail(500, 'INTERNAL_ERROR', err.message)
  }
  return fail(500, 'INTERNAL_ERROR', '服务器内部错误')
}

/**
 * 从 iii http trigger 输入中安全解析 JSON body。
 * body 可能是已解析对象，也可能是 JSON 字符串。
 */
export function parseBody<T = Record<string, unknown>>(body: unknown): Partial<T> {
  if (body == null) return {} as T
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as T
    } catch {
      return {} as T
    }
  }
  if (typeof body === 'object') return body as T
  return {} as T
}

/**
 * 从 header 中提取客户端 IP（兼容代理）。
 */
export function clientIp(headers: Record<string, string | string[] | undefined>): string | undefined {
  const xff = headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]?.trim()
  }
  const realIp = headers['x-real-ip']
  if (typeof realIp === 'string') return realIp
  const cf = headers['cf-connecting-ip']
  if (typeof cf === 'string') return cf
  return undefined
}
