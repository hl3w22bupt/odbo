import { describe, expect, it } from 'vitest'
import { readableMoodPeriodReport } from './moodPeriodReport.js'
import { PERIOD_CSV_COLUMNS, moodPeriodReportCsv } from './periodCsv.js'
import type { MemoryReadContract, MoodTimelineContract } from './conversationInsights.js'

const memory: MemoryReadContract = {
  conversationId: 'scope_1', available: true, degraded: false,
  items: [{ id: 'mem_1', conversationId: 'conv_1', characterId: null, sourceMessageId: null, content: '有效', status: 'ACTIVE', createdAt: '2026-10-05T00:00:00.000Z' }],
}
const timeline: MoodTimelineContract = {
  conversationId: 'scope_1', available: true, degraded: false,
  points: [
    { id: 'p1', conversationId: 'conv_1', characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1', mood: 'POSITIVE', score: 1, keywords: [], createdAt: '2026-10-05T00:00:00.000Z' },
    { id: 'p2', conversationId: 'conv_1', characterId: null, sourceMessageId: 'msg', memoryId: 'mem_1', mood: 'NEGATIVE', score: -1, keywords: [], createdAt: '2026-10-06T00:00:00.000Z' },
  ],
}

describe('v0.9 period CSV', () => {
  it('uses the frozen column order and emits data rows without row-count metadata', () => {
    const report = readableMoodPeriodReport('scope_1', memory, timeline, new Date('2026-10-13T01:00:00.000Z'), '2026-10-05')
    const csv = moodPeriodReportCsv(report)
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0].split(',')).toEqual([...PERIOD_CSV_COLUMNS])
    expect(lines).toHaveLength(3)
    expect(lines[1].split(',')).toEqual(['2026-10-05', '2026-10-05', 'true', 'false', '2026-10-04T16:00:00.000Z', '2026-10-11T16:00:00.000Z', '1', '0', '0', '2', '1', '2', '7', 'PARTIAL'])
    expect(lines[2].split(',')[1]).toBe('2026-10-06')
    expect(csv).not.toContain('row_count')
    expect(csv).not.toContain('rowCount')
  })

  it('emits byte-stable output for the same report', () => {
    const report = readableMoodPeriodReport('scope_1', memory, timeline, new Date('2026-10-13T01:00:00.000Z'), '2026-10-05')
    expect(moodPeriodReportCsv(report)).toBe(moodPeriodReportCsv(report))
  })
})
