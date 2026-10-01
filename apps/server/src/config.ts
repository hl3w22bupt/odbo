/**
 * 心伴AI · 环境配置
 * 统一从 process.env 读取，提供类型安全访问与默认值。
 */
import dotenv from 'dotenv'
dotenv.config()

function int(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function str(value: string | undefined, fallback: string): string {
  return value === undefined || value === '' ? fallback : value
}

export const config = {
  // 引擎
  iiiUrl: str(process.env.III_URL, 'ws://localhost:49134'),
  httpPort: int(process.env.HTTP_PORT, 3888),

  // 数据库
  databaseUrl: (() => {
    const value = str(process.env.DATABASE_URL, 'file:./data/xinban-dev.db')
    return value.startsWith('file:') ? value : 'file:./data/xinban-dev.db'
  })(),

  // JWT
  accessTokenSecret: str(process.env.ACCESS_TOKEN_SECRET, 'xinban-access-secret'),
  refreshTokenSecret: str(process.env.REFRESH_TOKEN_SECRET, 'xinban-refresh-secret'),
  accessTokenTtl: str(process.env.ACCESS_TOKEN_TTL, '2h'),
  refreshTokenTtl: str(process.env.REFRESH_TOKEN_TTL, '30d'),

  // 短信
  smsProvider: str(process.env.SMS_PROVIDER, 'dev'),
  aliyunSms: {
    accessKeyId: str(process.env.ALIYUN_SMS_ACCESS_KEY_ID, ''),
    accessKeySecret: str(process.env.ALIYUN_SMS_ACCESS_KEY_SECRET, ''),
    signName: str(process.env.ALIYUN_SMS_SIGN_NAME, '心伴AI'),
    templateCode: str(process.env.ALIYUN_SMS_TEMPLATE_CODE, 'SMS_000000'),
  },
  tencentSms: {
    secretId: str(process.env.TENCENT_SMS_SECRET_ID, ''),
    secretKey: str(process.env.TENCENT_SMS_SECRET_KEY, ''),
    sdkAppId: str(process.env.TENCENT_SMS_SDK_APP_ID, ''),
    signName: str(process.env.TENCENT_SMS_SIGN_NAME, '心伴AI'),
  },

  // LLM
  llmProvider: str(process.env.LLM_PROVIDER, 'deepseek'),
  deepseek: {
    apiKey: str(process.env.DEEPSEEK_API_KEY, ''),
    baseUrl: str(process.env.DEEPSEEK_BASE_URL, 'https://api.deepseek.com'),
    model: str(process.env.DEEPSEEK_MODEL, 'deepseek-chat'),
  },
  openai: {
    apiKey: str(process.env.OPENAI_API_KEY, ''),
    baseUrl: str(process.env.OPENAI_BASE_URL, 'https://api.openai.com/v1'),
    model: str(process.env.OPENAI_MODEL, 'gpt-4o-mini'),
  },

  // 图像
  imageProvider: str(process.env.IMAGE_PROVIDER, 'seedream'),
  seedream: {
    accessKey: str(process.env.SEEDREAM_ACCESS_KEY, ''),
    secretKey: str(process.env.SEEDREAM_SECRET_KEY, ''),
    endpoint: str(process.env.SEEDREAM_ENDPOINT, 'https://visual.volcengineapi.com'),
  },

  // 支付
  payProvider: str(process.env.PAY_PROVIDER, 'mock'),
  wechat: {
    mchId: str(process.env.WECHAT_MCH_ID, ''),
    apiV3Key: str(process.env.WECHAT_API_V3_KEY, ''),
    appId: str(process.env.WECHAT_APP_ID, ''),
    appSecret: str(process.env.WECHAT_APP_SECRET, ''),
  },
  alipay: {
    appId: str(process.env.ALIPAY_APP_ID, ''),
    privateKey: str(process.env.ALIPAY_PRIVATE_KEY, ''),
    publicKey: str(process.env.ALIPAY_PUBLIC_KEY, ''),
  },

  // 合规
  antiAddictionLateNight: bool(process.env.ANTI_ADDICTION_LATE_NIGHT, true),
  antiAddictionWindowMin: int(process.env.ANTI_ADDICTION_WINDOW_MIN, 60),
  antiAddictionLimitMin: int(process.env.ANTI_ADDICTION_LIMIT_MIN, 60),
  largePaymentThresholdCny: int(process.env.LARGE_PAYMENT_THRESHOLD_CNY, 500),

  // 配额
  freeDailyQuota: int(process.env.FREE_DAILY_QUOTA, 120),

  // 聊天
  chatReplyDelayMinMs: int(process.env.CHAT_REPLY_DELAY_MIN_MS, 1000),
  chatReplyDelayMaxMs: int(process.env.CHAT_REPLY_DELAY_MAX_MS, 3000),
  proactiveShareIntervalMin: int(process.env.PROACTIVE_SHARE_INTERVAL_MIN, 30),
  proactiveShareIdleMin: int(process.env.PROACTIVE_SHARE_IDLE_MIN, 15),

  // 审核
  contentFilterEnabled: bool(process.env.CONTENT_FILTER_ENABLED, true),

  // AI 提示条
  aiNotice: str(
    process.env.AI_VIRTUAL_NOTICE,
    '温馨提示：您正在与AI虚拟角色互动，对方并非真实人类。内容由人工智能生成，请理性对待，理性消费，适度娱乐，切勿沉迷。',
  ),
} as const

export type AppConfig = typeof config
