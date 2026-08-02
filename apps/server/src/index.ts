/**
 * 心伴AI · 后端服务入口
 * 基于 iii engine + TypeScript Worker（iii-sdk）。
 * registerWorker(process.env.III_URL) 连接引擎，
 * registerFunction(...) 注册业务函数，registerTrigger({type:'http'...}) 绑定 REST 接口。
 */
import { registerWorker } from 'iii-sdk'
import { config } from './config.js'
import { logger } from './lib/logger.js'
import { createRouter } from './http.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerUserRoutes } from './routes/users.js'
import { registerCharacterRoutes } from './routes/characters.js'
import { registerChatRoutes } from './routes/chat.js'
import { registerGiftRoutes } from './routes/gifts.js'
import { registerCommerceRoutes } from './routes/commerce.js'
import { registerImageRoutes } from './routes/images.js'
import { registerComplianceRoutes } from './routes/compliance.js'
import { registerAdminRoutes } from './routes/admin.js'
import { registerProactiveCron } from './proactive.js'
import { ok } from './lib/response.js'

const III_URL = config.iiiUrl

async function main(): Promise<void> {
  logger.info('心伴AI 后端启动', { iiiUrl: III_URL, provider: { llm: config.llmProvider, sms: config.smsProvider, image: config.imageProvider, pay: config.payProvider } })

  const worker = registerWorker(III_URL, {
    workerName: 'xinban-ai',
    workerDescription: '心伴AI · 中老年男性AI情感陪伴后端',
    invocationTimeoutMs: 60_000,
    reconnectionConfig: { maxRetries: Infinity },
  })

  const router = createRouter(worker)

  // 路由注册
  registerAuthRoutes(router)
  registerUserRoutes(router)
  registerCharacterRoutes(router)
  registerChatRoutes(router)
  registerGiftRoutes(router)
  registerCommerceRoutes(router)
  registerImageRoutes(router)
  registerComplianceRoutes(router)
  registerAdminRoutes(router)

  // 健康检查
  router.define('system::health', '/health', 'GET', async () =>
    ok({ service: 'xinban-ai', status: 'up', time: new Date().toISOString() }, 'ok'),
  )

  // 定时：主动分享见闻
  registerProactiveCron(worker)

  logger.info('所有函数与触发器注册完成')

  process.on('SIGTERM', async () => {
    logger.info('收到 SIGTERM，正在关闭…')
    await worker.shutdown()
    process.exit(0)
  })
  process.on('SIGINT', async () => {
    logger.info('收到 SIGINT，正在关闭…')
    await worker.shutdown()
    process.exit(0)
  })
}

main().catch((err) => {
  logger.error('启动失败', { err: String(err) })
  process.exit(1)
})
