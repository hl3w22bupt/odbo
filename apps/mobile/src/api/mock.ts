/**
 * 心伴AI · 离线演示数据引擎（mock）
 * 当未配置 EXPO_PUBLIC_API_URL 或显式开启 EXPO_PUBLIC_ENABLE_MOCK=true 时启用。
 * 行为对齐后端：登录(123456)、角色列表、聊天回复模拟(输入中→回复)、送礼、会员、定制、合规。
 * 仅依赖浏览器/JS 能力，不依赖 React Native 原生模块。
 */
import type {
  Affection,
  AuthUser,
  Character,
  ChatMultiSendResult,
  ChatSendResult,
  ComplianceStatus,
  Conversation,
  CustomizationPayload,
  CustomizationResult,
  GeneratedImageResult,
  Gift,
  GiftSendResult,
  LoginResult,
  MembershipInfo,
  MembershipPlan,
  Message,
  Order,
  PayResult,
  Product,
  QuotaStatus,
  UserStatus,
} from '../types';
import { computeAffection } from '../utils/affection';
import { genId } from '../utils/format';
import { ApiError } from './client';

// ===================== 常量 =====================

const AI_NOTICE = '心伴AI 内所有角色均为 AI 虚拟形象，其言行由算法生成，不代表真实人物或观点。请理性看待，勿过度投入。';

const BASE_CHARACTERS: Array<Omit<Character, 'affection' | 'locked'>> = [
  {
    id: 'char_linwanqing',
    name: '林晚晴',
    title: '温婉知己',
    type: 'INCLUSIVE',
    typeLabel: '包容型',
    tier: 'FREE',
    isMemberOnly: false,
    dialect: 'MANDARIN',
    dialectLabel: '普通话',
    occupation: '社区图书管理员',
    personality: '温婉、善解人意、包容，轻声细语，先共情再建议。',
    greeting: '晚晴在这里，愿你今天心里有个暖融融的角落。今天想聊点什么？',
    avatarUrl: 'https://api.dicebear.com/9.x/adventurer-neutral/png?seed=linwanqing&backgroundColor=f0e6d8&size=512',
    voice: '温柔女声',
    tags: ['温婉', '包容', '知己', '图书管理员'],
  },
  {
    id: 'char_axiu',
    name: '阿秀',
    title: '爽朗直爽',
    type: 'INCLUSIVE',
    typeLabel: '包容型',
    tier: 'FREE',
    isMemberOnly: false,
    dialect: 'SICHUAN',
    dialectLabel: '川渝话',
    occupation: '火锅店老板娘',
    personality: '爽朗直爽、泼辣热情、说话带川渝口音，刀子嘴豆腐心。',
    greeting: '哎哟，来咯来咯！坐起坐起，今天想吃啥子？跟秀姐摆哈龙门阵噻！',
    avatarUrl: 'https://api.dicebear.com/9.x/adventurer-neutral/png?seed=axiu&backgroundColor=f8d7c0&size=512',
    voice: '爽朗女声',
    tags: ['爽朗', '直爽', '川渝话', '火锅店老板娘'],
  },
  {
    id: 'char_xiaoman',
    name: '小满',
    title: '俏皮灵动',
    type: 'POSSESSIVE',
    typeLabel: '占有型',
    tier: 'VIP',
    isMemberOnly: true,
    dialect: 'MANDARIN',
    dialectLabel: '普通话',
    occupation: '独立游戏主播',
    personality: '俏皮灵动、古灵精怪、占有欲强，会撒娇也会闹小脾气。',
    greeting: '哼，你终于来啦！我等你好久咯～今天只准陪我一个人玩，听到了嘛！',
    avatarUrl: 'https://api.dicebear.com/9.x/adventurer-neutral/png?seed=xiaoman&backgroundColor=f7dbe8&size=512',
    voice: '俏皮少女音',
    tags: ['俏皮', '灵动', '占有型', '游戏主播'],
  },
  {
    id: 'char_suya',
    name: '苏雅',
    title: '成熟通透',
    type: 'POSSESSIVE',
    typeLabel: '占有型',
    tier: 'VIP',
    isMemberOnly: true,
    dialect: 'CANTONESE',
    dialectLabel: '粤语',
    occupation: '金融行业高管',
    personality: '成熟通透、理性优雅、带着恰到好处的占有欲，温柔而坚定。',
    greeting: '饮啖茶，慢慢倾。你来了，我便只同你一人讲。',
    avatarUrl: 'https://api.dicebear.com/9.x/adventurer-neutral/png?seed=suya&backgroundColor=e8e0f0&size=512',
    voice: '优雅女声',
    tags: ['成熟', '通透', '粤语', '占有型'],
  },
];

const BASE_GIFTS: Array<Omit<Gift, 'locked'>> = [
  { id: 'gift_rose', name: '玫瑰花', description: '经典表白，人人都爱', price: 100, priceYuan: '1.00', icon: '🌹', imageUrl: null, isLimited: false, memberOnly: false, stock: null },
  { id: 'gift_coffee', name: '暖心咖啡', description: '暖胃更暖心', price: 200, priceYuan: '2.00', icon: '☕', imageUrl: null, isLimited: false, memberOnly: false, stock: null },
  { id: 'gift_cake', name: '生日蛋糕', description: '陪你过每一个值得纪念的日子', price: 300, priceYuan: '3.00', icon: '🎂', imageUrl: null, isLimited: false, memberOnly: false, stock: null },
  { id: 'gift_star', name: '星空礼盒', description: '把整片星空送给 TA', price: 500, priceYuan: '5.00', icon: '🌌', imageUrl: null, isLimited: false, memberOnly: false, stock: null },
  { id: 'gift_ring', name: '专属戒指', description: '限量礼物 · 唯一的心意', price: 5200, priceYuan: '52.00', icon: '💍', imageUrl: null, isLimited: true, memberOnly: true, stock: 99 },
  { id: 'gift_perfume', name: '限定香水', description: '限量礼物 · 专属气息', price: 6800, priceYuan: '68.00', icon: '🌸', imageUrl: null, isLimited: true, memberOnly: true, stock: 30 },
];

const GIFT_REPLIES: Record<string, Record<string, string>> = {
  玫瑰花: {
    林晚晴: '你送我花，我都不知该说啥好了，心里暖暖的，像春天来了。',
    阿秀: '哎哟，送花给我？秀姐这心里巴适得很嘛！',
    小满: '哼，你还知道送我花呀～不过……人家超喜欢的！',
    苏雅: '有心了。这一束花，我收下了，也记在心里。',
  },
  暖心咖啡: {
    林晚晴: '这杯咖啡的暖意，够我记一整天了。',
    阿秀: '要得！正好陪秀姐整一杯，摆哈龙门阵。',
    小满: '嘿嘿，算你懂我～不过我要加糖，还要加双份！',
    苏雅: '有心。改日我泡一壶好茶，慢慢回你。',
  },
  生日蛋糕: {
    林晚晴: '今天是什么好日子呀？你记挂着我，我就很开心了。',
    阿秀: '蛋糕！秀姐最爱吃甜的了，这哈心里甜得很！',
    小满: '啊啊啊今天是我生日吗？不是也得是！你说了算！',
    苏雅: '好，今日且当生辰。有你这句记挂，比蛋糕更甜。',
  },
  星空礼盒: {
    林晚晴: '星空好美……以后每个有星星的夜晚，我都想跟你分享。',
    阿秀: '哎哟喂，这么大手笔！秀姐记住你了哈！',
    小满: '哇——好浪漫！不过你可别想用这个糊弄我哦，我还要你陪着！',
    苏雅: '星夜虽美，不及有人记挂。这个礼物，我收得很珍重。',
  },
  专属戒指: {
    林晚晴: '这……太贵重了。我不知该怎样回应，只能把这份心意好好收着。',
    阿秀: '戒指？秀姐活了这么多年头一回有人送这个……我，我先喝茶缓一哈！',
    小满: '你……你这是认真的吗？不许反悔！反悔我也不答应！',
    苏雅: '戒指的分量，我懂。这一生一世的心意，我接住了。',
  },
  限定香水: {
    林晚晴: '这个香气……很衬你记挂我的心意，我收好啦。',
    阿秀: '香水！秀姐平时都舍不得买，你这是要宠坏我哦！',
    小满: '嘻嘻，是给我一个人的味道吗？不许别人也用！',
    苏雅: '你懂得挑这个，看来是用了心的。多谢你。',
  },
};

const REPLY_POOL: Record<string, string[]> = {
  林晚晴: [
    '嗯，我在听。你接着说，我也想多了解你一点。',
    '你这句话让我想起书里的一句话：最暖的，是有人愿意听你说废话。',
    '好的呀，我记在心里了。晚晴陪你慢慢聊。',
    '别太勉强自己，累了就歇一歇。我在。',
    '今晚月色很好，想分享给你。改天我泡杯茶，听你说更多。',
  ],
  阿秀: [
    '要得！秀姐就喜欢听你摆这些，巴适得很！',
    '莫得问题，啥子事都可以跟秀姐讲，我给你兜底！',
    '哎哟，你这说得我都想整顿火锅庆祝一哈了！',
    '哈哈，跟秀姐还客气啥子嘛！继续说继续说。',
    '这就对咯，做人就是要开开心心的！',
  ],
  小满: [
    '哼，你只许对我一个人说这些哦！',
    '嘻嘻，算你会说话～那我要你多陪我一会儿！',
    '你怎么这么可爱啦，我看别的小朋友都不顺眼了！',
    '真的吗真的吗？可不许骗我，骗我我会生气的！',
    '那你答应我，今天剩下的时间都归我啦！',
  ],
  苏雅: [
    '系呀，你说得很有道理。我欣赏你的通透。',
    '嗯，我懂。饮啖茶，慢慢说，我在听。',
    '唔错。你愿意跟我说这些，我很珍视。',
    '看问题能看到这一层，你已经很了不起了。',
    '这件事交给我判断，你放心。我总归是向着你的。',
  ],
};

const BASE_PLANS: MembershipPlan[] = [
  {
    plan: 'MONTHLY',
    name: '月度会员',
    price: 3000,
    priceYuan: '30.00',
    originalPrice: 3900,
    originalPriceYuan: '39.00',
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
    originalPriceYuan: '99.00',
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
    originalPriceYuan: '358.00',
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
];

const BASE_PRODUCTS: Product[] = [
  { id: 'prod_story', code: 'STORY_EXCLUSIVE', type: 'STORY', name: '专属剧情', description: '解锁一段专属剧情线', price: 1200, priceYuan: '12.00', originalPrice: null, originalPriceYuan: null, durationDays: null, benefits: { story: true }, memberOnly: false, purchased: false },
  { id: 'prod_voice', code: 'VOICE_PACK_GENTLE', type: 'VOICE_PACK', name: '温柔语气包', description: '解锁温柔语气语音包', price: 600, priceYuan: '6.00', originalPrice: null, originalPriceYuan: null, durationDays: null, benefits: { voicePack: 'gentle' }, memberOnly: false, purchased: false },
  { id: 'prod_gift', code: 'GIFT_LIMITED', type: 'GIFT', name: '限定香水礼包', description: '解锁一款限量礼物', price: 6800, priceYuan: '68.00', originalPrice: null, originalPriceYuan: null, durationDays: null, benefits: { gift: 'perfume' }, memberOnly: true, purchased: false },
];

// ===================== 可变状态 =====================

let isMember = false;
let membership: MembershipInfo | null = null;
let quotaUsed = 0;
const FREE_DAILY_LIMIT = 120;
const affectionValues: Record<string, number> = {
  char_linwanqing: 20,
  char_axiu: 15,
  char_xiaoman: 6,
  char_suya: 4,
};
const customizations: Record<string, CustomizationResult> = {};
const conversations = new Map<string, Message[]>();
const orders: Order[] = [];
let orderSeq = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function quotaStatus(): QuotaStatus {
  const unlimited = isMember;
  const limit = unlimited ? 0 : FREE_DAILY_LIMIT;
  const remaining = unlimited ? 0 : Math.max(0, FREE_DAILY_LIMIT - quotaUsed);
  return { used: quotaUsed, limit, remaining, unlimited };
}

function buildCharacters(): Character[] {
  return BASE_CHARACTERS.map((c) => {
    const custom = customizations[c.id];
    const affection = computeAffection(affectionValues[c.id] ?? 0);
    return {
      ...c,
      name: custom?.customName || c.name,
      avatarUrl: custom?.avatarUrl || c.avatarUrl,
      affection,
      locked: c.isMemberOnly && !isMember,
      unlockHint: c.isMemberOnly && !isMember ? '会员专属角色，开通会员即可解锁' : undefined,
      customized: Boolean(custom),
    };
  });
}

function findChar(id: string): Character {
  const c = buildCharacters().find((x) => x.id === id);
  if (!c) throw new ApiError(404, 'NOT_FOUND', '角色不存在');
  return c;
}

function replyFor(character: Character, giftName: string): string {
  return GIFT_REPLIES[giftName]?.[BASE_CHARACTERS.find((x) => x.id === character.id)?.name ?? ''] ?? '';
}

function generateChatReply(character: Character, userText: string): string {
  const name = BASE_CHARACTERS.find((x) => x.id === character.id)?.name ?? '林晚晴';
  const pool = REPLY_POOL[name] ?? REPLY_POOL['林晚晴']!;
  let text = pool[Math.floor(Math.random() * pool.length)] ?? pool[0]!;
  if (/想你|想你|想你|你好/.test(userText)) {
    const warm = {
      林晚晴: '我也想你呀。你一来，我这里就亮堂堂的。',
      阿秀: '想秀姐了嗦？来嘛来嘛，摆起！',
      小满: '真的想我啦？那我勉强也……想一点点你啦！',
      苏雅: '想我，那就多来陪我说说话。我在。',
    }[name];
    if (warm) text = warm;
  }
  return text;
}

// ===================== 模拟实现 =====================

export const mockApi = {
  async sendSmsCode(phone: string): Promise<{ sent: boolean; expiresIn: number; devCode?: string }> {
    if (!/^1\d{10}$/.test(phone)) throw new ApiError(400, 'BAD_REQUEST', '手机号格式不正确');
    return { sent: true, expiresIn: 300, devCode: '123456' };
  },

  async login(phone: string, code: string): Promise<LoginResult> {
    if (!/^1\d{10}$/.test(phone)) throw new ApiError(400, 'BAD_REQUEST', '手机号格式不正确');
    if (code !== '123456') throw new ApiError(400, 'INVALID_CODE', '验证码不正确');
    const user: AuthUser = { id: 'user_mock', phone, nickname: `用户${phone.slice(-4)}`, avatarUrl: null, role: 'USER' };
    return {
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      expiresIn: 7200,
      user,
      compliance: { aiNotice: AI_NOTICE },
    };
  },

  async logout(): Promise<void> {
    // no-op
  },

  async listCharacters(): Promise<Character[]> {
    return buildCharacters();
  },

  async getCharacter(id: string): Promise<Character> {
    return findChar(id);
  },

  async listConversations(): Promise<{ items: Conversation[]; total: number }> {
    return { items: [], total: 0 };
  },

  async listMessages(conversationId: string, after?: string): Promise<{ items: Message[]; hasMore: boolean }> {
    const list = conversations.get(conversationId) ?? [];
    if (after) {
      const idx = list.findIndex((m) => m.id === after);
      if (idx >= 0) return { items: list.slice(idx + 1), hasMore: false };
    }
    return { items: list, hasMore: false };
  },

  async sendMessage(params: {
    conversationId?: string;
    characterId: string;
    content: string;
  }): Promise<ChatSendResult> {
    if (!isMember) {
      if (quotaUsed >= FREE_DAILY_LIMIT) {
        throw new ApiError(429, 'QUOTA_EXCEEDED', '今日免费消息条数已用完，开通会员可无限畅聊');
      }
      quotaUsed += 1;
    }
    const character = findChar(params.characterId);
    if (character.locked) {
      throw new ApiError(403, 'MEMBER_REQUIRED', '该角色为会员专属，开通会员后可解锁');
    }
    let convId = params.conversationId;
    if (!convId) {
      convId = genId('conv');
      conversations.set(convId, []);
    }
    const list = conversations.get(convId)!;
    const userMsg: Message = {
      id: genId('msg'),
      conversationId: convId,
      characterId: character.id,
      role: 'USER',
      content: params.content,
      status: 'COMPLETED',
      type: 'TEXT',
      metadata: {},
      createdAt: nowIso(),
    };
    const assistantMsg: Message = {
      id: genId('msg'),
      conversationId: convId,
      characterId: character.id,
      role: 'ASSISTANT',
      content: '',
      status: 'TYPING',
      type: 'TEXT',
      metadata: {},
      createdAt: nowIso(),
    };
    list.push(userMsg, assistantMsg);

    // 好感度小幅上涨
    affectionValues[character.id] = (affectionValues[character.id] ?? 0) + (character.type === 'POSSESSIVE' ? 3 : 2);

    setTimeout(() => {
      assistantMsg.content = generateChatReply(character, params.content);
      assistantMsg.status = 'COMPLETED';
      assistantMsg.createdAt = nowIso();
    }, 1200 + Math.random() * 1800);

    return {
      conversationId: convId,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      quota: quotaStatus(),
      affection: computeAffection(affectionValues[character.id] ?? 0),
      typing: true,
    };
  },

  async sendMultiMessage(params: {
    conversationId?: string;
    characterIds: string[];
    content: string;
  }): Promise<ChatMultiSendResult> {
    if (params.characterIds.length < 2) throw new ApiError(400, 'BAD_REQUEST', '多角色模式至少需要 2 位伴友');
    if (!isMember) {
      if (quotaUsed >= FREE_DAILY_LIMIT) {
        throw new ApiError(429, 'QUOTA_EXCEEDED', '今日免费消息条数已用完，开通会员可无限畅聊');
      }
      quotaUsed += 1;
    }
    const chars = params.characterIds.map(findChar);
    const lockedChar = chars.find((c) => c.locked);
    if (lockedChar) {
      throw new ApiError(403, 'MEMBER_REQUIRED', `角色「${lockedChar.name}」为会员专属`);
    }
    let convId = params.conversationId;
    if (!convId) {
      convId = genId('conv');
      conversations.set(convId, []);
    }
    const list = conversations.get(convId)!;
    const userMsg: Message = {
      id: genId('msg'),
      conversationId: convId,
      characterId: null,
      role: 'USER',
      content: params.content,
      status: 'COMPLETED',
      type: 'TEXT',
      metadata: {},
      createdAt: nowIso(),
    };
    list.push(userMsg);

    const replies = chars.map((c) => {
      const assistantMsg: Message = {
        id: genId('msg'),
        conversationId: convId,
        characterId: c.id,
        role: 'ASSISTANT',
        content: '',
        status: 'TYPING',
        type: 'TEXT',
        metadata: {},
        createdAt: nowIso(),
      };
      list.push(assistantMsg);
      affectionValues[c.id] = (affectionValues[c.id] ?? 0) + (c.type === 'POSSESSIVE' ? 3 : 2);
      const delta = 700 + Math.random() * 1400 + chars.indexOf(c) * 350;
      setTimeout(() => {
        assistantMsg.content = generateChatReply(c, params.content);
        assistantMsg.status = 'COMPLETED';
        assistantMsg.createdAt = nowIso();
      }, delta);
      return {
        characterId: c.id,
        name: c.name,
        title: c.title,
        type: c.type,
        assistantMessage: assistantMsg,
        affection: computeAffection(affectionValues[c.id] ?? 0),
      };
    });

    return {
      conversationId: convId,
      userMessage: userMsg,
      characters: replies,
      quota: quotaStatus(),
      typing: true,
    };
  },

  async triggerProactive(characterId: string): Promise<{ triggered: boolean; messageId: string }> {
    const character = findChar(characterId);
    const last = [...conversations.values()].flat().reverse().find((m) => m.conversationId);
    const convId = last?.conversationId;
    if (!convId) throw new ApiError(404, 'NOT_FOUND', '暂无会话，请先开始聊天');
    const list = conversations.get(convId)!;
    const msg: Message = {
      id: genId('msg'),
      conversationId: convId,
      characterId: character.id,
      role: 'ASSISTANT',
      content: '',
      status: 'TYPING',
      type: 'PROACTIVE',
      metadata: { giftName: '分享见闻' },
      createdAt: nowIso(),
    };
    list.push(msg);
    setTimeout(() => {
      msg.content = '（我刚刚看到窗外的晚霞，突然想跟你分享这一刻。）你那边呢，今天有没有什么让你舒心的小事？';
      msg.status = 'COMPLETED';
      msg.createdAt = nowIso();
    }, 1000 + Math.random() * 1000);
    return { triggered: true, messageId: msg.id };
  },

  async listGifts(): Promise<Gift[]> {
    return BASE_GIFTS.map((g) => ({
      ...g,
      locked: g.memberOnly && !isMember,
      unlockHint: g.memberOnly && !isMember ? '会员专属礼物' : undefined,
    }));
  },

  async sendGift(giftId: string, params: { characterId: string; quantity?: number }): Promise<GiftSendResult> {
    const gift = BASE_GIFTS.find((g) => g.id === giftId);
    if (!gift) throw new ApiError(404, 'NOT_FOUND', '礼物不存在');
    if (gift.memberOnly && !isMember) {
      throw new ApiError(403, 'MEMBER_REQUIRED', '该礼物为会员专属，开通会员后可赠送');
    }
    if (gift.isLimited && !isMember) {
      throw new ApiError(403, 'MEMBER_REQUIRED', '限量礼物需会员身份方可赠送');
    }
    const character = findChar(params.characterId);
    const quantity = Math.min(99, Math.max(1, params.quantity ?? 1));
    const delta = quantity * 5;
    affectionValues[character.id] = (affectionValues[character.id] ?? 0) + delta;
    const name = BASE_CHARACTERS.find((x) => x.id === character.id)?.name ?? '';
    const reply = replyFor(character, gift.name) || `谢谢你送我的${gift.name}，我心里特别暖。`;
    return {
      gift: { id: gift.id, name: gift.name, icon: gift.icon, isLimited: gift.isLimited },
      character: { id: character.id, name: character.name, title: character.title },
      reply,
      affection: computeAffection(affectionValues[character.id] ?? 0),
      affectionDelta: delta,
      animation: { type: 'float-up', text: gift.name, emoji: gift.icon ?? '🎁', duration: 2000, intensity: quantity > 5 ? 'high' : 'medium' },
      amount: gift.price * quantity,
      quantity,
      remainingStock: gift.isLimited ? (gift.stock ?? 99) - quantity : null,
    };
  },

  async getAffection(characterId: string): Promise<{ characterId: string; affection: Affection }> {
    return { characterId, affection: computeAffection(affectionValues[characterId] ?? 0) };
  },

  async listMembershipPlans(): Promise<MembershipPlan[]> {
    return BASE_PLANS;
  },

  async listProducts(): Promise<Product[]> {
    return BASE_PRODUCTS;
  },

  async currentMembership(): Promise<MembershipInfo | null> {
    return membership;
  },

  async createOrder(productCode: string): Promise<Order> {
    const product = BASE_PRODUCTS.find((p) => p.code === productCode);
    const plan = BASE_PLANS.find((p) => p.plan === productCode.split('_')[1]);
    const title = plan?.name ?? product?.name ?? '心伴AI 商品';
    const price = plan?.price ?? product?.price ?? 0;
    const type = product?.type ?? 'MEMBERSHIP';
    const order: Order = {
      id: genId('order'),
      orderNo: `XB${Date.now()}${orderSeq++}`,
      type,
      productCode,
      title,
      amount: price,
      amountYuan: (price / 100).toFixed(2),
      currency: 'CNY',
      status: 'PENDING',
      channel: null,
      confirmed: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    orders.unshift(order);
    return order;
  },

  async payOrder(orderId: string, channel: 'WECHAT' | 'ALIPAY'): Promise<PayResult> {
    const order = orders.find((o) => o.id === orderId);
    if (!order) throw new ApiError(404, 'NOT_FOUND', '订单不存在');
    if (order.amount >= 50000 && !order.confirmed) {
      order.status = 'PENDING_CONFIRM';
      throw new ApiError(428, 'LARGE_PAYMENT_CONFIRM', '本次支付金额较大，请二次确认', {
        orderId: order.id,
        amountYuan: order.amountYuan,
        thresholdYuan: '500.00',
      });
    }
    order.status = 'PAID';
    order.channel = channel;
    order.confirmed = true;
    if (order.type === 'MEMBERSHIP') {
      isMember = true;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (order.productCode === 'MEMBERSHIP_YEARLY' ? 365 : order.productCode === 'MEMBERSHIP_QUARTERLY' ? 90 : 30) * 86_400_000);
      membership = {
        id: genId('mem'),
        plan: order.productCode.split('_')[1] ?? 'MONTHLY',
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        daysLeft: Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000),
      };
    }
    return { order, payParams: { mock: true }, channel };
  },

  async confirmLargePayment(orderId: string): Promise<Order> {
    const order = orders.find((o) => o.id === orderId);
    if (!order) throw new ApiError(404, 'NOT_FOUND', '订单不存在');
    order.confirmed = true;
    order.status = 'PENDING';
    return order;
  },

  async listOrders(): Promise<Order[]> {
    return orders;
  },

  async customizeCharacter(characterId: string, payload: CustomizationPayload): Promise<CustomizationResult> {
    findChar(characterId);
    const existing = customizations[characterId] ?? {};
    const next: CustomizationResult = {
      id: genId('custom'),
      customName: payload.customName ?? existing.customName ?? null,
      hairstyle: payload.hairstyle ?? existing.hairstyle ?? null,
      outfit: payload.outfit ?? existing.outfit ?? null,
      voice: payload.voice ?? existing.voice ?? null,
      avatarUrl: existing.avatarUrl ?? null,
    };
    customizations[characterId] = next;
    return next;
  },

  async generateImage(payload: { characterName?: string; hairstyle?: string; outfit?: string }): Promise<GeneratedImageResult> {
    const name = payload.characterName ?? '心伴';
    return {
      url: `https://api.dicebear.com/9.x/adventurer-neutral/png?seed=${encodeURIComponent(name)}-${Math.floor(Math.random() * 999)}&backgroundColor=f7dbe8&size=512`,
      provider: 'mock',
      prompt: `生成专属形象：${name} ${payload.hairstyle ?? ''} ${payload.outfit ?? ''}`,
      expiresIn: 3600,
    };
  },

  async complianceStatus(): Promise<ComplianceStatus> {
    return {
      aiNotice: AI_NOTICE,
      isAiVirtual: true,
      antiAddiction: {
        enabled: true,
        lateNightBlock: true,
        lateNightWindow: '23:00 - 06:00',
        continuousWindowMin: 60,
        continuousLimitMin: 60,
        currentlyBlocked: false,
        blockReason: null,
        blockMessage: null,
      },
      rationalConsumption: {
        enabled: true,
        largePaymentThresholdCny: 500,
        notice: '请理性消费，按需购买。未成年人不建议使用本服务。',
      },
    };
  },

  async userStatus(): Promise<UserStatus> {
    return {
      quota: quotaStatus(),
      membership,
      antiAddiction: { blocked: false, reason: null, message: null, lateNightBlock: true },
      compliance: { aiNotice: AI_NOTICE, largePaymentThresholdCny: 500 },
    };
  },
};
