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
    })
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
    })
  })
})
