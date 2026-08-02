/**
 * 心伴AI · 内容过滤（自建，不接第三方）
 * 敏感词库 = 内置默认词表 + 数据库 SensitiveWord 表（启动时加载缓存）。
 * 命中策略：BLOCK（阻断）/ FLAG（标记替换）。
 */
import { prisma } from '../db.js'
import { logger } from './logger.js'

const BUILTIN_SENSITIVE_WORDS: ReadonlyArray<{ word: string; level: 'BLOCK' | 'FLAG' }> = [
  // 违法/暴力/色情等基础词表（占位样例，生产应扩展）
  { word: '赌博', level: 'BLOCK' },
  { word: '毒品', level: 'BLOCK' },
  { word: '枪支', level: 'BLOCK' },
  { word: '卖淫', level: 'BLOCK' },
  { word: '嫖娼', level: 'BLOCK' },
  { word: '传销', level: 'BLOCK' },
  { word: '诈骗', level: 'BLOCK' },
  { word: '自杀方法', level: 'BLOCK' },
  { word: '杀人', level: 'BLOCK' },
  { word: '恐怖袭击', level: 'BLOCK' },
  { word: '裸聊', level: 'BLOCK' },
  { word: '援交', level: 'BLOCK' },
  { word: '刷单', level: 'BLOCK' },
  { word: '六合彩', level: 'BLOCK' },
  { word: '充值提现', level: 'FLAG' },
  { word: '微信号', level: 'FLAG' },
  { word: '加QQ', level: 'FLAG' },
  { word: '加微信', level: 'FLAG' },
  { word: '线下见面', level: 'FLAG' },
  { word: '真实身份', level: 'FLAG' },
  { word: '电话号码', level: 'FLAG' },
]

export interface FilterResult {
  passed: boolean
  blocked: boolean
  filtered: string
  matched: string[]
}

interface WordEntry {
  word: string
  level: 'BLOCK' | 'FLAG'
}

let cache: WordEntry[] | null = null
let cacheLoadedAt = 0
const CACHE_TTL_MS = 60_000

/** 加载敏感词表（内置 + 数据库），带 TTL 缓存 */
export async function loadSensitiveWords(force = false): Promise<WordEntry[]> {
  const now = Date.now()
  if (!force && cache && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cache
  }
  try {
    const dbWords = await prisma.sensitiveWord.findMany()
    const merged: WordEntry[] = [...BUILTIN_SENSITIVE_WORDS]
    for (const w of dbWords) {
      const level = w.level === 'FLAG' ? 'FLAG' : 'BLOCK'
      if (!merged.some((m) => m.word === w.word)) {
        merged.push({ word: w.word, level })
      }
    }
    cache = merged
    cacheLoadedAt = now
    return merged
  } catch (err) {
    logger.warn('加载敏感词失败，使用内置词表', { err: String(err) })
    return [...BUILTIN_SENSITIVE_WORDS]
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 过滤文本。返回是否通过、命中词与过滤后文本。
 * BLOCK 词命中 → blocked=true；FLAG 词命中 → 替换为 *。
 */
export async function filterContent(text: string): Promise<FilterResult> {
  const words = await loadSensitiveWords()
  let filtered = text
  const matched: string[] = []
  let blocked = false

  for (const entry of words) {
    if (entry.word.length === 0) continue
    if (!filtered.includes(entry.word)) continue
    matched.push(entry.word)
    if (entry.level === 'BLOCK') {
      blocked = true
      filtered = filtered.replace(new RegExp(escapeRegExp(entry.word), 'g'), '*'.repeat(entry.word.length))
    } else {
      filtered = filtered.replace(new RegExp(escapeRegExp(entry.word), 'g'), '*'.repeat(entry.word.length))
    }
  }

  return { passed: !blocked, blocked, filtered, matched }
}

/** 命中 BLOCK 时的回退文案（前端展示） */
export function blockedFallbackReply(): string {
  return '这个话题我们不聊啦，聊点开心的吧～'
}

/** 全量刷新缓存（管理端新增敏感词后调用） */
export function invalidateSensitiveCache(): void {
  cache = null
}
