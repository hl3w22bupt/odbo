/**
 * 心伴AI · 合规路由
 * AI 虚拟角色提示条 / 防沉迷 / 理性消费提示
 */
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { ok } from '../lib/response.js'
import { authenticate } from '../http.js'
import { checkAntiAddiction } from '../lib/antiAddiction.js'
import { config } from '../config.js'

async function complianceStatus(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const antiAddiction = await checkAntiAddiction(user.id)
  return ok({
    aiNotice: config.aiNotice,
    isAiVirtual: true,
    antiAddiction: {
      enabled: true,
      lateNightBlock: config.antiAddictionLateNight,
      lateNightWindow: '23:00 - 06:00',
      continuousWindowMin: config.antiAddictionWindowMin,
      continuousLimitMin: config.antiAddictionLimitMin,
      currentlyBlocked: antiAddiction.blocked,
      blockReason: antiAddiction.reason,
      blockMessage: antiAddiction.message,
    },
    rationalConsumption: {
      enabled: true,
      largePaymentThresholdCny: config.largePaymentThresholdCny,
      notice: '请理性消费，按需购买。未成年人不建议使用本服务。',
    },
    contentFilter: {
      enabled: config.contentFilterEnabled,
      note: '内容由自建敏感词库自动审核',
    },
  })
}

export function registerComplianceRoutes(router: HttpRouter): void {
  router.define('compliance::status', '/api/v1/compliance/status', 'GET', complianceStatus)
}
