#!/usr/bin/env node
/**
 * 契约测试（contract check）——「实现是否符合策划案」的机器层验收门禁
 *
 * 落地方案：docs/mobius-design-integration-plan.md D1 × D3 的耦合点（需求 R4）。
 * 思想来源：Claude of Tanks「一份规格数据喂给所有消费端」+「契约测试门槛」——
 * 游戏实现（脚本 / 场景 / 数值 / 验收检查）必须能对回 approved 版 GameDesignSpec，
 * 否则视为缺陷，哪怕游戏能跑（能跑是 godot-smoke / e2e 冒烟的职责，这里管「对不对」）。
 *
 * 用法（零依赖，Node >= 18，可在任意项目 worktree 内直接跑）：
 *   node contract-check.mjs [--spec <path>] [--project <dir>] [--json] [--strict]
 *
 *   --spec <path>    策划案 JSON 路径（默认 .myrd/spec/design-spec.json）。
 *                    接受两种形态：七段 spec 本体，或后端 GameDesignSpec 整行（{ spec: {...}, ... }）。
 *   --project <dir>  被测项目根（默认当前目录），spec 里的文件路径相对它断言存在。
 *   --json           输出结构化 JSON（供工作流节点 / 门禁 verdict 消费）。
 *   --strict         warning 也算失败（默认只报不拦）。
 *
 * 退出码：0 = 通过；1 = 契约违约；2 = 用法/环境错误（spec 读不到等 —— 门禁同样不放行）。
 *
 * 校验口径与平台侧 src/lib/game-design-spec.ts（v0 schema）保持一致：改这里必须同步改那里。
 * 数据链路：平台 approved 版策划案（game_design_specs，status='approved'）→ 导出/下发为
 * .myrd/spec/design-spec.json → 本脚本断言工程实现与其一致。
 */

import fs from 'node:fs';
import path from 'node:path';

const SECTIONS = ['meta', 'world', 'entities', 'levels', 'numeric', 'acceptance', 'content', 'assets'];
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/** 统一的检查结果条目：id 机器可判（供门禁 verdict / evolution 回流引用） */
function check(id, status, message, extra = {}) {
  return { id, status, message, ...extra };
}

function parseArgs(argv) {
  const args = { spec: process.env.CONTRACT_SPEC_PATH || '.myrd/spec/design-spec.json', project: process.cwd(), json: false, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--spec') args.spec = argv[++i] ?? '';
    else if (a === '--project') args.project = argv[++i] ?? '';
    else if (a === '--json') args.json = true;
    else if (a === '--strict') args.strict = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`未知参数：${a}`);
  }
  if (!args.spec) throw new Error('--spec 不能为空');
  return args;
}

/** 读取 spec：支持七段本体或后端整行（含 spec 字段）；返回 { spec, source } */
function loadSpec(specPath) {
  if (!fs.existsSync(specPath)) {
    throw new Error(`策划案文件不存在：${specPath}（把 approved 版策划案导出到该路径，或用 --spec 指定）`);
  }
  const raw = fs.readFileSync(specPath, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`策划案不是合法 JSON：${e instanceof Error ? e.message : String(e)}`);
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.spec && typeof parsed.spec === 'object') {
    return { spec: parsed.spec, meta: parsed, source: specPath };
  }
  return { spec: parsed, meta: null, source: specPath };
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isSafeRelativePath(p) {
  if (typeof p !== 'string' || !p || p.startsWith('/') || p.includes('\\')) return false;
  return !p.split('/').includes('..');
}

/**
 * 校验 spec 结构（与 src/lib/game-design-spec.ts validateGameDesignSpec 同口径）
 * 返回 issues: [{ code, path, message, severity }]
 */
export function validateSpec(spec) {
  const issues = [];
  const add = (code, p, message, severity = 'error') => issues.push({ code, path: p, message, severity });

  if (!isPlainObject(spec)) {
    add('invalid_spec', '', 'spec 必须是对象');
    return issues;
  }
  for (const key of Object.keys(spec)) {
    if (!SECTIONS.includes(key)) add('unknown_section', key, `未知段落「${key}」（v0 只认 ${SECTIONS.join(' / ')}）`);
  }
  const s = spec;
  if (s.meta !== undefined && !isPlainObject(s.meta)) add('invalid_section', 'meta', 'spec.meta 必须是对象');
  if (s.world !== undefined && typeof s.world !== 'string' && !isPlainObject(s.world)) add('invalid_section', 'world', 'spec.world 必须是字符串或对象');
  if (s.numeric !== undefined && !isPlainObject(s.numeric)) add('invalid_section', 'numeric', 'spec.numeric 必须是对象（键值数值表）');

  /** 实体/关卡/验收条目：id 存在 + 命名 + 唯一 + 文件路径安全 +（acceptance）statement */
  const validateEntries = (section, raw, fileFields) => {
    if (raw === undefined) return;
    if (!Array.isArray(raw)) {
      add('invalid_section', section, `spec.${section} 必须是数组`);
      return;
    }
    const seen = new Set();
    raw.forEach((item, i) => {
      const at = `${section}[${i}]`;
      if (!isPlainObject(item)) {
        add('invalid_entry', at, `${at} 必须是对象`);
        return;
      }
      const id = item.id;
      if (typeof id !== 'string' || !id.trim()) {
        add('missing_id', `${at}.id`, `${at} 缺少非空字符串 id（元素编号化的锚点）`);
      } else {
        if (!ID_PATTERN.test(id)) {
          add('naming', `${at}.id`, `id「${id}」不符合命名规范（小写字母/数字开头，仅小写字母、数字、中划线、下划线）`, 'warning');
        }
        if (seen.has(id)) add('duplicate_id', `${at}.id`, `${section} 内 id「${id}」重复`);
        seen.add(id);
      }
      if (section === 'acceptance' && (typeof item.statement !== 'string' || !item.statement.trim())) {
        add('missing_statement', `${at}.statement`, `${at} 缺少非空 statement（人工验收 checklist 的原文）`);
      }
      for (const f of fileFields) {
        const v = item[f];
        if (v === undefined || v === null) continue;
        if (typeof v !== 'string' || !v.trim()) add('invalid_path', `${at}.${f}`, `${at}.${f} 必须是非空字符串`);
        else if (!isSafeRelativePath(v)) add('unsafe_path', `${at}.${f}`, `${at}.${f}「${v}」必须是项目内相对路径（禁止绝对路径 / ..）`);
      }
    });
  };

  validateEntries('entities', s.entities, ['script', 'scene']);
  validateEntries('levels', s.levels, ['scene']);
  validateEntries('acceptance', s.acceptance, ['check']);

  // content：耐玩度预算（可选段，给了的字段才校验，与平台侧 game-design-spec.ts 同口径）
  if (s.content !== undefined) {
    if (!isPlainObject(s.content)) {
      add('invalid_section', 'content', 'spec.content 必须是对象');
    } else {
      const c = s.content;
      if (c.sessionSeconds !== undefined && (typeof c.sessionSeconds !== 'number' || !(c.sessionSeconds > 0))) {
        add('invalid_field', 'content.sessionSeconds', 'content.sessionSeconds 必须是正数（目标单局时长，秒）');
      }
      if (c.levelCount !== undefined && (typeof c.levelCount !== 'number' || !Number.isInteger(c.levelCount) || c.levelCount <= 0)) {
        add('invalid_field', 'content.levelCount', 'content.levelCount 必须是正整数（关卡数量下限，契约测试按它断言 levels 数量）');
      }
      if (c.replayHooks !== undefined
        && (!Array.isArray(c.replayHooks) || c.replayHooks.some((h) => typeof h !== 'string' || !h.trim()))) {
        add('invalid_field', 'content.replayHooks', 'content.replayHooks 必须是非空字符串数组（重玩钩子清单）');
      }
      if (c.unlocks !== undefined) {
        if (!Array.isArray(c.unlocks)) {
          add('invalid_field', 'content.unlocks', 'content.unlocks 必须是数组');
        } else {
          const seenUnlock = new Set();
          c.unlocks.forEach((u, i) => {
            const at = `content.unlocks[${i}]`;
            if (!isPlainObject(u)) {
              add('invalid_entry', at, `${at} 必须是对象`);
              return;
            }
            if (typeof u.id !== 'string' || !u.id.trim()) {
              add('missing_id', `${at}.id`, `${at} 缺少非空字符串 id（解锁项锚点）`);
            } else {
              if (!ID_PATTERN.test(u.id)) {
                add('naming', `${at}.id`, `id「${u.id}」不符合命名规范（小写字母/数字开头，仅小写字母、数字、中划线、下划线）`, 'warning');
              }
              if (seenUnlock.has(u.id)) add('duplicate_id', `${at}.id`, `content.unlocks 内 id「${u.id}」重复`);
              seenUnlock.add(u.id);
            }
          });
        }
      }
    }
  }

  // assets：资产治理（可选段；与平台侧 game-design-spec.ts 同口径）
  if (s.assets !== undefined) {
    if (!Array.isArray(s.assets)) {
      add('invalid_section', 'assets', 'spec.assets 必须是数组');
    } else {
      const seenAsset = new Set();
      s.assets.forEach((a, i) => {
        const at = `assets[${i}]`;
        if (!isPlainObject(a)) {
          add('invalid_entry', at, `${at} 必须是对象`);
          return;
        }
        if (typeof a.id !== 'string' || !a.id.trim()) {
          add('missing_id', `${at}.id`, `${at} 缺少非空字符串 id（资产锚点）`);
        } else {
          if (!ID_PATTERN.test(a.id)) {
            add('naming', `${at}.id`, `id「${a.id}」不符合命名规范（小写字母/数字开头，仅小写字母、数字、中划线、下划线）`, 'warning');
          }
          if (seenAsset.has(a.id)) add('duplicate_id', `${at}.id`, `assets 内 id「${a.id}」重复`);
          seenAsset.add(a.id);
        }
        if (typeof a.kind !== 'string' || !a.kind.trim()) add('invalid_field', `${at}.kind`, `${at}.kind 必须是非空字符串（资产品类：sfx/music/image/sprite/font/model…）`);
        if (typeof a.file !== 'string' || !a.file.trim()) add('invalid_path', `${at}.file`, `${at}.file 必须是非空字符串（资产落点，相对项目根）`);
        else if (!isSafeRelativePath(a.file)) add('unsafe_path', `${at}.file`, `${at}.file「${a.file}」必须是项目内相对路径（禁止绝对路径 / ..）`);
        if (typeof a.source !== 'string' || !a.source.trim()) add('invalid_field', `${at}.source`, `${at}.source 必须是非空字符串（generated/manual/licensed —— 资产溯源必填）`);
        if (a.license === undefined && a.source !== 'generated') {
          add('asset.license_missing', `${at}.license`, `${at} 非生成资产未写 license（外购/CC 素材必须记录许可）`, 'warning');
        }
      });
    }
  }
  return issues;
}

/**
 * 契约断言：spec 里声明的落点（脚本/场景/检查文件）与关卡元素编号必须在工程里真实存在
 * —— 这是「实现是否符合策划案」的核心，也是 D5 关卡编辑页元素编号的机器可判前提。
 */
export function checkContract(spec, projectRoot) {
  const results = [];
  const exists = (rel) => {
    if (!isSafeRelativePath(rel)) return false;
    return fs.existsSync(path.join(projectRoot, rel));
  };

  // 实体：脚本 / 场景落点存在
  for (const [i, e] of (spec.entities ?? []).entries()) {
    if (!isPlainObject(e)) continue;
    const label = `entities[${i}](${e.id ?? '无 id'})`;
    if (typeof e.script === 'string' && e.script) {
      results.push(exists(e.script)
        ? check('entity.script', 'pass', `${label} 脚本落点存在：${e.script}`, { file: e.script })
        : check('entity.script', 'fail', `${label} 声明的脚本落点不存在：${e.script}（spec 与实现不一致）`, { file: e.script }));
    }
    if (typeof e.scene === 'string' && e.scene) {
      results.push(exists(e.scene)
        ? check('entity.scene', 'pass', `${label} 场景落点存在：${e.scene}`, { file: e.scene })
        : check('entity.scene', 'fail', `${label} 声明的场景落点不存在：${e.scene}`, { file: e.scene }));
    }
  }

  // 关卡：场景落点存在 + 元素编号稳定唯一（关卡可视化编辑页的契约）
  for (const [i, l] of (spec.levels ?? []).entries()) {
    if (!isPlainObject(l)) continue;
    const label = `levels[${i}](${l.id ?? '无 id'})`;
    if (typeof l.scene === 'string' && l.scene) {
      results.push(exists(l.scene)
        ? check('level.scene', 'pass', `${label} 场景落点存在：${l.scene}`, { file: l.scene })
        : check('level.scene', 'fail', `${label} 声明的场景落点不存在：${l.scene}`, { file: l.scene }));
    }
    if (Array.isArray(l.elements)) {
      const seen = new Set();
      let bad = 0;
      for (const [j, el] of l.elements.entries()) {
        const id = isPlainObject(el) ? el.id : undefined;
        if (typeof id !== 'string' || !ID_PATTERN.test(id) || seen.has(id)) {
          bad += 1;
          results.push(check('level.element.id', 'fail', `${label} 元素 levels[${i}].elements[${j}] 缺少稳定的合法 id（编号规则：小写字母/数字开头，关卡内唯一）—— 编辑页无法给出精确落点`));
        } else {
          seen.add(id);
        }
      }
      if (bad === 0 && l.elements.length > 0) {
        results.push(check('level.element.id', 'pass', `${label} 的 ${l.elements.length} 个元素编号稳定且关卡内唯一（编号形如 ${l.id}/<element.id>）`));
      }
    }
  }

  // 验收项：statement 可核对 + 可执行检查文件存在
  for (const [i, a] of (spec.acceptance ?? []).entries()) {
    if (!isPlainObject(a)) continue;
    const label = `acceptance[${i}](${a.id ?? '无 id'})`;
    if (typeof a.check === 'string' && a.check) {
      results.push(exists(a.check)
        ? check('acceptance.check', 'pass', `${label} 可执行检查存在：${a.check}`, { file: a.check })
        : check('acceptance.check', 'fail', `${label} 声明的可执行检查不存在：${a.check}（验收项没有可跑的机器证据）`, { file: a.check }));
    }
  }

  // 耐玩度预算：声明的关卡数量下限 vs 实际声明的关卡数
  // （防「预算写 20 关、levels 只声明 2 关」；replayHooks/unlocks/sessionSeconds 是
  //   设计声明，供试玩量表与评审对照，不在此机判）
  if (isPlainObject(spec.content) && Number.isInteger(spec.content.levelCount)) {
    const declaredLevels = Array.isArray(spec.levels) ? spec.levels.length : 0;
    const budget = spec.content.levelCount;
    results.push(declaredLevels >= budget
      ? check('content.levelCount', 'pass', `耐玩度预算：关卡数量达标（levels 声明 ${declaredLevels} ≥ 预算下限 ${budget}）`)
      : check('content.levelCount', 'fail', `耐玩度预算不达标：levels 只声明了 ${declaredLevels} 关 < 预算下限 ${budget}（补齐 levels 或修订 spec 预算）`));
  }

  // G2 机制契约：声明的每个核心动词必须在工程里有可指认落点 —— 动词 id 或其 InputMap
  // 动作名（verb.input）出现在工程文本（scripts/ 场景/配表/ InputMap 注册）中。
  // 口径与实体落点一致：spec 声明了就必须能指认，「理论上会有」不算数。
  if (isPlainObject(spec.content) && Array.isArray(spec.content.verbs) && spec.content.verbs.length > 0) {
    // 工程文本快照：一次性收集（scripts/*.gd、*.tscn、*.godot、*.cfg、*.json，≤2MB/文件），
    // 语料 = 文件内容 + 相对路径（动词常体现在文件名上：scripts/move.gd ↔ verb move）
    const projectText = [];
    const collectText = (dir) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        if (ent.name.startsWith('.') || ent.name === 'addons') continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) collectText(p);
        else if (/\.(gd|tscn|godot|cfg|json)$/i.test(ent.name)) {
          const rel = path.relative(projectRoot, p).split(path.sep).join('/');
          projectText.push(rel);
          try {
            const st = fs.statSync(p);
            if (st.size <= 2 * 1024 * 1024) projectText.push(fs.readFileSync(p, 'utf-8'));
          } catch { /* 读不了就算没命中 */ }
        }
      }
    };
    collectText(projectRoot);
    const corpus = projectText.join('\n');
    for (const [i, v] of spec.content.verbs.entries()) {
      if (!isPlainObject(v) || typeof v.id !== 'string' || !v.id) continue;
      const label = `content.verbs[${i}](${v.id})`;
      const candidates = [v.id];
      if (typeof v.input === 'string' && v.input) candidates.push(v.input);
      const hit = candidates.find((needle) => corpus.includes(needle));
      results.push(hit !== undefined
        ? check('content.verb', 'pass', `${label} 机制动词有工程落点（文本命中「${hit}」）`)
        : check('content.verb', 'fail', `${label} 声明的动词在工程文本中无任何命中（id 与 input 都找不到 —— 动词没实现，或用了完全不同的命名；spec 与实现不一致）`));
    }
  }

  // 资产治理：声明的落点存在 + 被工程引用（存在 = 硬失败；引用缺失 = warning ——
  // 动态路径加载的资产会被误报，先不拦死）。生成器/许可的溯源在 schema 层校验。
  if (Array.isArray(spec.assets)) {
    // 引用扫描的文件集：真正承载资源引用的文本类型（与 preflight 的 res:// 扫描口径一致）
    const referenceCorpus = [];
    const collect = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '.godot' || entry.name === 'node_modules') continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) { collect(abs); continue; }
        if (/\.(gd|tscn|tres|import|json|md|cfg|godot)$/.test(entry.name)) {
          try { referenceCorpus.push(fs.readFileSync(abs, 'utf-8')); } catch (e) { /* 读不了就跳过 */ }
        }
      }
    };
    collect(projectRoot);
    const corpus = referenceCorpus.join('\n');
    for (const [i, a] of spec.assets.entries()) {
      if (!isPlainObject(a)) continue;
      const label = `assets[${i}](${a.id ?? '无 id'})`;
      if (typeof a.file === 'string' && a.file) {
        results.push(exists(a.file)
          ? check('asset.file', 'pass', `${label} 资产落点存在：${a.file}`, { file: a.file })
          : check('asset.file', 'fail', `${label} 声明的资产落点不存在：${a.file}（spec 与实现不一致；生成器没跑或路径写错）`, { file: a.file }));
        if (exists(a.file)) {
          const referenced = corpus.includes(`res://${a.file}`) || corpus.includes(a.file);
          results.push(referenced
            ? check('asset.referenced', 'pass', `${label} 资产被工程引用：${a.file}`)
            : check('asset.referenced', 'warning', `${label} 声明了资产 ${a.file} 但工程里没有引用（res:// 路径扫描未命中；动态路径加载可忽略）`));
        }
      }
    }
  }

  return results;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`[contract-check] ${e instanceof Error ? e.message : String(e)}`);
    console.error('用法：node contract-check.mjs [--spec <path>] [--project <dir>] [--json] [--strict]');
    process.exit(2);
  }
  if (args.help) {
    console.log('用法：node contract-check.mjs [--spec <path>] [--project <dir>] [--json] [--strict]');
    process.exit(0);
  }

  const projectRoot = path.resolve(args.project);
  if (!fs.existsSync(projectRoot)) {
    console.error(`[contract-check] 被测项目目录不存在：${projectRoot}`);
    process.exit(2);
  }

  let specBundle;
  try {
    specBundle = loadSpec(path.resolve(args.spec));
  } catch (e) {
    console.error(`[contract-check] ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }

  const specIssues = validateSpec(specBundle.spec);
  const contractResults = checkContract(specBundle.spec, projectRoot);

  const schemaErrors = specIssues.filter((i) => i.severity === 'error');
  const warnings = specIssues.filter((i) => i.severity === 'warning');
  const failed = contractResults.filter((r) => r.status === 'fail');

  const ok = schemaErrors.length === 0 && failed.length === 0 && (!args.strict || warnings.length === 0);

  const report = {
    ok,
    spec: {
      source: specBundle.source,
      title: specBundle.meta?.title ?? specBundle.spec?.meta?.title ?? null,
      schemaVersion: specBundle.meta?.schemaVersion ?? null,
      status: specBundle.meta?.status ?? null,
    },
    projectRoot,
    summary: {
      schemaErrors: schemaErrors.length,
      warnings: warnings.length,
      contractChecks: contractResults.length,
      contractFailures: failed.length,
    },
    schemaIssues: specIssues,
    contractChecks: contractResults,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[contract-check] spec=${report.spec.source}`);
    console.log(`[contract-check] schema 违规 ${schemaErrors.length} · warning ${warnings.length} · 契约断言 ${contractResults.length} 项（失败 ${failed.length}）`);
    for (const i of schemaErrors) console.log(`  ✗ [schema:${i.code}] ${i.path} — ${i.message}`);
    for (const w of warnings) console.log(`  ! [schema:${w.code}] ${w.path} — ${w.message}`);
    for (const r of contractResults) console.log(`  ${r.status === 'pass' ? '✓' : '✗'} [${r.id}] ${r.message}`);
    console.log(ok ? '[contract-check] PASS — 实现与 approved 版策划案一致' : '[contract-check] FAIL — 存在契约违约（先对齐策划案或补齐实现）');
  }

  process.exit(ok ? 0 : 1);
}

// jest 直接 import 本文件的导出做单测；CLI 只有在直接执行时才跑 main
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirectRun) main();
