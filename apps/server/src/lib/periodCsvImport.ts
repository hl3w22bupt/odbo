/**
 * v0.12 周期 CSV 导入解析器（纯函数）。
 * 列契约唯一来源是 v0.9 导出 writer 的 CSV_HEADER；这里不复制表头字面量。
 */
import { AppError } from './errors.js'
import { CSV_HEADER } from './csvExport.js'
import { COMPARISON_DIMENSIONS } from './moodPeriodComparison.js'

export type PeriodCsvImportErrorCode =
  | 'EMPTY_FILE'
  | 'INVALID_HEADER'
  | 'MISSING_FIELD'
  | 'INVALID_DATE'
  | 'INVALID_VALUE'
  | 'DUPLICATE'
  | 'ROW_LIMIT_EXCEEDED'
  | 'ENCODING_ERROR'

export const CSV_IMPORT_ERROR_CODES = [
  'EMPTY_FILE',
  'INVALID_HEADER',
  'MISSING_FIELD',
  'INVALID_DATE',
  'INVALID_VALUE',
  'DUPLICATE',
  'ROW_LIMIT_EXCEEDED',
  'ENCODING_ERROR',
] as const satisfies readonly PeriodCsvImportErrorCode[]

export const CSV_IMPORT_ROW_LIMIT = 1000

export interface PeriodCsvImportRow {
  row: number
  line: number
  periodId: string
  date: string
  dimension: string
  value: number
}

export interface PeriodCsvImportFailure {
  row: number
  line: number
  periodId: string | null
  date: string | null
  dimension: string | null
  code: PeriodCsvImportErrorCode
  message: string
}

export interface WritablePeriodSample {
  memoryId: string
  mood: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  score: -1 | 0 | 1
  createdAt: Date
}

export interface WritablePeriodGroup {
  periodId: string
  date: string
  count: number
  samples: WritablePeriodSample[]
  rows: PeriodCsvImportRow[]
}

export type PeriodCsvImportParseResult =
  | { kind: 'empty'; code: Extract<PeriodCsvImportErrorCode, 'EMPTY_FILE'>; line: number }
  | { kind: 'encoding'; code: Extract<PeriodCsvImportErrorCode, 'ENCODING_ERROR'> }
  | { kind: 'file-error'; code: Extract<PeriodCsvImportErrorCode, 'INVALID_HEADER' | 'ROW_LIMIT_EXCEEDED'>; line: number; limit?: number }
  | {
      kind: 'ok'
      received: number
      resultCode: 'OK' | 'EMPTY_FILE'
      records: PeriodCsvImportRow[]
      failures: PeriodCsvImportFailure[]
      writableGroups: WritablePeriodGroup[]
    }

const DIMENSIONS = COMPARISON_DIMENSIONS
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

function isMonday(periodId: string): boolean {
  if (!DATE_PATTERN.test(periodId)) return false
  const utcDay = Date.parse(`${periodId}T00:00:00.000Z`)
  if (!Number.isFinite(utcDay)) return false
  if (new Date(utcDay).toISOString().slice(0, 10) !== periodId) return false
  return new Date(utcDay).getUTCDay() === 1
}

function decode(input: string | Buffer): string | null {
  try {
    return typeof input === 'string'
      ? new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(input, 'utf8'))
      : new TextDecoder('utf-8', { fatal: true }).decode(input)
  } catch {
    return null
  }
}

interface ParsedRecord {
  fields: string[]
  line: number
}

/** 零依赖 RFC 4180：支持 CRLF/LF、quoted comma/quote/CRLF，并保留物理行号。 */
function parseRecords(text: string): ParsedRecord[] {
  const records: ParsedRecord[] = []
  let fields: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let sawAny = false

  const pushField = () => {
    fields.push(field)
    field = ''
  }
  const pushRecord = () => {
    pushField()
    records.push({ fields, line })
    fields = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    sawAny = true
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        if (char === '\n') line += 1
        field += char
      }
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
      continue
    }
    if (char === ',') {
      pushField()
      continue
    }
    if (char === '\r' && text[index + 1] === '\n') {
      pushRecord()
      index += 1
      line += 1
      continue
    }
    if (char === '\n') {
      pushRecord()
      line += 1
      continue
    }
    field += char
  }

  if (!sawAny) return records
  if (quoted) throw new Error('unclosed quoted field')
  if (field !== '' || fields.length > 0) pushRecord()
  return records
}

function failure(
  parsed: ParsedRecord | undefined,
  rowNumber: number,
  code: PeriodCsvImportErrorCode,
  message: string,
  partial: { periodId?: string; date?: string; dimension?: string } = {},
  lineOverride?: number,
): PeriodCsvImportFailure {
  const fields = parsed?.fields ?? []
  return {
    row: rowNumber,
    line: lineOverride ?? parsed?.line ?? 1,
    periodId: partial.periodId ?? fields[0] ?? null,
    date: partial.date ?? fields[1] ?? null,
    dimension: partial.dimension ?? fields[2] ?? null,
    code,
    message,
  }
}

function parseNumber(raw: string): number | null {
  const value = raw.trim()
  if (value === '' || !NUMBER_PATTERN.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildWritableGroups(
  records: PeriodCsvImportRow[],
  failures: PeriodCsvImportFailure[],
): WritablePeriodGroup[] {
  const groups = new Map<string, PeriodCsvImportRow[]>()
  for (const row of records) {
    const rows = groups.get(row.periodId) ?? []
    rows.push(row)
    groups.set(row.periodId, rows)
  }

  const writable: WritablePeriodGroup[] = []
  for (const [periodId, rows] of groups) {
    const valueFor = (dimension: string): PeriodCsvImportRow | undefined =>
      rows.find((row) => row.dimension === dimension)
    const countRow = valueFor('count')
    const positiveRow = valueFor('positive')
    const neutralRow = valueFor('neutral')
    const negativeRow = valueFor('negative')
    const averageRow = valueFor('averageScore')
    const complete = Boolean(
      rows.length === DIMENSIONS.length &&
        countRow && positiveRow && neutralRow && negativeRow && averageRow,
    )
    if (!complete) {
      for (const row of rows) {
        failures.push({
          row: row.row,
          line: row.line,
          periodId: row.periodId,
          date: row.date,
          dimension: row.dimension,
          code: 'MISSING_FIELD',
          message: '周期聚合组缺少 v0.9 维度',
        })
      }
      continue
    }
    if (!countRow || !positiveRow || !neutralRow || !negativeRow || !averageRow) continue
    const lossless =
      positiveRow.value + neutralRow.value + negativeRow.value === countRow.value &&
      countRow.value > 0 &&
      averageRow.value === (positiveRow.value - negativeRow.value) / countRow.value
    if (!lossless) {
      for (const row of rows) {
        failures.push({
          row: row.row,
          line: row.line,
          periodId: row.periodId,
          date: row.date,
          dimension: row.dimension,
          code: 'INVALID_VALUE',
          message: '周期聚合组无法无损还原为样本',
        })
      }
      continue
    }

    const samples: WritablePeriodSample[] = []
    let sequence = 0
    const createdAt = new Date(`${periodId}T12:00:00+08:00`)
    for (const mood of ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const) {
      const total = mood === 'POSITIVE'
        ? positiveRow.value
        : mood === 'NEUTRAL' ? neutralRow.value : negativeRow.value
      const score: -1 | 0 | 1 = mood === 'POSITIVE' ? 1 : mood === 'NEGATIVE' ? -1 : 0
      for (let index = 0; index < total; index += 1) {
        sequence += 1
        samples.push({
          memoryId: `period_import_${periodId}_${sequence}`,
          mood,
          score,
          createdAt,
        })
      }
    }
    writable.push({ periodId, date: countRow.date, count: countRow.value, samples, rows })
  }
  return writable
}

export function parsePeriodCsvImport(
  input: string | Buffer,
  limit = CSV_IMPORT_ROW_LIMIT,
): PeriodCsvImportParseResult {
  const text = decode(input)
  if (text === null) return { kind: 'encoding', code: 'ENCODING_ERROR' }
  const withoutBom = text.replace(/^\ufeff/, '')
  if (withoutBom.trim() === '') return { kind: 'empty', code: 'EMPTY_FILE', line: 1 }

  let records: ParsedRecord[]
  try {
    records = parseRecords(withoutBom)
  } catch {
    return { kind: 'file-error', code: 'INVALID_HEADER', line: 1 }
  }

  const header = records[0]
  if (
    !header ||
    header.fields.length !== CSV_HEADER.length ||
    CSV_HEADER.some((column, index) => header.fields[index] !== column)
  ) {
    return { kind: 'file-error', code: 'INVALID_HEADER', line: header?.line ?? 1 }
  }

  const dataRecords = records.slice(1)
  if (dataRecords.length > limit) {
    return { kind: 'file-error', code: 'ROW_LIMIT_EXCEEDED', line: dataRecords[limit]?.line ?? limit + 2, limit }
  }
  if (dataRecords.length === 0) {
    return { kind: 'ok', received: 0, resultCode: 'EMPTY_FILE', records: [], failures: [], writableGroups: [] }
  }

  const failures: PeriodCsvImportFailure[] = []
  const validRows: PeriodCsvImportRow[] = []
  const businessKeys = new Set<string>()

  dataRecords.forEach((record, index) => {
    const rowNumber = index + 1
    const [rawPeriod = '', rawDate = '', rawDimension = '', rawValue = ''] = record.fields
    if (record.fields.length !== CSV_HEADER.length || !rawPeriod.trim() || !rawDate.trim() || !rawDimension.trim() || rawValue.trim() === '') {
      failures.push(failure(record, rowNumber, 'MISSING_FIELD', 'CSV 行字段缺失'))
      return
    }
    if (!(DIMENSIONS as readonly string[]).includes(rawDimension)) {
      failures.push(failure(record, rowNumber, 'MISSING_FIELD', 'dimension 不在 v0.9 导出契约内', { dimension: rawDimension }))
      return
    }
    if (!isMonday(rawPeriod) || rawDate !== rawPeriod) {
      failures.push(failure(record, rowNumber, 'INVALID_DATE', 'period_id 与 date 必须是同一东八区周一 YYYY-MM-DD'))
      return
    }
    const value = parseNumber(rawValue)
    if (value === null) {
      failures.push(failure(record, rowNumber, 'INVALID_VALUE', `${rawDimension} 必须是 finite number`))
      return
    }
    if (rawDimension === 'averageScore') {
      if (value < -1 || value > 1) {
        failures.push(failure(record, rowNumber, 'INVALID_VALUE', 'averageScore 必须在 [-1,1]'))
        return
      }
    } else if (!Number.isInteger(value) || value < 0) {
      failures.push(failure(record, rowNumber, 'INVALID_VALUE', `${rawDimension} 必须是非负整数`))
      return
    }

    const key = `${rawPeriod}\n${rawDate}\n${rawDimension}`
    if (businessKeys.has(key)) {
      failures.push(failure(record, rowNumber, 'DUPLICATE', '幂等键在文件内重复'))
      return
    }
    businessKeys.add(key)
    validRows.push({ row: rowNumber, line: record.line, periodId: rawPeriod, date: rawDate, dimension: rawDimension, value })
  })

  const writableGroups = buildWritableGroups(validRows, failures)
  failures.sort((a, b) => a.row - b.row)

  return {
    kind: 'ok',
    received: dataRecords.length,
    resultCode: 'OK',
    records: validRows,
    failures,
    writableGroups,
  }
}

export function periodCsvImportFileError(result: Exclude<PeriodCsvImportParseResult, { kind: 'ok' }>): AppError {
  if (result.kind === 'empty') return new AppError(200, result.code, 'CSV 文件为空')
  if (result.kind === 'encoding') return new AppError(400, result.code, 'CSV 必须是有效 UTF-8')
  if (result.code === 'ROW_LIMIT_EXCEEDED') {
    return new AppError(413, result.code, `CSV 行数超限：limit=${result.limit ?? CSV_IMPORT_ROW_LIMIT}`, { limit: result.limit })
  }
  return new AppError(400, result.code, 'CSV 表头必须精确匹配 v0.9 导出契约', { line: result.line })
}
