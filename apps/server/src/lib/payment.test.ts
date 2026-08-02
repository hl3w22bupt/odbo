/**
 * 支付网关单元测试（mock 适配器 + 回调验签）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { getPaymentProvider } from './payment.js'

describe('MockPaymentProvider', () => {
  let provider: ReturnType<typeof getPaymentProvider>

  beforeAll(() => {
    process.env.PAY_PROVIDER = 'mock'
    // 重置单例
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(getPaymentProvider as unknown as { replace?: never }).replace
  })

  it('创建支付返回支付参数', async () => {
    const p = getPaymentProvider()
    const result = await p.createPayment({
      channel: 'WECHAT',
      order: { orderNo: 'XB123', title: '月度会员', amount: 3000 },
    })
    expect(result.channel).toBe('WECHAT')
    expect(result.payOrderNo).toBeTruthy()
    expect(result.payParams).toHaveProperty('orderNo')
  })

  it('回调验签（mock 恒通过）', async () => {
    const p = getPaymentProvider()
    const result = await p.verifyCallback('WECHAT', {
      payOrderNo: 'MOCK123',
      amount: 3000,
    })
    expect(result.valid).toBe(true)
    expect(result.payOrderNo).toBe('MOCK123')
  })
})
