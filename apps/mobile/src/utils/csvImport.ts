export type PeriodCsvImportErrorCode =
  | 'EMPTY_FILE'
  | 'INVALID_HEADER'
  | 'MISSING_FIELD'
  | 'INVALID_DATE'
  | 'INVALID_VALUE'
  | 'DUPLICATE'
  | 'ROW_LIMIT_EXCEEDED'
  | 'ENCODING_ERROR';

export interface PeriodCsvImportFailure {
  row: number;
  line: number;
  periodId: string | null;
  date: string | null;
  dimension: string | null;
  code: PeriodCsvImportErrorCode;
  message: string;
}

export interface PeriodCsvImportResult {
  received: number;
  imported: number;
  skipped: number;
  failed: number;
  failures_total: number;
  failures: PeriodCsvImportFailure[];
  result_code: 'OK' | 'EMPTY_FILE';
}

export interface ImportSummary {
  title: string;
  message: string;
  type: 'success' | 'error';
}

const CODE_LABELS: Record<PeriodCsvImportErrorCode, string> = {
  EMPTY_FILE: '文件为空',
  INVALID_HEADER: '表头不匹配',
  MISSING_FIELD: '字段缺失',
  INVALID_DATE: '日期非法',
  INVALID_VALUE: '数值非法',
  DUPLICATE: '键重复',
  ROW_LIMIT_EXCEEDED: '行数超限',
  ENCODING_ERROR: '编码非法',
};

/** 服务端是唯一计数事实源；客户端只做结构化摘要，不静默、不修数。 */
export function describePeriodCsvImport(value: PeriodCsvImportResult): ImportSummary {
  const summary = `成功 ${value.imported}，跳过 ${value.skipped}，失败 ${value.failed}（总 ${value.received}）`;
  if (value.result_code === 'EMPTY_FILE' || value.received === 0) {
    return { title: '导入完成', message: `${CODE_LABELS.EMPTY_FILE}：${summary}`, type: 'error' };
  }
  if (value.failed > 0) {
    const first = value.failures[0];
    const detail = first ? `；首错 ${CODE_LABELS[first.code]}` : '';
    return { title: '导入完成', message: `${summary}${detail}`, type: 'error' };
  }
  return { title: '导入完成', message: summary, type: 'success' };
}
