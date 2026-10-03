import { describe, expect, it } from 'vitest'
import { registerChatRoutes } from './chat.js'

class ContractRouter {
  readonly routes: Array<{ name: string; method: string; path: string }> = []

  define(name: string, path: string, method: 'GET' | 'POST', _handler: unknown): void {
    this.routes.push({ name, method, path })
  }
}

describe('chat v0.3 read contracts', () => {
  it('exposes the conversation memory read API', () => {
    const router = new ContractRouter()
    registerChatRoutes(router as never)
    expect(router.routes).toContainEqual({
      name: 'chat::conversation-memory',
      method: 'GET',
      path: '/api/v1/conversations/:id/memory',
    })
  })

  it('exposes the structured mood timeline read API', () => {
    const router = new ContractRouter()
    registerChatRoutes(router as never)
    expect(router.routes).toContainEqual({
      name: 'chat::conversation-mood-timeline',
      method: 'GET',
      path: '/api/v1/conversations/:id/mood-timeline',
    })
  })
})
