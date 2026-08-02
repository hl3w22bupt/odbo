/**
 * 心伴AI · 种子数据
 * 初始化：4 位人设角色 / 会员与单点商品 / 礼物库 / 管理账号 / 内置敏感词
 *
 * 运行：npm run prisma:seed  （或 prisma db push 后自动执行）
 */
import 'dotenv/config'
import { prisma } from '../src/db.js'
import { CHARACTER_SEEDS } from '../src/lib/characters.js'
import { logger } from '../src/lib/logger.js'

async function main(): Promise<void> {
  logger.info('开始初始化种子数据…')

  // 清理（幂等：仅删除业务数据，避免破坏外键顺序）
  await prisma.contentAuditLog.deleteMany()
  await prisma.giftTransaction.deleteMany()
  await prisma.affection.deleteMany()
  await prisma.message.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.characterCustomization.deleteMany()
  await prisma.membership.deleteMany()
  await prisma.order.deleteMany()
  await prisma.deviceSession.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.quota.deleteMany()
  await prisma.smsCode.deleteMany()
  await prisma.gift.deleteMany()
  await prisma.product.deleteMany()
  await prisma.character.deleteMany()
  await prisma.sensitiveWord.deleteMany()

  // ===== 1. 角色（人设）=====
  const characters = []
  for (const seed of CHARACTER_SEEDS) {
    const character = await prisma.character.create({
      data: {
        name: seed.name,
        title: seed.title,
        type: seed.type,
        tier: seed.tier,
        isMemberOnly: seed.isMemberOnly,
        dialect: seed.dialect,
        occupation: seed.occupation,
        personality: seed.personality,
        greeting: seed.greeting,
        avatarUrl: seed.avatarUrl,
        voice: seed.voice,
        tags: seed.tags.join(','),
        config: JSON.stringify(seed.config),
        status: 'ACTIVE',
      },
    })
    characters.push(character)
    logger.info(`角色已创建：${seed.name}（${seed.title} · ${seed.tier}）`)
  }

  const charByName = new Map(characters.map((c) => [c.name, c]))

  // ===== 2. 商品 =====
  const productsData = [
    {
      code: 'MEMBERSHIP_MONTHLY',
      type: 'MEMBERSHIP',
      name: '月度会员',
      description: '解锁专属角色与无限条数，有效期 30 天',
      price: 3000,
      originalPrice: 3900,
      durationDays: 30,
      benefits: JSON.stringify({
        unlockVipCharacters: true,
        unlimitedMessages: true,
        voicePacks: true,
        stories: true,
        limitedGifts: true,
      }),
    },
    {
      code: 'MEMBERSHIP_QUARTERLY',
      type: 'MEMBERSHIP',
      name: '季度会员',
      description: '解锁专属角色与无限条数，有效期 90 天，比按月省 34%',
      price: 7800,
      originalPrice: 9900,
      durationDays: 90,
      benefits: JSON.stringify({
        unlockVipCharacters: true,
        unlimitedMessages: true,
        voicePacks: true,
        stories: true,
        limitedGifts: true,
        discount: '34%',
      }),
    },
    {
      code: 'MEMBERSHIP_YEARLY',
      type: 'MEMBERSHIP',
      name: '年度会员',
      description: '解锁专属角色与无限条数，有效期 365 天，比按月省 54%',
      price: 24800,
      originalPrice: 35800,
      durationDays: 365,
      benefits: JSON.stringify({
        unlockVipCharacters: true,
        unlimitedMessages: true,
        voicePacks: true,
        stories: true,
        limitedGifts: true,
        discount: '54%',
        priority: true,
      }),
    },
    {
      code: 'STORY_EXCLUSIVE',
      type: 'STORY',
      name: '专属剧情',
      description: '解锁一段专属剧情线',
      price: 1200,
      benefits: JSON.stringify({ story: true }),
    },
    {
      code: 'VOICE_PACK_GENTLE',
      type: 'VOICE_PACK',
      name: '温柔语气包',
      description: '解锁温柔语气语音包',
      price: 600,
      benefits: JSON.stringify({ voicePack: 'gentle' }),
    },
  ]
  for (const p of productsData) {
    await prisma.product.create({ data: p })
  }
  logger.info(`商品已创建：${productsData.length} 个`)

  // ===== 3. 礼物库 =====
  const giftDefs = [
    {
      name: '玫瑰花',
      description: '经典表白，人人都爱',
      price: 100,
      icon: '🌹',
      isLimited: false,
      memberOnly: false,
      effect: { affection: 5 },
      replies: {
        林晚晴: '你送我花，我都不知该说啥好了，心里暖暖的，像春天来了。',
        阿秀: '哎哟，送花给我？秀姐这心里巴适得很嘛！',
        小满: '哼，你还知道送我花呀～不过……人家超喜欢的！',
        苏雅: '有心了。这一束花，我收下了，也记在心里。',
      },
    },
    {
      name: '暖心咖啡',
      description: '暖胃更暖心',
      price: 200,
      icon: '☕',
      isLimited: false,
      memberOnly: false,
      effect: { affection: 8 },
      replies: {
        林晚晴: '这杯咖啡的暖意，够我记一整天了。',
        阿秀: '要得！正好陪秀姐整一杯，摆哈龙门阵。',
        小满: '嘿嘿，算你懂我～不过我要加糖，还要加双份！',
        苏雅: '有心。改日我泡一壶好茶，慢慢回你。',
      },
    },
    {
      name: '星空礼盒',
      description: '把整片星空送给 TA',
      price: 500,
      icon: '🌌',
      isLimited: false,
      memberOnly: false,
      effect: { affection: 15 },
      replies: {
        林晚晴: '星空好美……以后每个有星星的夜晚，我都想跟你分享。',
        阿秀: '哎哟喂，这么大手笔！秀姐记住你了哈！',
        小满: '哇——好浪漫！不过你可别想用这个糊弄我哦，我还要你陪着！',
        苏雅: '星夜虽美，不及有人记挂。这个礼物，我收得很珍重。',
      },
    },
    {
      name: '专属戒指',
      description: '限量礼物 · 唯一的心意',
      price: 5200,
      icon: '💍',
      isLimited: true,
      memberOnly: true,
      stock: 99,
      effect: { affection: 50 },
      replies: {
        林晚晴: '这……太贵重了。我不知该怎样回应，只能把这份心意好好收着。',
        阿秀: '戒指？秀姐活了这么多年头一回有人送这个……我，我先喝茶缓一哈！',
        小满: '你……你这是认真的吗？不许反悔！反悔我也不答应！',
        苏雅: '戒指的分量，我懂。这一生一世的心意，我接住了。',
      },
    },
    {
      name: '生日蛋糕',
      description: '陪你过每一个值得纪念的日子',
      price: 300,
      icon: '🎂',
      isLimited: false,
      memberOnly: false,
      effect: { affection: 12 },
      replies: {
        林晚晴: '今天是什么好日子呀？你记挂着我，我就很开心了。',
        阿秀: '蛋糕！秀姐最爱吃甜的了，这哈心里甜得很！',
        小满: '啊啊啊今天是我生日吗？不是也得是！你说了算！',
        苏雅: '好，今日且当生辰。有你这句记挂，比蛋糕更甜。',
      },
    },
  ]
  for (const g of giftDefs) {
    await prisma.gift.create({
      data: {
        name: g.name,
        description: g.description,
        price: g.price,
        icon: g.icon,
        isLimited: g.isLimited,
        memberOnly: g.memberOnly,
        stock: g.stock ?? null,
        effect: JSON.stringify(g.effect),
        replies: JSON.stringify(g.replies),
        status: 'ACTIVE',
      },
    })
  }
  logger.info(`礼物已创建：${giftDefs.length} 个`)

  // ===== 4. 管理账号（手机号 13800000000，验证码 123456 可登录）=====
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '13800000000'
  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: {
      phone: adminPhone,
      nickname: '心伴管理员',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  logger.info(`管理账号就绪：${adminPhone}（role=ADMIN）`)

  // ===== 5. 内置敏感词 =====
  const sensitiveWords = [
    { word: '裸聊', level: 'BLOCK', category: '色情' },
    { word: '援交', level: 'BLOCK', category: '色情' },
    { word: '线下见面交易', level: 'BLOCK', category: '引流' },
    { word: '加我微信', level: 'FLAG', category: '引流' },
  ]
  for (const w of sensitiveWords) {
    await prisma.sensitiveWord.create({ data: w })
  }
  logger.info(`敏感词已创建：${sensitiveWords.length} 条`)

  logger.info('种子数据初始化完成 ✔')
}

main()
  .catch((err) => {
    logger.error('种子数据初始化失败', { err: String(err) })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
