/**
 * v0.9 CSV 导出 writer：零依赖、RFC 4180 兼容，固定 UTF-8 BOM。
 */
export const CSV_HEADER = ['period_id', 'date', 'dimension', 'value'] as const

export function encodeCsvCell(value: string | number | null): string {
  if (value === null) return ''
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function encodeCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null>>): string {
  const lines = [CSV_HEADER, ...rows].map((row) => row.map(encodeCsvCell).join(','))
  return `\ufeff${lines.join('\r\n')}\r\n`
}
