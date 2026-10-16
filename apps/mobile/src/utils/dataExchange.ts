/**
 * v0.13 数据导入/导出触达纯函数层。
 * 服务端是 1000 行上限唯一权威；客户端预检只用于体验提示，不作为契约或阻断器。
 */

export interface PeriodExportContract {
  endpoint: string;
  method: 'GET';
  fallbackFilename: string;
  filename: string;
  contentDisposition: string;
}

export interface PeriodImportContract {
  endpoint: string;
  method: 'POST';
}

interface MinimalHeaders {
  get(name: string): string | null;
}

interface CsvDownloadResponse {
  ok: boolean;
  status: number;
  headers: MinimalHeaders;
  blob(): Promise<Blob>;
}

interface AnchorLike {
  href: string;
  download: string;
  click(): void;
}

interface DownloadEnvironment {
  document: {
    createElement(tag: string): AnchorLike;
    body: {
      appendChild(node: AnchorLike): unknown;
      removeChild(node: AnchorLike): unknown;
    };
  };
  url: {
    createObjectURL(blob: Blob): string;
    revokeObjectURL(url: string): void;
  };
}

export function periodExportContract(conversationId: string, periodId: string): PeriodExportContract {
  const fallbackFilename = `xinban-period-${periodId}.csv`;
  const filename = `心伴周期-${periodId}.csv`;
  return {
    endpoint: `/api/v1/conversations/${encodeURIComponent(conversationId)}/mood-period-comparison/export.csv?periods=3`,
    method: 'GET',
    fallbackFilename,
    filename,
    contentDisposition:
      `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };
}

export function periodImportContract(conversationId: string): PeriodImportContract {
  return {
    endpoint: `/api/v1/conversations/${encodeURIComponent(conversationId)}/mood-period-comparison/import.csv`,
    method: 'POST',
  };
}

function encodedFilenameFromDisposition(header: string): string | null {
  const match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function asciiFilenameFromDisposition(header: string): string | null {
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? null;
}

export async function readPeriodCsvDownload(
  response: CsvDownloadResponse,
): Promise<{ blob: Blob; filename: string }> {
  const contentType = response.headers.get('content-type') ?? '';
  const disposition = response.headers.get('content-disposition') ?? '';
  if (!response.ok || response.status !== 200 || !contentType.toLowerCase().startsWith('text/csv') || !disposition) {
    throw new Error('CSV 导出响应非法');
  }

  const contract = periodExportContract('conversation', 'period');
  const filename = encodedFilenameFromDisposition(disposition)
    ?? asciiFilenameFromDisposition(disposition)
    ?? contract.fallbackFilename;
  return { blob: await response.blob(), filename };
}

export function triggerBlobDownload(
  blob: Blob,
  filename: string,
  environment: DownloadEnvironment = {
    document: globalThis.document as unknown as DownloadEnvironment['document'],
    url: globalThis.URL as unknown as DownloadEnvironment['url'],
  },
): void {
  const url = environment.url.createObjectURL(blob);
  const anchor = environment.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  environment.document.body.appendChild(anchor);
  anchor.click();
  environment.document.body.removeChild(anchor);
  environment.url.revokeObjectURL(url);
}

export function countPeriodCsvRows(csv: string): number {
  const body = csv.replace(/^\ufeff/, '').trim();
  return body === '' ? 0 : body.split(/\r?\n/).length - 1;
}

export interface ClientImportPrecheck {
  clientRowCount: number;
  blocked: boolean;
  reason?: string;
}

export function serverAuthoritativeImportResult<T>(client: ClientImportPrecheck, server: T): T {
  void client;
  return server;
}

export function escapeDisplayText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
