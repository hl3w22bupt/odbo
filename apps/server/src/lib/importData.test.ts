import { describe, expect, it } from 'vitest'
import { AppError } from './errors.js'
import { assertImportPayload, IMPORT_FORMAT, IMPORT_SCHEMA_VERSION } from './importData.js'

export const validImportPayload = {
  schemaVersion: 1,
  format: IMPORT_FORMAT,
  exportedAt: '2026-01-02T00:00:00.000Z',
  conversations: [{
    id: 'conv_import_1',
    mode: 'SINGLE',
    title: '导入会话',
    characterId: 'char_import',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T01:00:00.000Z',
    messages: [{
      id: 'msg_import_1',
      role: 'USER',
      content: '今天很开心',
      status: 'COMPLETED',
      type: 'TEXT',
      metadata: { source: 'backup' },
      createdAt: '2026-01-01T00:00:01.000Z',
    }],
    memories: [{
      id: 'memory_import_1',
      characterId: 'char_import',
      sourceMessageId: 'msg_import_1',
      content: '今天很开心',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:01.000Z',
    }],
    emotion: {
      emotion: 'POSITIVE',
      score: 0.8,
      version: 1,
      payload: { source: 'keyword' },
      updatedAt: '2026-01-01T00:00:02.000Z',
    },
    moodSnapshots: [{
      id: 'mood_import_1',
      characterId: 'char_import',
      sourceMessageId: 'msg_import_1',
      memoryId: 'memory_import_1',
      mood: 'POSITIVE',
      score: 1,
      keywords: ['开心'],
      createdAt: '2026-01-01T00:00:01.000Z',
      corrections: [{
        id: 101,
        mood: 'NEUTRAL',
        score: 0,
        tags: ['状态变化'],
        reason: '其实是平静',
        clientMutationId: 'import-mutation-1',
        createdAt: '2026-01-01T00:00:03.000Z',
      }],
    }],
  }],
} as const

function invalidClone(mutate: (payload: Record<string, unknown>) => void): unknown {
  const payload = JSON.parse(JSON.stringify(validImportPayload)) as Record<string, unknown>
  mutate(payload)
  return payload
}

describe('json import schema gate', () => {
  it('test_import_missing_version_rejects_whole_batch', () => {
    const payload = invalidClone((data) => { delete data.schemaVersion })
    try {
      assertImportPayload(payload)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe('IMPORT_VERSION_MISSING')
    }
  })

  it('test_import_higher_version_rejects_whole_batch', () => {
    const payload = invalidClone((data) => { data.schemaVersion = 2 })
    try {
      assertImportPayload(payload)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe('IMPORT_VERSION_UNSUPPORTED')
    }
  })

  it('test_import_invalid_record_rejects_schema_without_partial_plan', () => {
    const payload = invalidClone((data) => {
      const conversations = data.conversations as Array<Record<string, unknown>>
      conversations[0]!.messages = []
    })
    try {
      assertImportPayload(payload)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe('IMPORT_SCHEMA_REJECTED')
    }
  })

  it('test_import_valid_payload_keeps_frozen_envelope', () => {
    const parsed = assertImportPayload(validImportPayload)
    expect(parsed.schemaVersion).toBe(IMPORT_SCHEMA_VERSION)
    expect(parsed.format).toBe(IMPORT_FORMAT)
    expect(parsed.conversations[0]?.messages).toHaveLength(1)
    expect(parsed.conversations[0]?.memories).toHaveLength(1)
    expect(parsed.conversations[0]?.emotion).not.toBeNull()
    expect(parsed.conversations[0]?.moodSnapshots[0]?.corrections).toHaveLength(1)
  })
})
