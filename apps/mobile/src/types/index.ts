/**
 * 心伴AI · 领域类型定义
 * 与后端 API 信封 { code, message, data } 对齐
 */

export type CharacterType = 'INCLUSIVE' | 'POSSESSIVE';
export type CharacterTier = 'FREE' | 'VIP';
export type Dialect = 'MANDARIN' | 'SICHUAN' | 'CANTONESE';
export type ChatMode = 'SINGLE' | 'MULTI';
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type MessageStatus = 'COMPLETED' | 'TYPING' | 'FAILED';
export type MessageType = 'TEXT' | 'PROACTIVE' | 'GIFT' | 'SYSTEM';

export interface Affection {
  value: number;
  level: number;
  progress: number;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  type: CharacterType;
  typeLabel: string;
  tier: CharacterTier;
  isMemberOnly: boolean;
  dialect: Dialect;
  dialectLabel: string;
  occupation: string;
  personality: string;
  greeting: string;
  avatarUrl: string | null;
  voice: string | null;
  tags: string[];
  config?: Record<string, unknown>;
  locked?: boolean;
  unlockHint?: string;
  affection: Affection;
  customized?: boolean | Record<string, unknown>;
}

export interface MessageMetadata {
  giftName?: string;
  giftIcon?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  conversationId: string;
  characterId: string | null;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  type: MessageType;
  metadata: MessageMetadata;
  createdAt: string;
}

export interface Conversation {
  id: string;
  mode: ChatMode;
  title: string | null;
  characterId: string | null;
  character: { id: string; name: string; title: string; avatarUrl?: string | null } | null;
  lastMessageAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface ConversationMemory {
  id: string;
  conversationId: string;
  characterId: string | null;
  sourceMessageId: string | null;
  content: string;
  status: 'ACTIVE' | 'QUARANTINED';
  createdAt: string;
}

export interface MemoryReadResult {
  conversationId: string;
  available: boolean;
  degraded: boolean;
  items: ConversationMemory[];
}

export type ConversationMood = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface MoodSnapshot {
  id: string;
  conversationId: string;
  characterId: string | null;
  sourceMessageId: string | null;
  memoryId: string | null;
  mood: ConversationMood;
  score: -1 | 0 | 1;
  keywords: string[];
  createdAt: string;
  tags?: string[];
  reason?: string;
  originalMood?: ConversationMood | null;
  originalScore?: -1 | 0 | 1 | null;
  correctionId?: number | null;
  correctedAt?: string | null;
}

export interface MoodCorrectionPayload {
  mood: ConversationMood;
  tags?: string[];
  reason?: string;
  clientMutationId?: string;
}

export interface MoodCorrectionWriteResult {
  point: MoodSnapshot;
  correction: {
    id: number;
    moodSnapshotId: string;
    mood: ConversationMood;
    score: -1 | 0 | 1;
    tags: string[];
    reason: string;
    clientMutationId: string | null;
    createdAt: string;
  } | null;
  persisted: boolean;
  degraded: boolean;
}

export interface MoodTimelineResult {
  conversationId: string;
  available: boolean;
  degraded: boolean;
  points: MoodSnapshot[];
}

export type MoodInsightTrend = 'IMPROVING' | 'STABLE' | 'WORSENING';

export interface MoodInsightSummary {
  sampleSize: number;
  counts: { positive: number; neutral: number; negative: number };
  trend: MoodInsightTrend;
  headline: string;
  reason: string;
  keywords: string[];
  window: { from: string; to: string };
}

export interface MoodInsightSummaryResult {
  conversationId: string;
  available: boolean;
  degraded: boolean;
  summary: MoodInsightSummary | null;
}

export type MoodWeeklyTrend = 'IMPROVING' | 'STABLE' | 'WORSENING';

export interface MoodWeeklyReport {
  sampleSize: number;
  counts: { positive: number; neutral: number; negative: number };
  trend: MoodWeeklyTrend;
  headline: string;
  reason: string;
  keywords: string[];
  window: { from: string; to: string };
}

export interface MoodWeeklyReportResult {
  conversationId: string;
  available: boolean;
  degraded: boolean;
  report: MoodWeeklyReport | null;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
}

export interface Gift {
  id: string;
  name: string;
  description: string | null;
  price: number;
  priceYuan: string;
  icon: string | null;
  imageUrl: string | null;
  isLimited: boolean;
  memberOnly: boolean;
  stock: number | null;
  locked?: boolean;
  unlockHint?: string;
}

export interface GiftSendResult {
  gift: { id: string; name: string; icon: string | null; isLimited: boolean };
  character: { id: string; name: string; title: string };
  reply: string;
  affection: Affection;
  affectionDelta: number;
  animation: { type: string; text: string; emoji: string; duration: number; intensity: string };
  amount: number;
  quantity: number;
  remainingStock: number | null;
}

export interface MembershipPlanBenefit {
  key: string;
  label: string;
  value: boolean;
}

export interface MembershipPlan {
  plan: string;
  name: string;
  price: number;
  priceYuan: string;
  originalPrice: number | null;
  originalPriceYuan: string | null;
  durationDays: number;
  benefits: MembershipPlanBenefit[];
}

export type ProductType = 'MEMBERSHIP' | 'STORY' | 'VOICE_PACK' | 'GIFT';

export interface Product {
  id: string;
  code: string;
  type: ProductType;
  name: string;
  description: string | null;
  price: number;
  priceYuan: string;
  originalPrice: number | null;
  originalPriceYuan: string | null;
  durationDays: number | null;
  benefits: Record<string, unknown>;
  memberOnly: boolean;
  purchased: boolean;
}

export interface Order {
  id: string;
  orderNo: string;
  type: string;
  productCode: string;
  title: string;
  amount: number;
  amountYuan: string;
  currency: string;
  status: string;
  channel: string | null;
  confirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipInfo {
  id: string;
  plan: string;
  startedAt: string;
  expiresAt: string;
  daysLeft: number;
}

export interface AntiAddictionStatus {
  enabled: boolean;
  lateNightBlock: boolean;
  lateNightWindow: string;
  continuousWindowMin: number;
  continuousLimitMin: number;
  currentlyBlocked: boolean;
  blockReason: string | null;
  blockMessage: string | null;
}

export interface RationalConsumptionInfo {
  enabled: boolean;
  largePaymentThresholdCny: number;
  notice: string;
}

export interface ComplianceStatus {
  aiNotice: string;
  isAiVirtual: boolean;
  antiAddiction: AntiAddictionStatus;
  rationalConsumption: RationalConsumptionInfo;
}

export interface UserStatus {
  quota: QuotaStatus;
  membership: MembershipInfo | null;
  antiAddiction: {
    blocked: boolean;
    reason: string | null;
    message: string | null;
    lateNightBlock: boolean;
  };
  compliance: {
    aiNotice: string;
    largePaymentThresholdCny: number;
  };
}

export interface AuthUser {
  id: string;
  phone: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
  compliance: { aiNotice: string };
}

export interface ChatSendResult {
  conversationId: string;
  userMessage: Message;
  assistantMessage: Message;
  quota: QuotaStatus;
  affection: Affection;
  memory?: MemoryReadResult;
  moodTimeline?: MoodTimelineResult;
  typing: boolean;
}

export interface MultiCharacterReply {
  characterId: string;
  name: string;
  title: string;
  type: CharacterType;
  assistantMessage: Message;
  affection: Affection;
}

export interface ChatMultiSendResult {
  conversationId: string;
  userMessage: Message;
  characters: MultiCharacterReply[];
  quota: QuotaStatus;
  typing: boolean;
}

export interface CustomizationPayload {
  customName?: string;
  hairstyle?: string;
  outfit?: string;
  voice?: string;
  generateImage?: boolean;
}

export interface CustomizationResult {
  id: string;
  customName: string | null;
  hairstyle: string | null;
  outfit: string | null;
  voice: string | null;
  avatarUrl: string | null;
}

export interface GeneratedImageResult {
  url: string;
  provider: string;
  prompt: string;
  expiresIn: number;
}

/** 支付发起结果（mock 适配器返回） */
export interface PayResult {
  order: Order;
  payParams: { payUrl?: string; mock?: boolean } | null;
  channel: 'WECHAT' | 'ALIPAY';
}
