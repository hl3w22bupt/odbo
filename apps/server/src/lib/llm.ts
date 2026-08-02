/**
 * 心伴AI · LLM 供应商抽象
 * 默认 DeepSeek（OpenAI 兼容接口），可按环境变量切换为 OpenAI。
 * 流式输出预留 onToken 回调（前端轮询兜底已实现）。
 */
import OpenAI from 'openai'
import { config } from '../config.js'
import { logger } from './logger.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  system?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  onToken?: (delta: string) => void
}

export interface LlmProvider {
  readonly name: string
  chat(opts: ChatOptions): Promise<string>
  isConfigured(): boolean
}

class OpenAICompatProvider implements LlmProvider {
  readonly name: string
  private client: OpenAI
  private model: string
  private configured: boolean

  constructor(name: string, apiKey: string, baseURL: string, model: string) {
    this.name = name
    this.configured = apiKey.length > 0
    this.client = new OpenAI({ apiKey: apiKey || 'sk-not-configured', baseURL })
    this.model = model
  }

  isConfigured(): boolean {
    return this.configured
  }

  async chat(opts: ChatOptions): Promise<string> {
    const messages: ChatMessage[] = []
    if (opts.system) {
      messages.push({ role: 'system', content: opts.system })
    }
    messages.push(...opts.messages)

    try {
      if (opts.onToken) {
        // 流式：逐 token 回调（未来 SSE 使用）
        const stream = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature: opts.temperature ?? 0.8,
          max_tokens: opts.maxTokens ?? 512,
          stream: true,
        })
        let full = ''
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            full += delta
            opts.onToken(delta)
          }
        }
        return full
      }
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: opts.temperature ?? 0.8,
        max_tokens: opts.maxTokens ?? 512,
      })
      const content = res.choices[0]?.message?.content ?? ''
      return content.trim()
    } catch (err) {
      logger.error(`[llm:${this.name}] chat 调用失败`, { err: String(err) })
      throw err
    }
  }
}

let provider: LlmProvider | undefined

export function getLlmProvider(): LlmProvider {
  if (provider) return provider
  switch (config.llmProvider) {
    case 'openai':
      provider = new OpenAICompatProvider(
        'openai',
        config.openai.apiKey,
        config.openai.baseUrl,
        config.openai.model,
      )
      break
    case 'deepseek':
    default:
      provider = new OpenAICompatProvider(
        'deepseek',
        config.deepseek.apiKey,
        config.deepseek.baseUrl,
        config.deepseek.model,
      )
  }
  return provider
}

/**
 * 未配置密钥时的离线回退回复（保证开发/演示环境可用）。
 */
export function fallbackReply(characterName: string, content: string): string {
  const trimmed = content.trim()
  if (trimmed.length <= 0) {
    return `嗯，我在听呢，你想说点什么都可以的。`
  }
  return `（${characterName}温柔地回应）我听到你说的"${trimmed.slice(0, 20)}"了，感觉你是个很有故事的人。今天过得怎么样？`
}
