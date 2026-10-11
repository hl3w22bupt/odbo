import { describe, expect, it } from 'vitest'
import { serializeExport, EXPORT_FORMAT, EXPORT_SCHEMA_VERSION } from './exportData.js'

describe('user data export', () => {
  it('test_export_empty_db_returns_valid_empty', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(serializeExport([], now)).toEqual({
      schemaVersion: EXPORT_SCHEMA_VERSION,
      format: EXPORT_FORMAT,
      exportedAt: now.toISOString(),
      conversations: [],
    })
  })

  it('test_v04_data_readable_by_v05', () => {
    const exportedAt = new Date('2026-01-02T00:00:00.000Z')
    const result = serializeExport([
      {
        id: 'conv_1',
        mode: 'SINGLE',
        title: null,
        characterId: 'char_1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        messages: [{
          id: 'msg_1', role: 'USER', content: '今天很开心', status: 'COMPLETED', type: 'TEXT',
          metadata: '{}', createdAt: new Date('2026-01-01T00:00:01.000Z'),
        }],
        memories: [{
          id: 'memory_1', characterId: 'char_1', sourceMessageId: 'msg_1', content: '今天很开心',
          status: 'ACTIVE', createdAt: new Date('2026-01-01T00:00:01.000Z'),
        }],
        emotion: {
          emotion: 'POSITIVE', score: 0.8, version: 1, payload: '{"source":"keyword"}', updatedAt: new Date('2026-01-01T00:00:02.000Z'),
        },
        moodSnapshots: [{
          id: 'mood_1', characterId: 'char_1', sourceMessageId: 'msg_1', memoryId: 'memory_1',
          mood: 'POSITIVE', score: 1, keywords: '开心', createdAt: new Date('2026-01-01T00:00:01.000Z'),
          corrections: [],
        }],
      },
    ], exportedAt)

    expect(result.format).toBe('xinban-json')
    expect(result.conversations[0]).toMatchObject({ id: 'conv_1', messages: [{ content: '今天很开心' }] })
    expect(result.conversations[0]?.emotion).toEqual({
      emotion: 'POSITIVE', score: 0.8, version: 1, payload: { source: 'keyword' }, updatedAt: '2026-01-01T00:00:02.000Z',
    })
    expect(result.conversations[0]?.moodSnapshots[0]).toMatchObject({ mood: 'POSITIVE', corrections: [] })
  })
})
