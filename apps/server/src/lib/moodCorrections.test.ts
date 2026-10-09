import { describe, expect, it } from 'vitest'
import {
  applyLatestCorrection,
  normalizeCorrectionInput,
  readableCorrection,
} from './moodCorrections.js'

const point = {
  id: 'mood_1',
  conversationId: 'conv_1',
  characterId: 'char_1',
  sourceMessageId: 'msg_1',
  memoryId: 'memory_1',
  mood: 'POSITIVE' as const,
  score: 1 as const,
  keywords: ['开心'],
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('mood correction contract', () => {
  it('accepts only the frozen editable field whitelist', () => {
    expect(normalizeCorrectionInput({
      mood: 'NEGATIVE',
      tags: ['状态变化', ' 记录有误 '],
      reason: ' 第二天更低落 ',
      clientMutationId: ' mutation-1 ',
      score: 99,
    })).toEqual({
      mood: 'NEGATIVE',
      score: -1,
      tags: ['状态变化', '记录有误'],
      reason: '第二天更低落',
      clientMutationId: 'mutation-1',
    })
  })

  it('test_correction_latest_wins', () => {
    const corrected = applyLatestCorrection(point, {
      id: 2,
      moodSnapshotId: 'mood_1',
      mood: 'SAD',
      score: -1,
      tags: ['状态变化'],
      reason: '更低落',
      createdAt: '2026-01-01T02:00:00.000Z',
    })
    expect(corrected).toMatchObject({
      id: 'mood_1',
      mood: 'SAD',
      score: -1,
      originalMood: 'POSITIVE',
      originalScore: 1,
      correctionId: 2,
      correctedAt: '2026-01-01T02:00:00.000Z',
    })
    expect(corrected.keywords).toEqual(['开心'])
  })

  it('keeps an uncorrected v0.4 point readable', () => {
    expect(applyLatestCorrection(point, null)).toEqual({
      ...point,
      tags: [],
      reason: '',
      originalMood: null,
      originalScore: null,
      correctionId: null,
      correctedAt: null,
    })
  })

  it('test_correction_write_failure_preserves_old_value', () => {
    const read = readableCorrection(null)
    expect(read).toEqual({ correction: null, persisted: false, degraded: true })
  })
})
