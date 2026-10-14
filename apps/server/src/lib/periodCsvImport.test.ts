import { describe, expect, it } from 'vitest'
import { CSV_HEADER } from './csvExport.js'
import {
  CSV_IMPORT_ERROR_CODES,
  parsePeriodCsvImport,
  type PeriodCsvImportErrorCode,
} from './periodCsvImport.js'

const HEADER = `${CSV_HEADER.join(',')}`

function csv(rows: string[], bom = true): string {
  return `${bom ? '\ufeff' : ''}${[HEADER, ...rows].join('\r\n')}\r\n`
}

function validRows(period = '2026-10-12', count = 1, positive = 0, neutral = 1, negative = 0, average = 0): string[] {
  return [
    `${period},${period},count,${count}`,
    `${period},${period},positive,${positive}`,
    `${period},${period},neutral,${neutral}`,
    `${period},${period},negative,${negative}`,
    `${period},${period},averageScore,${average}`,
  ]
}

describe('period csv import parser', () => {
  it('accepts the real v0.9 export shape with BOM and preserves numeric precision', () => {
    const result = parsePeriodCsvImport(csv(validRows('2026-10-05', 3, 2, 0, 1, 1 / 3)))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.received).toBe(5)
    expect(result.failures).toEqual([])
    expect(result.records.map((row) => row.line)).toEqual([2, 3, 4, 5, 6])
    expect(result.records.find((row) => row.dimension === 'averageScore')?.value).toBe(1 / 3)
  })

  it('rejects non utf8 bytes with the closed encoding code', () => {
    const bytes = new TextEncoder().encode(csv(validRows())).slice(0, 20)
    bytes[8] = 0xff
    bytes[9] = 0xfe
    const result = parsePeriodCsvImport(bytes)
    expect(result).toMatchObject({ kind: 'encoding', code: 'ENCODING_ERROR' })
  })

  it('returns an empty legal result for whitespace or header-only files', () => {
    expect(parsePeriodCsvImport('\ufeff \r\n')).toMatchObject({ kind: 'empty', code: 'EMPTY_FILE' })
    const headerOnly = parsePeriodCsvImport(csv([]))
    expect(headerOnly).toMatchObject({ kind: 'ok', received: 0, resultCode: 'EMPTY_FILE' })
  })

  it('requires the single source header exactly and reports line one', () => {
    const wrongOrder = '\ufeffdate,period_id,dimension,value\r\n'
    const result = parsePeriodCsvImport(wrongOrder)
    expect(result).toMatchObject({ kind: 'file-error', code: 'INVALID_HEADER', line: 1 })
  })

  it('rejects the first row beyond the frozen limit before any row validation', () => {
    const rows = Array.from({ length: 1001 }, (_, index) => `2026-10-12,2026-10-12,count,${index}`)
    const result = parsePeriodCsvImport(csv(rows))
    expect(result).toMatchObject({ kind: 'file-error', code: 'ROW_LIMIT_EXCEEDED', line: 1002, limit: 1000 })
  })

  it('marks missing columns and unknown dimensions with physical row numbers', () => {
    const result = parsePeriodCsvImport(csv([
      '2026-10-12,2026-10-12,count',
      '2026-10-12,2026-10-12,mood,1',
    ]))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.failures).toEqual([
      expect.objectContaining({ row: 1, line: 2, code: 'MISSING_FIELD' }),
      expect.objectContaining({ row: 2, line: 3, code: 'MISSING_FIELD', dimension: 'mood' }),
    ])
  })

  it('marks mismatched or non-monday dates with invalid date', () => {
    const result = parsePeriodCsvImport(csv([
      '2026-10-12,2026-10-13,count,1',
      '2026-10-13,2026-10-13,count,1',
    ]))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.failures.map((row) => row.code)).toEqual(['INVALID_DATE', 'INVALID_DATE'])
    expect(result.failures.map((row) => row.line)).toEqual([2, 3])
  })

  it('marks invalid numeric values and in-file duplicate keys', () => {
    const result = parsePeriodCsvImport(csv([
      '2026-10-12,2026-10-12,count,-1',
      '2026-10-12,2026-10-12,averageScore,NaN',
      '2026-10-12,2026-10-12,count,1',
      '2026-10-12,2026-10-12,positive,1',
      '2026-10-12,2026-10-12,neutral,0',
      '2026-10-12,2026-10-12,negative,0',
      '2026-10-12,2026-10-12,averageScore,1',
      '2026-10-12,2026-10-12,count,1',
    ]))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.failures).toEqual([
      expect.objectContaining({ row: 1, line: 2, dimension: 'count', code: 'INVALID_VALUE' }),
      expect.objectContaining({ row: 2, line: 3, dimension: 'averageScore', code: 'INVALID_VALUE' }),
      expect.objectContaining({ row: 8, line: 9, dimension: 'count', code: 'DUPLICATE' }),
    ])
  })

  it('keeps incomplete imported groups out of writable records', () => {
    const result = parsePeriodCsvImport(csv(['2026-10-12,2026-10-12,count,1']))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.failures[0]).toMatchObject({ row: 1, line: 2, periodId: '2026-10-12', code: 'MISSING_FIELD' })
    expect(result.records).toHaveLength(1)
    expect(result.writableGroups).toEqual([])
  })

  it('rejects aggregate groups that cannot be losslessly represented as mood samples', () => {
    const result = parsePeriodCsvImport(csv(validRows('2026-10-12', 2, 1, 0, 0, 0.25)))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.failures).toHaveLength(5)
    expect(result.failures.every((row) => row.code === 'INVALID_VALUE')).toBe(true)
    expect(result.writableGroups).toEqual([])
  })

  it('exposes the frozen eight-code enum only', () => {
    expect([...CSV_IMPORT_ERROR_CODES]).toEqual([
      'EMPTY_FILE', 'INVALID_HEADER', 'MISSING_FIELD', 'INVALID_DATE',
      'INVALID_VALUE', 'DUPLICATE', 'ROW_LIMIT_EXCEEDED', 'ENCODING_ERROR',
    ])
    const check: readonly PeriodCsvImportErrorCode[] = CSV_IMPORT_ERROR_CODES
    expect(check).toHaveLength(8)
  })
})
