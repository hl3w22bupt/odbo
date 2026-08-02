/**
 * 心伴AI · 支付网关抽象
 * mock    ：开发期占位（直接模拟支付成功回调）
 * wechat  ：微信支付适配器占位（Native / V3 签名验签）
 * alipay  ：支付宝适配器占位（RSA2 验签）
 * 真实商户号后补：仅需在适配器内填充真实调用逻辑。
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'
import { AppError } from './errors.js'
import { logger } from './logger.js'

export interface PayOrder {
  orderNo: string
  title: string
  amount: number // 分
}

export interface PayRequest {
  channel: 'WECHAT' | 'ALIPAY'
  order: PayOrder
  openId?: string
  userId?: string
}

export interface PayResult {
  channel: string
  payParams: Record<string, unknown>
  payOrderNo: string
}

export interface CallbackVerifyResult {
  valid: boolean
  payOrderNo?: string | undefined
  paidAmount?: number | undefined
  raw?: Record<string, unknown> | undefined
}

export interface PaymentProvider {
  readonly name: string
  createPayment(req: PayRequest): Promise<PayResult>
  verifyCallback(channel: string, payload: unknown, headers?: Record<string, string | string[] | undefined>): Promise<CallbackVerifyResult>
}

/** Mock 支付：直接返回可用的占位支付参数 */
class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock'

  async createPayment(req: PayRequest): Promise<PayResult> {
    const payOrderNo = `MOCK${Date.now()}${Math.floor(Math.random() * 10000)}`
    logger.info('[pay:mock] 创建支付（占位）', {
      orderNo: req.order.orderNo,
      amount: req.order.amount,
      channel: req.channel,
    })
    return {
      channel: req.channel,
      payOrderNo,
      payParams: {
        channel: req.channel.toLowerCase(),
        orderNo: req.order.orderNo,
        amount: req.order.amount,
        // 前端可调用模拟支付（开发用）
        mockPayUrl: `https://mock-pay.local/pay/${req.order.orderNo}`,
      },
    }
  }

  async verifyCallback(
    channel: string,
    payload: unknown,
    _headers?: Record<string, string | string[] | undefined>,
  ): Promise<CallbackVerifyResult> {
    const body = (payload ?? {}) as Record<string, unknown>
    return {
      valid: true,
      payOrderNo: typeof body.payOrderNo === 'string' ? body.payOrderNo : undefined,
      paidAmount: typeof body.amount === 'number' ? body.amount : undefined,
      raw: body,
    }
  }
}

/** 微信支付 V3 适配器（占位） */
class WeChatPaymentProvider implements PaymentProvider {
  readonly name = 'wechat'

  async createPayment(req: PayRequest): Promise<PayResult> {
    const { mchId, appId, apiV3Key } = config.wechat
    if (!mchId || !appId || !apiV3Key) {
      throw AppError.payment('微信支付未配置商户号，请联系管理员')
    }
    // TODO: 调用 /v3/pay/transactions/native，生成 code_url
    const payOrderNo = `WX${Date.now()}${Math.floor(Math.random() * 10000)}`
    return {
      channel: 'WECHAT',
      payOrderNo,
      payParams: {
        // 真实实现返回 code_url（Native 二维码）
        codeUrl: `weixin://wxpay/bizpayurl?pr=${payOrderNo}`,
        orderNo: req.order.orderNo,
      },
    }
  }

  async verifyCallback(
    channel: string,
    payload: unknown,
    headers?: Record<string, string | string[] | undefined>,
  ): Promise<CallbackVerifyResult> {
    if (channel !== 'WECHAT') return { valid: false }
    // 微信 V3 回调：验签名（Wechatpay-Signature / Wechatpay-Timestamp / Wechatpay-Nonce）
    const { apiV3Key } = config.wechat
    if (!apiV3Key) {
      logger.warn('[pay:wechat] 未配置 API V3 密钥，回调验签跳过（占位）')
      // 占位：直接信任并解析 body
      const body = (payload ?? {}) as Record<string, unknown>
      const resource = (body.resource ?? {}) as Record<string, unknown>
      return {
        valid: true,
        payOrderNo: typeof resource.out_trade_no === 'string' ? resource.out_trade_no : undefined,
        paidAmount: typeof resource.amount === 'object' && resource.amount ? Number((resource.amount as Record<string, unknown>).total) || undefined : undefined,
        raw: body,
      }
    }
    const timestamp = header(headers, 'wechatpay-timestamp')
    const nonce = header(headers, 'wechatpay-nonce')
    const signature = header(headers, 'wechatpay-signature')
    if (!timestamp || !nonce || !signature) return { valid: false }
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})
    const message = `${timestamp}\n${nonce}\n${bodyStr}\n`
    const expected = createHmac('sha256', apiV3Key).update(message).digest('base64')
    // 占位验签（真实场景需用平台证书验签，此处简化为 HMAC 比对）
    const ok = safeEqual(expected, signature)
    const body = JSON.parse(bodyStr) as Record<string, unknown>
    const resource = (body.resource ?? {}) as Record<string, unknown>
    return {
      valid: ok,
      payOrderNo: ok ? (typeof resource.out_trade_no === 'string' ? resource.out_trade_no : undefined) : undefined,
      paidAmount: ok && typeof resource.amount === 'object' && resource.amount ? Number((resource.amount as Record<string, unknown>).total) || undefined : undefined,
      raw: body,
    }
  }
}

/** 支付宝适配器（占位） */
class AlipayPaymentProvider implements PaymentProvider {
  readonly name = 'alipay'

  async createPayment(req: PayRequest): Promise<PayResult> {
    const { appId } = config.alipay
    if (!appId) {
      throw AppError.payment('支付宝未配置 APP_ID，请联系管理员')
    }
    // TODO: 调用 alipay.trade.page.pay / app.pay，返回支付串
    const payOrderNo = `ALI${Date.now()}${Math.floor(Math.random() * 10000)}`
    return {
      channel: 'ALIPAY',
      payOrderNo,
      payParams: {
        orderStr: `alipay_sdk=alipay-sdk-js&app_id=${appId}&out_trade_no=${req.order.orderNo}&total_amount=${(req.order.amount / 100).toFixed(2)}`,
        orderNo: req.order.orderNo,
      },
    }
  }

  async verifyCallback(
    channel: string,
    payload: unknown,
    _headers?: Record<string, string | string[] | undefined>,
  ): Promise<CallbackVerifyResult> {
    if (channel !== 'ALIPAY') return { valid: false }
    const body = (payload ?? {}) as Record<string, unknown>
    const { publicKey } = config.alipay
    if (!publicKey) {
      logger.warn('[pay:alipay] 未配置支付宝公钥，回调验签跳过（占位）')
      return {
        valid: true,
        payOrderNo: typeof body.out_trade_no === 'string' ? body.out_trade_no : undefined,
        paidAmount: typeof body.total_amount === 'string' ? Math.round(Number(body.total_amount) * 100) : undefined,
        raw: body,
      }
    }
    // TODO: RSA2 验签（剔除 sign / sign_type 后按 key 排序拼接）
    const ok = body.trade_status === 'TRADE_SUCCESS' || body.trade_status === 'TRADE_FINISHED'
    return {
      valid: ok,
      payOrderNo: typeof body.out_trade_no === 'string' ? body.out_trade_no : undefined,
      paidAmount: typeof body.total_amount === 'string' ? Math.round(Number(body.total_amount) * 100) : undefined,
      raw: body,
    }
  }
}

function header(headers: Record<string, string | string[] | undefined> | undefined, key: string): string | undefined {
  if (!headers) return undefined
  const v = headers[key]
  if (Array.isArray(v)) return v[0]
  return v
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

let provider: PaymentProvider | undefined

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider
  switch (config.payProvider) {
    case 'wechat':
      provider = new WeChatPaymentProvider()
      break
    case 'alipay':
      provider = new AlipayPaymentProvider()
      break
    case 'mock':
    default:
      provider = new MockPaymentProvider()
  }
  return provider
}
