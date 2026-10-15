#!/usr/bin/env node
/**
 * v0.12 干跑验证：真实 v0.9 导出文件字节反向喂导入解析器（冻结条款独立复核）。
 * 用法：node v012-recheck-dryrun.mjs <export.csv> <dist/periodCsvImport.js>
 * 输出单行 JSON：{ kind, received, resultCode, failures, groups, samples } 或 { kind, code }。
 */
import { readFileSync } from 'node:fs';

const [exportPath, parserPath] = process.argv.slice(2);
if (!exportPath || !parserPath) {
  console.error('usage: node v012-recheck-dryrun.mjs <export.csv> <parser.js>');
  process.exit(2);
}

const { parsePeriodCsvImport } = await import(parserPath);
const bytes = readFileSync(exportPath);
const r = parsePeriodCsvImport(bytes);
if (r.kind === 'ok') {
  console.log(JSON.stringify({
    kind: r.kind,
    received: r.received,
    resultCode: r.resultCode,
    failures: r.failures.length,
    groups: r.writableGroups.length,
    samples: r.writableGroups.reduce((n, g) => n + g.samples.length, 0),
  }));
} else {
  console.log(JSON.stringify({ kind: r.kind, code: r.code }));
}
