import { describe, expect, it } from 'vitest'
import {
  extractMemoryContent,
  memoryReadDegraded,
  memoryReadEmpty,
  persistMemoryOrDegrade,
  readableMemories,
  readableMoodTimeline,
  serializeMemory,
  serializeMood,
} from './conversationInsights.js'

const memoryRow = {
  id: 'mem_1',
  conversationId: 'conv_1',
  characterId: 'char_1',
  sourceMessageId: 'msg_1',
  content: '女儿下周生日',
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}

describe('conversation memory contract', () => {
  it('normalizes and bounds the displayed memory content', () => {
    expect(extractMemoryContent('  记住：女儿\n下周生日  ')).toBe('记住：女儿 下周生日')
    expect(extractMemoryContent('x'.repeat(200))).toHaveLength(160)
  })

  it('returns an explicit empty state before any memory is written', () => {
    expect(memoryReadEmpty('conv_1')).toEqual({
      conversationId: 'conv_1',
      available: true,
      degraded: false,
      items: [],
    })
  })

  it('hides quarantined and blank rows from the read view', () => {
    const view = readableMemories('conv_1', [
      memoryRow,
      { ...memoryRow, id: 'mem_dirty', content: '', status: 'ACTIVE' },
      { ...memoryRow, id: 'mem_bad', content: '半写脏数据', status: 'QUARANTINED' },
    ])
    expect(view.items).toHaveLength(1)
    expect(view.items[0]).toMatchObject({
      id: 'mem_1',
      content: '女儿下周生日',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('degrades to an empty list and never exposes dirty data', () => {
    const degraded = memoryReadDegraded('conv_1')
    expect(degraded).toEqual({
      conversationId: 'conv_1',
      available: false,
      degraded: true,
      items: [],
    })
    expect(readableMemories('conv_1', [{ ...memoryRow, content: '半写脏数据' }], true)).toEqual(degraded)
  })

  it('maps a memory write failure to the degraded read contract', async () => {
    const result = await persistMemoryOrDegrade('conv_1', async () => {
      throw new Error('sqlite write failed')
    })
    expect(result.memory).toBeNull()
    expect(result.read).toEqual(memoryReadDegraded('conv_1'))
  })
})

describe('mood timeline contract', () => {
  it('serializes mood snapshots with structured keywords', () => {
    const point = serializeMood({
      id: 'mood_1',
      conversationId: 'conv_1',
      characterId: 'char_1',
      sourceMessageId: 'msg_1',
      memoryId: 'mem_1',
      mood: 'POSITIVE',
      score: 1,
      keywords: '开心,顺利',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    })
    const row = {
      ...point,
      keywords: '开心,顺利',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    }
    expect(readableMoodTimeline('conv_1', [row])).toEqual({
      conversationId: 'conv_1',
      available: true,
      degraded: false,
      points: [{ ...point, keywords: ['开心', '顺利'] }],
    })
  })
})
