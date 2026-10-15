import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parsePeriodCsvImport } from './periodCsvImport.js'

const FIXTURES = join(process.cwd(), 'src/lib/fixtures/period-csv-import')

async function fixture(name: string): Promise<string> {
  return readFile(join(FIXTURES, name), 'utf8')
}

describe('signed period csv import fixtures', () => {
  it('EMPTY_FILE gives a legal header-only result', async () => {
    const result = parsePeriodCsvImport(await fixture('EMPTY_FILE.csv'))
    expect(result).toMatchObject({ kind: 'empty', code: 'EMPTY_FILE', line: 1 })
  })

  it('INVALID_HEADER anchors the file at physical line 1', async () => {
    const result = parsePeriodCsvImport(await fixture('INVALID_HEADER.csv'))
    expect(result).toMatchObject({ kind: 'file-error', code: 'INVALID_HEADER', line: 1 })
  })

  it('MISSING_FIELD anchors the unknown dimension at physical line 2', async () => {
    const result = parsePeriodCsvImport(await fixture('MISSING_FIELD.csv'))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.failures).toEqual([expect.objectContaining({ code: 'MISSING_FIELD', row: 1, line: 2, dimension: 'mood' })])
  })

  it('INVALID_DATE anchors a mismatched date at physical line 2', async () => {
    const result = parsePeriodCsvImport(await fixture('INVALID_DATE.csv'))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.failures).toEqual([expect.objectContaining({ code: 'INVALID_DATE', row: 1, line: 2 })])
  })

  it('INVALID_VALUE anchors a negative count at physical line 2', async () => {
    const result = parsePeriodCsvImport(await fixture('INVALID_VALUE.csv'))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.failures).toEqual([expect.objectContaining({ code: 'INVALID_VALUE', row: 1, line: 2, dimension: 'count' })])
  })

  it('DUPLICATE anchors the repeated business key at physical line 7', async () => {
    const result = parsePeriodCsvImport(await fixture('DUPLICATE.csv'))
    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') return
    expect(result.failures).toEqual([expect.objectContaining({ code: 'DUPLICATE', row: 6, line: 7, dimension: 'count' })])
    expect(result.writableGroups).toHaveLength(1)
  })

  it('ROW_LIMIT_EXCEEDED rejects the first over-limit physical line', async () => {
    const result = parsePeriodCsvImport(await fixture('ROW_LIMIT_EXCEEDED.csv'))
    expect(result).toMatchObject({ kind: 'file-error', code: 'ROW_LIMIT_EXCEEDED', line: 1002, limit: 1000 })
  })

  it('ENCODING_ERROR rejects invalid UTF-8 bytes', async () => {
    const bytes = await readFile(join(FIXTURES, 'ENCODING_ERROR.csv.bytes'))
    expect(parsePeriodCsvImport(bytes)).toMatchObject({ kind: 'encoding', code: 'ENCODING_ERROR' })
  })
})
