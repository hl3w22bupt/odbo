/**
 * 心伴AI · HTTP 路由层
 * 将业务 handler 注册为 iii 引擎的 function + http trigger。
 * handler 入参兼容 iii http trigger 输入，返回 { status_code, body, headers }。
 */
import type { IIIClient } from 'iii-sdk'
import type { HttpResponse } from './lib/response.js'
import { fromError, parseBody, clientIp } from './lib/response.js'
import type { AuthUser } from './lib/auth.js'
import { extractBearerToken, verifyAccessToken } from './lib/auth.js'
import { AppError } from './lib/errors.js'
import { logger } from './lib/logger.js'

export interface HttpRouteContext {
  body: Record<string, unknown>
  query: Record<string, string>
  params: Record<string, string>
  headers: Record<string, string | string[] | undefined>
  method: string
  path: string
  ip?: string
  authUser?: AuthUser
}

export type HttpHandler = (ctx: HttpRouteContext) => Promise<HttpResponse>

export interface HttpRouter {
  define(fnId: string, apiPath: string, method: string, handler: HttpHandler): void
}

interface RawHttpInput {
  path_params?: Record<string, string>
  query_params?: Record<string, string | string[]>
  body?: unknown
  headers?: Record<string, string | string[]>
  method?: string
  path?: string
}

function normalizeQuery(query: Record<string, string | string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(query ?? {})) {
    out[k] = Array.isArray(v) ? (v[0] ?? '') : v
  }
  return out
}

function normalizeHeaders(headers: Record<string, string | string[]> | undefined): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {}
  for (const [k, v] of Object.entries(headers ?? {})) {
    out[k.toLowerCase()] = Array.isArray(v) ? v : v
  }
  return out
}

export function createRouter(worker: IIIClient): HttpRouter {
  const routes: Array<{ fnId: string; apiPath: string; method: string }> = []

  const router: HttpRouter = {
    define(fnId, apiPath, method, handler) {
      routes.push({ fnId, apiPath, method })
      worker.registerFunction(
        fnId,
        async (input: RawHttpInput) => {
          const ip = clientIp(normalizeHeaders(input.headers))
          const ctx: HttpRouteContext = {
            body: parseBody(input.body),
            query: normalizeQuery(input.query_params),
            params: input.path_params ?? {},
            headers: normalizeHeaders(input.headers),
            method: input.method ?? method,
            path: input.path ?? apiPath,
            ...(ip !== undefined ? { ip } : {}),
          }
          try {
            return await handler(ctx)
          } catch (err) {
            logger.warn(`[http] ${method} ${apiPath} 处理失败`, {
              code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
              message: err instanceof Error ? err.message : String(err),
            })
            return fromError(err)
          }
        },
        { description: `HTTP ${method} ${apiPath}` },
      )
      worker.registerTrigger({
        type: 'http',
        function_id: fnId,
        config: { api_path: apiPath, http_method: method },
      })
      logger.info(`[route] ${method} ${apiPath} -> ${fnId}`)
    },
  }

  return router
}

/**
 * 解析并校验访问令牌。失败抛出 UNAUTHORIZED。
 */
export async function authenticate(ctx: HttpRouteContext): Promise<AuthUser> {
  if (ctx.authUser) return ctx.authUser
  const token = extractBearerToken(ctx.headers.authorization)
  if (!token) throw AppError.unauthorized()
  const user = await verifyAccessToken(token)
  ctx.authUser = user
  return user
}

/**
 * 解析访问令牌；未登录返回 null（不抛错，用于可选鉴权）。
 */
export async function optionalAuth(ctx: HttpRouteContext): Promise<AuthUser | undefined> {
  if (ctx.authUser) return ctx.authUser
  const token = extractBearerToken(ctx.headers.authorization)
  if (!token) return undefined
  try {
    const user = await verifyAccessToken(token)
    ctx.authUser = user
    return user
  } catch {
    return undefined
  }
}

export type { HttpResponse }
