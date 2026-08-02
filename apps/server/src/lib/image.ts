/**
 * 心伴AI · 图像生成供应商抽象
 * 默认豆包 Seedream（火山引擎 / Volcengine API 适配器占位），
 * 未配置密钥时返回确定性的占位形象图。
 */
import { createHash } from 'node:crypto'
import { config } from '../config.js'
import { logger } from './logger.js'

export interface ImageGenerateOptions {
  prompt: string
  characterName: string
  width?: number
  height?: number
}

export interface ImageProvider {
  readonly name: string
  generate(opts: ImageGenerateOptions): Promise<{ url: string; provider: string }>
}

/** 火山引擎 Seedream 适配器（占位，真实签名后补） */
class SeedreamProvider implements ImageProvider {
  readonly name = 'seedream'

  isConfigured(): boolean {
    return config.seedream.accessKey.length > 0 && config.seedream.secretKey.length > 0
  }

  async generate(opts: ImageGenerateOptions): Promise<{ url: string; provider: string }> {
    if (!this.isConfigured()) {
      logger.warn('[image:seedream] 未配置 SEEDREAM_ACCESS_KEY，返回占位形象')
      return { url: placeholderAvatarUrl(opts.characterName, opts.prompt), provider: 'seedream-placeholder' }
    }
    // TODO: 接入火山引擎 CVProcess / visual.volcengineapi.com
    //   1. 生成请求签名（HMAC-SHA256, 类 AWS SigV4）
    //   2. POST / Action=CVProcess&Version=2022-08-31 请求 Text2Image
    //   3. 解析 image.base64 → 上传 OSS → 返回公网 URL
    logger.info('[image:seedream] 生成形象（占位调用）', {
      characterName: opts.characterName,
      prompt: opts.prompt.slice(0, 50),
      endpoint: config.seedream.endpoint,
    })
    return { url: placeholderAvatarUrl(opts.characterName, opts.prompt), provider: 'seedream' }
  }
}

/** 可插拔的图像供应商集合 */
let provider: ImageProvider | undefined

export function getImageProvider(): ImageProvider {
  if (provider) return provider
  switch (config.imageProvider) {
    case 'seedream':
    default:
      provider = new SeedreamProvider()
  }
  return provider
}

/**
 * 生成确定性的占位形象 URL（DiceBear 风格，基于角色名 hash）。
 */
export function placeholderAvatarUrl(name: string, extra = ''): string {
  const seed = createHash('md5').update(`${name}:${extra}`).digest('hex')
  return `https://api.dicebear.com/9.x/adventurer-neutral/png?seed=${encodeURIComponent(
    seed,
  )}&backgroundColor=f0e6d8&size=512`
}

/** 由定制项组装形象描述 */
export function buildPortraitPrompt(opts: {
  characterName: string
  basePersona: string
  hairstyle?: string
  outfit?: string
}): string {
  const parts = [
    `温柔亲和的中国女性AI陪伴角色「${opts.characterName}」，${opts.basePersona}`,
    `半身肖像，柔和自然光，浅景深`,
  ]
  if (opts.hairstyle) parts.push(`发型：${opts.hairstyle}`)
  if (opts.outfit) parts.push(`穿搭：${opts.outfit}`)
  parts.push('写实风格，温暖色调，高清，正面')
  return parts.join('，')
}
