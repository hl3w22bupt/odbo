import { describe, expect, it } from 'vitest';
import { memoryViewState, moodViewState } from './insights';
import type { MemoryReadResult, MoodTimelineResult } from '../types';

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

describe('moodViewState', () => {
  const timeline: MoodTimelineResult = {
    conversationId: 'conv_1',
    available: true,
    degraded: false,
    points: [
      {
        id: 'mood_1',
        conversationId: 'conv_1',
        characterId: 'char_1',
        sourceMessageId: 'msg_1',
        memoryId: 'memory_1',
        mood: 'POSITIVE',
        score: 1,
        keywords: ['开心'],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };

  it('asserts timeline content instead of pixels', () => {
    expect(moodViewState(timeline).points[0]).toMatchObject({ mood: 'POSITIVE', score: 1 });
  });

  it('uses empty and degraded states without exposing partial rows', () => {
    expect(moodViewState({ ...timeline, points: [] }).mode).toBe('empty');
    expect(moodViewState({ ...timeline, available: false, degraded: true })).toEqual({
      mode: 'degraded',
      points: [],
    });
  });
});
