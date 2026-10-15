import { describe, expect, it } from 'vitest';
import {
  periodExportContract,
  periodImportContract,
  readPeriodCsvDownload,
  serverAuthoritativeImportResult,
  countPeriodCsvRows,
  escapeDisplayText,
  triggerBlobDownload,
} from './dataExchange';

describe('period data exchange contracts', () => {
  it('targets the existing aggregate CSV endpoint with GET and encodes the Chinese filename by RFC 5987', () => {
    const contract = periodExportContract('conv_1', '2026-10-05');
    expect(contract).toEqual({
      endpoint: '/api/v1/conversations/conv_1/mood-period-comparison/export.csv?periods=3',
      method: 'GET',
      fallbackFilename: 'xinban-period-2026-10-05.csv',
      filename: '心伴周期-2026-10-05.csv',
      contentDisposition:
        'attachment; filename="xinban-period-2026-10-05.csv"; filename*=UTF-8\'\''
        + encodeURIComponent('心伴周期-2026-10-05.csv'),
    });
  });

  it('creates a CSV blob from the existing endpoint response and downloads the RFC 5987 filename', async () => {
    const payload = new Blob(['period_id,date,dimension,value\r\n'], { type: 'text/csv' });
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': periodExportContract('conv_1', '2026-10-05').contentDisposition,
      }),
      blob: async () => payload,
    };
    const downloaded = await readPeriodCsvDownload(response);
    expect(downloaded.blob).toBe(payload);
    expect(downloaded.filename).toBe('心伴周期-2026-10-05.csv');

    const clicks: string[] = [];
    const anchor = {
      href: '',
      download: '',
      click: () => clicks.push(anchor.download),
    };
    const documentLike = {
      createElement: () => anchor,
      body: { appendChild: () => undefined, removeChild: () => undefined },
    };
    const urlLike = {
      createObjectURL: () => 'blob:download-test',
      revokeObjectURL: () => undefined,
    };
    triggerBlobDownload(downloaded.blob, downloaded.filename, {
      document: documentLike,
      url: urlLike,
    });
    expect(anchor.href).toBe('blob:download-test');
    expect(anchor.download).toBe('心伴周期-2026-10-05.csv');
    expect(clicks).toEqual(['心伴周期-2026-10-05.csv']);
  });

  it('rejects an unexpected export payload instead of downloading dirty bytes', async () => {
    await expect(readPeriodCsvDownload({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      blob: async () => new Blob(['{}'], { type: 'application/json' }),
    })).rejects.toThrow('CSV 导出响应非法');
  });

  it('targets the existing import endpoint and accepts text files through the JSON convenience channel', () => {
    expect(periodImportContract('conv_1')).toEqual({
      endpoint: '/api/v1/conversations/conv_1/mood-period-comparison/import.csv',
      method: 'POST',
    });
  });

  it('keeps a 1000-row client count advisory-only and defers to the server in both mismatch directions', () => {
    expect(countPeriodCsvRows('header\r\nrow-1\r\nrow-2\r\n')).toBe(2);
    const clientOver = { clientRowCount: 1001, blocked: true as const, reason: 'ROW_LIMIT_EXCEEDED' };
    const serverOk = { received: 1000, imported: 1000, failed: 0 };
    const clientOk = { clientRowCount: 2, blocked: false as const };
    const serverLimited = { received: 2, imported: 0, failed: 2 };
    expect(serverAuthoritativeImportResult(clientOver, serverOk)).toBe(serverOk);
    expect(serverAuthoritativeImportResult(clientOk, serverLimited)).toBe(serverLimited);
  });

  it('escapes script payloads before they can enter a text-rendering decision', () => {
    expect(escapeDisplayText('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
