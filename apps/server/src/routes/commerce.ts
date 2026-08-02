/**
 * 心伴AI · 商业化路由
 * 商品/会员卡/订单/支付（微信+支付宝适配器占位）/回调验签/权益发放
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { ok, created } from '../lib/response.js'
import { authenticate } from '../http.js'
import { requireRole } from '../lib/auth.js'
import { AppError } from '../lib/errors.js'
import { audit } from '../lib/audit.js'
import { getPaymentProvider } from '../lib/payment.js'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

const MEMBERSHIP_PLAN_DAYS: Record<string, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  YEARLY: 365,
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

function genOrderNo(prefix: string): string {
  const d = new Date()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${pad(d.getMilliseconds(), 3)}`
  return `${prefix}${ts}${Math.floor(Math.random() * 9000 + 1000)}`
}

function serializeOrder(o: {
  id: string
  orderNo: string
  type: string
  productCode: string
  title: string
  amount: number
  currency: string
  status: string
  channel: string | null
  confirmed: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: o.id,
    orderNo: o.orderNo,
    type: o.type,
    productCode: o.productCode,
    title: o.title,
    amount: o.amount,
    amountYuan: (o.amount / 100).toFixed(2),
    currency: o.currency,
    status: o.status,
    channel: o.channel,
    confirmed: o.confirmed,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

async function listProducts(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const isMember = await isMemberUser(user.id)
  const type = ctx.query.type
  const where: Record<string, unknown> = { status: 'ACTIVE' }
  if (type) where.type = type
  const products = await prisma.product.findMany({ where, orderBy: { price: 'asc' } })
  return ok(
    products.map((p) => ({
      id: p.id,
      code: p.code,
      type: p.type,
      name: p.name,
      description: p.description,
      price: p.price,
      priceYuan: (p.price / 100).toFixed(2),
      originalPrice: p.originalPrice,
      originalPriceYuan: p.originalPrice ? (p.originalPrice / 100).toFixed(2) : null,
      durationDays: p.durationDays,
      benefits: safeJson(p.benefits),
      memberOnly: p.memberOnly,
      purchased: isMember && p.type === 'MEMBERSHIP',
    })),
  )
}

async function membershipPlans(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  void user
  // 权益对比表（前端展示）
  const plans = [
    {
      plan: 'MONTHLY',
      name: '月度会员',
      price: 3000,
      priceYuan: '30.00',
      originalPrice: 3900,
      durationDays: 30,
      benefits: [
        { key: 'unlock_vip_characters', label: '解锁 2 位专属角色', value: true },
        { key: 'unlimited_messages', label: '无限消息条数', value: true },
        { key: 'voice_packs', label: '专属语气包', value: true },
        { key: 'stories', label: '专属剧情', value: true },
        { key: 'limited_gifts', label: '限量礼物', value: true },
        { key: 'image_customize', label: '形象照片生成', value: true },
      ],
    },
    {
      plan: 'QUARTERLY',
      name: '季度会员',
      price: 7800,
      priceYuan: '78.00',
      originalPrice: 9900,
      durationDays: 90,
      benefits: [
        { key: 'unlock_vip_characters', label: '解锁 2 位专属角色', value: true },
        { key: 'unlimited_messages', label: '无限消息条数', value: true },
        { key: 'voice_packs', label: '专属语气包', value: true },
        { key: 'stories', label: '专属剧情', value: true },
        { key: 'limited_gifts', label: '限量礼物', value: true },
        { key: 'image_customize', label: '形象照片生成', value: true },
        { key: 'discount', label: '比按月购买省 34%', value: true },
      ],
    },
    {
      plan: 'YEARLY',
      name: '年度会员',
      price: 24800,
      priceYuan: '248.00',
      originalPrice: 35800,
      durationDays: 365,
      benefits: [
        { key: 'unlock_vip_characters', label: '解锁 2 位专属角色', value: true },
        { key: 'unlimited_messages', label: '无限消息条数', value: true },
        { key: 'voice_packs', label: '专属语气包', value: true },
        { key: 'stories', label: '专属剧情', value: true },
        { key: 'limited_gifts', label: '限量礼物', value: true },
        { key: 'image_customize', label: '形象照片生成', value: true },
        { key: 'discount', label: '比按月购买省 54%', value: true },
        { key: 'priority', label: '新角色优先体验', value: true },
      ],
    },
  ]
  return ok(plans)
}

async function createOrder(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const body = ctx.body as { productCode?: string }
  if (!body.productCode) throw AppError.badRequest('缺少 productCode')
  const product = await prisma.product.findUnique({ where: { code: body.productCode } })
  if (!product || product.status !== 'ACTIVE') throw AppError.notFound('商品不存在')

  const order = await prisma.order.create({
    data: {
      orderNo: genOrderNo('XB'),
      userId: user.id,
      productId: product.id,
      type: product.type,
      productCode: product.code,
      title: product.name,
      amount: product.price,
      status: 'PENDING',
    },
  })
  await audit('ORDER_CREATE', {
    userId: user.id,
    ip: ctx.ip ?? null,
    detail: { orderNo: order.orderNo, productCode: product.code, amount: product.price },
  })
  return created(serializeOrder(order), '订单已创建')
}

async function listOrders(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return ok(orders.map(serializeOrder))
}

async function orderDetail(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const orderId = ctx.params.id
  if (!orderId) throw AppError.badRequest('缺少订单 id')
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id } })
  if (!order) throw AppError.notFound('订单不存在')
  return ok(serializeOrder(order))
}

async function confirmLargePayment(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const orderId = ctx.params.id
  if (!orderId) throw AppError.badRequest('缺少订单 id')
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id } })
  if (!order) throw AppError.notFound('订单不存在')
  if (order.status !== 'PENDING' && order.status !== 'PENDING_CONFIRM') {
    throw AppError.conflict('订单状态不允许确认')
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { confirmed: true, confirmAt: new Date(), status: 'PENDING' },
  })
  await audit('PAY_CONFIRM', { userId: user.id, ip: ctx.ip ?? null, detail: { orderNo: order.orderNo } })
  return ok(serializeOrder(updated), '已确认支付')
}

/**
 * 发起支付。大额支付未二次确认时返回 LARGE_PAYMENT_CONFIRM（428）。
 */
async function payOrder(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const orderId = ctx.params.id
  if (!orderId) throw AppError.badRequest('缺少订单 id')
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: user.id } })
  if (!order) throw AppError.notFound('订单不存在')
  if (order.status !== 'PENDING' && order.status !== 'PENDING_CONFIRM') {
    throw AppError.conflict('订单当前状态不可支付')
  }

  const body = ctx.body as { channel?: string }
  const channel = body.channel === 'ALIPAY' ? 'ALIPAY' : 'WECHAT'

  // 理性消费：大额支付二次确认
  const thresholdCents = config.largePaymentThresholdCny * 100
  if (order.amount >= thresholdCents && !order.confirmed) {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'PENDING_CONFIRM' } })
    throw AppError.largePaymentConfirm('本次支付金额较大，请二次确认', {
      orderId: order.id,
      amountYuan: (order.amount / 100).toFixed(2),
      thresholdYuan: config.largePaymentThresholdCny,
    })
  }

  try {
    const provider = getPaymentProvider()
    const result = await provider.createPayment({
      channel,
      order: { orderNo: order.orderNo, title: order.title, amount: order.amount },
      userId: user.id,
    })
    await prisma.order.update({
      where: { id: order.id },
      data: { channel, payOrderNo: result.payOrderNo },
    })
    await audit('ORDER_PAY', { userId: user.id, ip: ctx.ip ?? null, detail: { orderNo: order.orderNo, channel } })
    return ok(
      {
        order: serializeOrder({ ...order, channel, status: order.status, confirmed: order.confirmed }),
        payParams: result.payParams,
        channel: result.channel,
      },
      '支付发起成功',
    )
  } catch (err) {
    if (err instanceof AppError) throw err
    throw AppError.payment('支付发起失败')
  }
}

async function currentMembership(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const now = new Date()
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: 'ACTIVE', expiresAt: { gt: now } },
    orderBy: { expiresAt: 'desc' },
  })
  if (!membership) return ok(null)
  return ok({
    id: membership.id,
    plan: membership.plan,
    startedAt: membership.startedAt,
    expiresAt: membership.expiresAt,
    daysLeft: Math.ceil((membership.expiresAt.getTime() - now.getTime()) / 86_400_000),
  })
}

/**
 * 支付回调统一处理：验签 → 置为已支付 → 发放权益。
 */
async function handlePayCallback(
  ctx: HttpRouteContext,
  channel: 'WECHAT' | 'ALIPAY',
): Promise<ReturnType<typeof ok>> {
  const provider = getPaymentProvider()
  const payload = ctx.body
  const verify = await provider.verifyCallback(channel, payload, ctx.headers)
  if (!verify.valid || !verify.payOrderNo) {
    logger.warn('[pay] 回调验签失败', { channel, payOrderNo: verify.payOrderNo })
    return ok({ code: 'FAIL', message: '验签失败' }, '验签失败')
  }

  const order = await prisma.order.findUnique({ where: { orderNo: verify.payOrderNo } })
  if (!order) {
    logger.warn('[pay] 回调订单不存在', { channel, payOrderNo: verify.payOrderNo })
    return ok({ code: 'NOT_FOUND', message: '订单不存在' }, '订单不存在')
  }

  await audit('PAY_CALLBACK', {
    userId: order.userId,
    ip: ctx.ip ?? null,
    detail: { channel, orderNo: order.orderNo, payOrderNo: verify.payOrderNo },
  })

  if (order.status === 'PAID') {
    return ok({ code: 'OK', message: '已处理' }, '已处理')
  }

  // 置为已支付
  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'PAID', paidAt: new Date() },
  })

  // 发放权益
  await grantOrderBenefits(order.id, order.userId, order.type, order.productCode)

  return ok({ code: 'OK', message: '支付成功' }, '支付成功')
}

/**
 * 发放订单权益：会员卡延长 / 单点内购（剧情、语气包、礼物）标记。
 */
async function grantOrderBenefits(orderId: string, userId: string, type: string, productCode: string): Promise<void> {
  if (type === 'MEMBERSHIP') {
    const plan = MEMBERSHIP_PLAN_DAYS[productCode.split('_')[1] as string]
    const days = plan ?? 30
    const now = new Date()
    const existing = await prisma.membership.findFirst({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
      orderBy: { expiresAt: 'desc' },
    })
    const start = existing ? existing.expiresAt : now
    const expiresAt = new Date(start.getTime() + days * 86_400_000)
    await prisma.membership.create({
      data: { userId, plan: productCode.split('_')[1] ?? 'MONTHLY', startedAt: now, expiresAt, orderId },
    })
    logger.info('[pay] 会员权益已发放', { userId, productCode, days, expiresAt })
  } else if (type === 'STORY' || type === 'VOICE_PACK' || type === 'GIFT') {
    // 单点内购：记录在 order.metadata（后续消费时校验）
    const product = await prisma.product.findUnique({ where: { code: productCode } })
    await prisma.order.update({
      where: { id: orderId },
      data: {
        metadata: JSON.stringify({
          entitlement: {
            type,
            productCode,
            productName: product?.name,
            grantedAt: new Date().toISOString(),
          },
        }),
      },
    })
    logger.info('[pay] 单点内购已发放', { userId, type, productCode })
  }
}

async function isMemberUser(userId: string): Promise<boolean> {
  const now = new Date()
  const active = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
  })
  return Boolean(active)
}

export function registerCommerceRoutes(router: HttpRouter): void {
  router.define('commerce::products', '/api/v1/products', 'GET', listProducts)
  router.define('commerce::membership-plans', '/api/v1/membership/plans', 'GET', membershipPlans)
  router.define('commerce::membership', '/api/v1/membership', 'GET', currentMembership)
  router.define('commerce::orders-create', '/api/v1/orders', 'POST', createOrder)
  router.define('commerce::orders-list', '/api/v1/orders', 'GET', listOrders)
  router.define('commerce::orders-detail', '/api/v1/orders/:id', 'GET', orderDetail)
  router.define('commerce::orders-pay', '/api/v1/orders/:id/pay', 'POST', payOrder)
  router.define('commerce::orders-confirm', '/api/v1/orders/:id/confirm', 'POST', confirmLargePayment)
  router.define('commerce::pay-wechat-notify', '/api/v1/pay/wechat/notify', 'POST', (ctx) => handlePayCallback(ctx, 'WECHAT'))
  router.define('commerce::pay-alipay-notify', '/api/v1/pay/alipay/notify', 'POST', (ctx) => handlePayCallback(ctx, 'ALIPAY'))
}
