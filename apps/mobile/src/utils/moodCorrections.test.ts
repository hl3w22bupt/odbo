import { describe, expect, it } from 'vitest'
import { applyMoodCorrection, createCorrectionForm } from './moodCorrections'
import type { MoodSnapshot } from '../types'

const point: MoodSnapshot = {
  id: 'mood_1', conversationId: 'conv_1', characterId: 'char_1', sourceMessageId: 'msg_1',
  memoryId: 'memory_1', mood: 'POSITIVE', score: 1, keywords: ['开心'], createdAt: '2026-01-01T00:00:00.000Z',
}

describe('mood correction UI state', () => {
  it('creates the minimal correction form from a selected point', () => {
    expect(createCorrectionForm(point)).toEqual({ mood: 'POSITIVE', tags: [], reason: '' })
  })

  it('applies a correction result immediately or preserves the old point', () => {
    const next = applyMoodCorrection(point, {
      id: 'mood_1', conversationId: 'conv_1', characterId: 'char_1', sourceMessageId: 'msg_1',
      memoryId: 'memory_1', mood: 'NEGATIVE', score: -1, keywords: ['开心'], createdAt: point.createdAt,
      tags: ['状态变化'], reason: '更低落', correctionId: 2, correctedAt: '2026-01-01T02:00:00.000Z',
      originalMood: 'POSITIVE', originalScore: 1,
    })
    expect(next).toMatchObject({ mood: 'NEGATIVE', score: -1, tags: ['状态变化'], reason: '更低落' })
    expect(applyMoodCorrection(point, null)).toEqual(point)
  })
})
