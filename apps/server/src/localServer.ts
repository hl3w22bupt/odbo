/**
 * 心伴AI · standalone HTTP 服务入口
 * v0.1 演示/验收使用：不依赖外部进程编排，直接调度与 iii 相同的业务 handler。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import type { IIIClient } from 'iii-sdk'
import { config } from './config.js'
import { createRouter, type HttpRouteContext } from './http.js'
import { fromError, ok } from './lib/response.js'
import { logger } from './lib/logger.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerUserRoutes } from './routes/users.js'
import { registerCharacterRoutes } from './routes/characters.js'
import { registerChatRoutes } from './routes/chat.js'
import { registerGiftRoutes } from './routes/gifts.js'
import { registerCommerceRoutes } from './routes/commerce.js'
import { registerImageRoutes } from './routes/images.js'
import { registerComplianceRoutes } from './routes/compliance.js'
import { registerAdminRoutes } from './routes/admin.js'

const MAX_BODY_BYTES = 1024 * 1024
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.byteLength
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve(undefined)
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('JSON 格式不正确'))
      }
    })
    req.on('error', reject)
  })
}

function writeJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

export async function startLocalServer(port = config.httpPort): Promise<http.Server> {
  // SQLite 路径所在目录必须在打开连接前存在。
  if (config.databaseUrl.startsWith('file:')) {
    const configuredPath = config.databaseUrl.slice('file:'.length).split('?')[0] || './data/xinban.db'
    const dataDir = path.dirname(path.resolve(process.cwd(), configuredPath))
    fs.mkdirSync(dataDir, { recursive: true })
  }

  // standalone 模式只复用 router 调度能力，不注册 iii function/trigger。
  const router = createRouter({} as IIIClient, false)
  registerAuthRoutes(router)
  registerUserRoutes(router)
  registerCharacterRoutes(router)
  registerChatRoutes(router)
  registerGiftRoutes(router)
  registerCommerceRoutes(router)
  registerImageRoutes(router)
  registerComplianceRoutes(router)
  registerAdminRoutes(router)
  router.define('system::health', '/health', 'GET', async () =>
    ok({ service: 'xinban-ai', status: 'up', mode: 'standalone', time: new Date().toISOString() }, 'ok'),
  )

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS)
      res.end()
      return
    }
    try {
      const rawUrl = req.url ?? '/'
      const url = new URL(rawUrl, `http://${req.headers.host ?? 'localhost'}`)
      const query: Record<string, string> = {}
      for (const [key, value] of url.searchParams.entries()) query[key] = value
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
      const ctx: Omit<HttpRouteContext, 'method' | 'path'> = {
        body: (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>,
        query,
        params: {},
        headers: req.headers,
      }
      const response = await router.dispatch(req.method ?? 'GET', url.pathname, ctx)
      writeJson(res, response.status_code, response.body)
    } catch (err) {
      const response = fromError(err)
      writeJson(res, response.status_code, response.body)
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '0.0.0.0', () => resolve())
  })
  logger.info('心伴AI standalone 服务启动', {
    port,
    database: config.databaseUrl.replace(/:\/\/[^@]+@/, '://***@'),
  })
  return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const server = await startLocalServer()
  const shutdown = () => {
    logger.info('收到退出信号，正在关闭 standalone 服务…')
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2_000).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
