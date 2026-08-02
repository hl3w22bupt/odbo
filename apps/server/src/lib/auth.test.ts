/**
 * 认证工具单元测试（不依赖数据库的纯函数）
 */
import { describe, it, expect } from 'vitest'
import { extractBearerToken } from './auth.js'

describe('extractBearerToken', () => {
  it('从 Authorization 头提取令牌', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('大小写不敏感', () => {
    expect(extractBearerToken('bearer token123')).toBe('token123')
  })

  it('缺失时返回 undefined', () => {
    expect(extractBearerToken(undefined)).toBeUndefined()
    expect(extractBearerToken('')).toBeUndefined()
    expect(extractBearerToken('Basic abc')).toBeUndefined()
  })

  it('数组头取首项', () => {
    expect(extractBearerToken(['Bearer first', 'Bearer second'])).toBe('first')
  })
})
