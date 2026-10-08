/**
 * 心伴AI · API 领域函数
 * 自动在「真实后端」与「离线演示」之间切换：
 *   - 配置 EXPO_PUBLIC_API_URL → 真实后端（apps/server standalone，默认 http://127.0.0.1:3888）
 *   - 未配置或 EXPO_PUBLIC_ENABLE_MOCK=true → 内置演示数据
 *   - 注意：该变量在构建期固化；导出需带 --clear，否则 Metro 缓存可能沿用旧值
 */
import type {
  Affection,
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
  MemoryReadResult,
  MoodCorrectionPayload,
  MoodCorrectionWriteResult,
  MoodInsightSummaryResult,
  MoodTimelineResult,
  MoodWeeklyReportResult,
  Message,
  Order,
  PayResult,
  Product,
  QuotaStatus,
  UserStatus,
} from '../types';
import { isMockMode, request } from './client';
import { mockApi } from './mock';

export { ApiError, isMockMode, resolveBaseUrl, setAccessToken, setOnUnauthorized, setRefreshToken, getAccessToken } from './client';

export interface SendMessageParams {
  conversationId?: string;
  characterId: string;
  content: string;
}

export interface SendMultiMessageParams {
  conversationId?: string;
  characterIds: string[];
  content: string;
}

export interface ApiClient {
  sendSmsCode(phone: string): Promise<{ sent: boolean; expiresIn: number; devCode?: string }>;
  login(phone: string, code: string): Promise<LoginResult>;
  logout(): Promise<void>;
  listCharacters(): Promise<Character[]>;
  getCharacter(id: string): Promise<Character>;
  listConversations(): Promise<{ items: Conversation[]; total: number }>;
  listMessages(conversationId: string, after?: string): Promise<{ items: Message[]; hasMore: boolean }>;
  getConversationMemory(conversationId: string): Promise<MemoryReadResult>;
  getMoodTimeline(conversationId: string): Promise<MoodTimelineResult>;
  correctMoodPoint(conversationId: string, moodPointId: string, payload: MoodCorrectionPayload): Promise<MoodCorrectionWriteResult>;
  getMoodInsightSummary(conversationId: string): Promise<MoodInsightSummaryResult>;
  getMoodWeeklyReport(conversationId: string): Promise<MoodWeeklyReportResult>;
  sendMessage(params: SendMessageParams): Promise<ChatSendResult>;
  sendMultiMessage(params: SendMultiMessageParams): Promise<ChatMultiSendResult>;
  triggerProactive(characterId: string): Promise<{ triggered: boolean; messageId: string }>;
  listGifts(): Promise<Gift[]>;
  sendGift(giftId: string, params: { characterId: string; quantity?: number }): Promise<GiftSendResult>;
  getAffection(characterId: string): Promise<{ characterId: string; affection: Affection }>;
  listMembershipPlans(): Promise<MembershipPlan[]>;
  listProducts(): Promise<Product[]>;
  currentMembership(): Promise<MembershipInfo | null>;
  createOrder(productCode: string): Promise<Order>;
  payOrder(orderId: string, channel: 'WECHAT' | 'ALIPAY'): Promise<PayResult>;
  confirmLargePayment(orderId: string): Promise<Order>;
  listOrders(): Promise<Order[]>;
  customizeCharacter(characterId: string, payload: CustomizationPayload): Promise<CustomizationResult>;
  generateImage(payload: { characterName?: string; hairstyle?: string; outfit?: string }): Promise<GeneratedImageResult>;
  complianceStatus(): Promise<ComplianceStatus>;
  userStatus(): Promise<UserStatus>;
}

const realApi: ApiClient = {
  async sendSmsCode(phone) {
    return request('POST', '/api/v1/auth/sms-code', { phone, purpose: 'LOGIN' });
  },
  async login(phone, code) {
    return request<LoginResult>('POST', '/api/v1/auth/login', { phone, code });
  },
  async logout() {
    await request('POST', '/api/v1/auth/logout', {}).catch(() => undefined);
  },
  async listCharacters() {
    return request<Character[]>('GET', '/api/v1/characters');
  },
  async getCharacter(id) {
    return request<Character>('GET', `/api/v1/characters/${id}`);
  },
  async listConversations() {
    return request<{ items: Conversation[]; total: number }>('GET', '/api/v1/conversations');
  },
  async listMessages(conversationId, after) {
    const q = after ? `?after=${encodeURIComponent(after)}` : '';
    return request<{ items: Message[]; hasMore: boolean }>('GET', `/api/v1/conversations/${conversationId}/messages${q}`);
  },
  async getConversationMemory(conversationId) {
    return request<MemoryReadResult>('GET', `/api/v1/conversations/${conversationId}/memory`);
  },
  async getMoodTimeline(conversationId) {
    return request<MoodTimelineResult>('GET', `/api/v1/conversations/${conversationId}/mood-timeline`);
  },
  async correctMoodPoint(conversationId, moodPointId, payload) {
    return request<MoodCorrectionWriteResult>(
      'POST',
      `/api/v1/conversations/${conversationId}/mood-points/${moodPointId}/correction`,
      payload,
    );
  },
  async getMoodInsightSummary(conversationId) {
    return request<MoodInsightSummaryResult>('GET', `/api/v1/conversations/${conversationId}/insight-summary`);
  },
  async getMoodWeeklyReport(conversationId) {
    return request<MoodWeeklyReportResult>('GET', `/api/v1/conversations/${conversationId}/mood-weekly-report`);
  },
  async sendMessage(params) {
    return request<ChatSendResult>('POST', '/api/v1/chat/send', params);
  },
  async sendMultiMessage(params) {
    return request<ChatMultiSendResult>('POST', '/api/v1/chat/multi/send', params);
  },
  async triggerProactive(characterId) {
    return request<{ triggered: boolean; messageId: string }>('POST', '/api/v1/chat/proactive', { characterId });
  },
  async listGifts() {
    return request<Gift[]>('GET', '/api/v1/gifts');
  },
  async sendGift(giftId, params) {
    return request<GiftSendResult>('POST', `/api/v1/gifts/${giftId}/send`, params);
  },
  async getAffection(characterId) {
    return request<{ characterId: string; affection: Affection }>('GET', `/api/v1/characters/${characterId}/affection`);
  },
  async listMembershipPlans() {
    return request<MembershipPlan[]>('GET', '/api/v1/membership/plans');
  },
  async listProducts() {
    return request<Product[]>('GET', '/api/v1/products');
  },
  async currentMembership() {
    return request<MembershipInfo | null>('GET', '/api/v1/membership');
  },
  async createOrder(productCode) {
    return request<Order>('POST', '/api/v1/orders', { productCode });
  },
  async payOrder(orderId, channel) {
    return request<PayResult>('POST', `/api/v1/orders/${orderId}/pay`, { channel });
  },
  async confirmLargePayment(orderId) {
    return request<Order>('POST', `/api/v1/orders/${orderId}/confirm`, {});
  },
  async listOrders() {
    return request<Order[]>('GET', '/api/v1/orders');
  },
  async customizeCharacter(characterId, payload) {
    return request<CustomizationResult>('POST', `/api/v1/characters/${characterId}/customize`, payload);
  },
  async generateImage(payload) {
    return request<GeneratedImageResult>('POST', '/api/v1/images/generate', payload);
  },
  async complianceStatus() {
    return request<ComplianceStatus>('GET', '/api/v1/compliance/status');
  },
  async userStatus() {
    return request<UserStatus>('GET', '/api/v1/users/me/status');
  },
};

/** 配额查询（无鉴权场景也能用 userStatus 获取） */
export type { QuotaStatus };

export const api: ApiClient = isMockMode() ? mockApi : realApi;
