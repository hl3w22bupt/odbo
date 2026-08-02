/**
 * 心伴AI · 短信供应商抽象
 * dev     ：开发期占位，验证码固定 123456（未配置密钥时兜底）
 * aliyun  ：阿里云短信适配器占位
 * tencent ：腾讯云短信适配器占位
 */
import { config } from '../config.js'
import { AppError } from './errors.js'
import { logger } from './logger.js'

export interface SmsSendOptions {
  phone: string
  code: string
  purpose: string
}

export interface SmsProvider {
  readonly name: string
  send(opts: SmsSendOptions): Promise<void>
}

/** 开发期占位：固定验证码 123456 */
class DevSmsProvider implements SmsProvider {
  readonly name = 'dev'

  async send(opts: SmsSendOptions): Promise<void> {
    logger.info('[sms:dev] 验证码（开发模式固定 123456）', {
      phone: maskPhone(opts.phone),
      purpose: opts.purpose,
    })
  }
}

/** 阿里云短信适配器（占位实现，真实密钥后补） */
class AliyunSmsProvider implements SmsProvider {
  readonly name = 'aliyun'

  async send(opts: SmsSendOptions): Promise<void> {
    const { accessKeyId, accessKeySecret, signName, templateCode } = config.aliyunSms
    if (!accessKeyId || !accessKeySecret) {
      // 未配置密钥时兜底为开发模式固定验证码
      logger.warn('[sms:aliyun] 未配置密钥，回退开发模式', { phone: maskPhone(opts.phone) })
      return
    }
    // TODO: 接入阿里云 dysmsapi 签名鉴权（RPC 风格）
    logger.info('[sms:aliyun] 发送短信（占位）', {
      phone: maskPhone(opts.phone),
      signName,
      templateCode,
      purpose: opts.purpose,
    })
  }
}

/** 腾讯云短信适配器（占位实现，真实密钥后补） */
class TencentSmsProvider implements SmsProvider {
  readonly name = 'tencent'

  async send(opts: SmsSendOptions): Promise<void> {
    const { secretId, secretKey, sdkAppId, signName } = config.tencentSms
    if (!secretId || !secretKey || !sdkAppId) {
      logger.warn('[sms:tencent] 未配置密钥，回退开发模式', { phone: maskPhone(opts.phone) })
      return
    }
    // TODO: 接入腾讯云 sms TC3-HMAC-SHA256 签名
    logger.info('[sms:tencent] 发送短信（占位）', {
      phone: maskPhone(opts.phone),
      sdkAppId,
      signName,
      purpose: opts.purpose,
    })
  }
}

function maskPhone(phone: string): string {
  if (phone.length >= 7) return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  return '****'
}

let provider: SmsProvider | undefined

export function getSmsProvider(): SmsProvider {
  if (provider) return provider
  switch (config.smsProvider) {
    case 'aliyun':
      provider = new AliyunSmsProvider()
      break
    case 'tencent':
      provider = new TencentSmsProvider()
      break
    default:
      provider = new DevSmsProvider()
  }
  return provider
}

/** 生成 6 位验证码 */
export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/** 是否为开发模式固定验证码 */
export function isDevFallbackCode(code: string): boolean {
  return code === '123456' && config.smsProvider === 'dev'
}

export function assertValidPhone(phone: string): void {
  if (!/^1\d{10}$/.test(phone)) {
    throw AppError.badRequest('手机号格式不正确')
  }
}
