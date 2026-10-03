import { describe, expect, it } from 'vitest';
import { memoryViewState } from './insights';
import type { MemoryReadResult } from '../types';

const memory: MemoryReadResult = {
  conversationId: 'conv_1',
  available: true,
  degraded: false,
  items: [
    {
      id: 'memory_1',
      conversationId: 'conv_1',
      characterId: 'char_1',
      sourceMessageId: 'msg_1',
      content: '女儿下周生日',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

describe('memoryViewState', () => {
  it('renders an explicit empty state before the first write', () => {
    expect(memoryViewState({ conversationId: 'conv_1', available: true, degraded: false, items: [] })).toEqual({
      mode: 'empty',
      items: [],
    });
  });

  it('shows active memory content', () => {
    expect(memoryViewState(memory)).toEqual({ mode: 'ready', items: memory.items });
  });

  it('hides dirty data and enters the degraded state', () => {
    expect(memoryViewState({ ...memory, available: false, degraded: true }).mode).toBe('degraded');
    expect(memoryViewState({ ...memory, items: [{ ...memory.items[0]!, status: 'QUARANTINED' }] }).mode).toBe('empty');
  });
});
