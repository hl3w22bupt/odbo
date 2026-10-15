import { describe, expect, it } from 'vitest'
import { describePeriodCsvImport, type PeriodCsvImportResult } from './csvImport'

describe('period csv import summary', () => {
  it('shows a non-silent count summary on success', () => {
    const result: PeriodCsvImportResult = {
      received: 10, imported: 7, skipped: 2, failed: 1,
      failures_total: 1,
      failures: [{ row: 2, line: 2, periodId: '2026-10-12', date: '2026-10-12', dimension: 'count', code: 'INVALID_VALUE', message: 'bad' }],
      result_code: 'OK',
    }
    expect(describePeriodCsvImport(result)).toEqual({
      title: '导入完成',
      message: '成功 7，跳过 2，失败 1（总 10）；首错 数值非法',
      type: 'error',
      details: ['第 2 行 · 第 2 行：数值非法：bad'],
      hiddenDetailCount: 0,
    })
  })

  it('renders at most three line/reason details and folds the remainder', () => {
    const failures = Array.from({ length: 5 }, (_, index) => ({
      row: index + 1, line: index + 2, periodId: null, date: null, dimension: null,
      code: 'INVALID_DATE' as const, message: `bad-${index + 1}`,
    }))
    const result: PeriodCsvImportResult = {
      received: 5, imported: 0, skipped: 0, failed: 5,
      failures_total: 5, failures, result_code: 'OK',
    }
    const summary = describePeriodCsvImport(result)
    expect(summary.details).toEqual([
      '第 1 行 · 第 2 行：日期非法：bad-1',
      '第 2 行 · 第 3 行：日期非法：bad-2',
      '第 3 行 · 第 4 行：日期非法：bad-3',
    ])
    expect(summary.hiddenDetailCount).toBe(2)
    expect(summary.message).toContain('+2 行')
  })

  it('keeps script payloads escaped in renderable details', () => {
    const result: PeriodCsvImportResult = {
      received: 1, imported: 0, skipped: 0, failed: 1,
      failures_total: 1,
      failures: [{ row: 1, line: 2, periodId: null, date: null, dimension: null, code: 'INVALID_VALUE', message: '<script>alert(1)</script>' }],
      result_code: 'OK',
    }
    expect(describePeriodCsvImport(result).details).toEqual([
      '第 1 行 · 第 2 行：数值非法：&lt;script&gt;alert(1)&lt;/script&gt;',
    ])
  })

  it('uses the structured empty marker and keeps failure visible', () => {
    const result: PeriodCsvImportResult = {
      received: 0, imported: 0, skipped: 0, failed: 0,
      failures_total: 0, failures: [], result_code: 'EMPTY_FILE',
    }
    expect(describePeriodCsvImport(result)).toEqual({
      title: '导入完成',
      message: '文件为空：成功 0，跳过 0，失败 0（总 0）',
      type: 'error',
      details: [],
      hiddenDetailCount: 0,
    })
  })
})
