#!/usr/bin/env node
/** run-all —— 零依赖契约测试聚合器。用法：node tests/run-all.mjs [spec 文件名…] */
import { readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2).map((s) => basename(s, '.mjs'));
const files = readdirSync(join(here, 'contract'))
  .filter((f) => f.endsWith('.spec.mjs'))
  .filter((f) => !only.length || only.some((o) => f.includes(o)))
  .sort();

let passed = 0;
let failed = 0;
for (const file of files) {
  const mod = await import(join(here, 'contract', file));
  const tests = mod.tests || [];
  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
      console.log(`PASS ${file} :: ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${file} :: ${t.name}\n  ${err.message}`);
    }
  }
}
console.log(`\n${passed} passed, ${failed} failed, ${files.length} spec files`);
process.exit(failed ? 1 : 0);
