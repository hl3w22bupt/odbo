/**
 * 心伴AI · API 客户端核心
 * - base URL 读取 EXPO_PUBLIC_API_URL
 * - 统一 API 信封解析 { code, message, data }
 * - 自动附加 Bearer token，401 触发登出回调
 * - 网络失败抛出 ApiError(NETWORK_ERROR)
 */

export const DEFAULT_BASE_URL = 'http://localhost:3888';

export function resolveBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/+$/, '');
  return DEFAULT_BASE_URL;
}

/** 是否使用离线演示数据：显式开关，或未配置 API 地址 */
export function isMockMode(): boolean {
  if (process.env.EXPO_PUBLIC_ENABLE_MOCK === 'true') return true;
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  return !configured;
}

export type ErrorCode =
  | 'OK'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'QUOTA_EXCEEDED'
  | 'MEMBER_REQUIRED'
  | 'ANTI_ADDICTION'
  | 'LARGE_PAYMENT_CONFIRM'
  | 'CONTENT_BLOCKED'
  | 'INTERNAL_ERROR'
  | 'SMS_RATE_LIMITED'
  | 'INVALID_CODE'
  | 'PAYMENT_ERROR'
  | 'NETWORK_ERROR'
  | 'BAD_RESPONSE'
  | 'TIMEOUT';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly detail: unknown;

  constructor(status: number, code: ErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  isMemberRequired(): boolean {
    return this.code === 'MEMBER_REQUIRED';
  }

  isAntiAddiction(): boolean {
    return this.code === 'ANTI_ADDICTION';
  }

  isQuotaExceeded(): boolean {
    return this.code === 'QUOTA_EXCEEDED';
  }

  isLargePaymentConfirm(): boolean {
    return this.code === 'LARGE_PAYMENT_CONFIRM';
  }

  isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

interface Envelope {
  code: string;
  message: string;
  data: unknown;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setRefreshToken(token: string | null): void {
  refreshToken = token;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setOnUnauthorized(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export interface RequestOptions {
  auth?: boolean;
  timeoutMs?: number;
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (opts.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(`${resolveBaseUrl()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let envelope: Envelope | null = null;
    try {
      envelope = (await res.json()) as Envelope;
    } catch {
      envelope = null;
    }

    if (!envelope || typeof envelope !== 'object' || typeof envelope.code !== 'string') {
      throw new ApiError(res.status, 'BAD_RESPONSE', '服务器响应异常，请稍后重试');
    }

    if (envelope.code !== 'OK') {
      const err = new ApiError(res.status, (envelope.code as ErrorCode) ?? 'BAD_REQUEST', envelope.message, envelope.data);
      if (res.status === 401) onUnauthorized?.();
      throw err;
    }

    return envelope.data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', '请求超时，请稍后重试');
    }
    throw new ApiError(0, 'NETWORK_ERROR', '网络连接失败，请检查网络后重试');
  } finally {
    clearTimeout(timer);
  }
}
