# 终局使用验收报告：分支事件幕布过场可见性 · 独立帧采样取证（第 6 轮链收口）

- 日期：2026-10-25
- 验收对象：线上 liveUrl `https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/`
- 取证工具：`tools/curtain-burst-r6.mjs`（自研连发截帧驱动：375×720 @2x 移动仿真、`Input.dispatchTouchEvent` 真实触摸管线、逐帧幕布覆盖率探针；判定阈值独立于 smoke 门禁）
- 证据目录：`qa/acceptance/curtain-final-r6/`（run-01 / run-02 各 34 帧连发 + `burst.json` 逐帧 sha256/覆盖率/页内单调时钟 + `summary.json`）

## 任务四项判定（机器可判项）

### ① 触发分支事件，帧采样取证幕布真实可见 —— **PASS**

真实触摸管线点击「开始第一周」触发分支事件（室友初见，含两个分支选项），连发截帧逐帧探针：

| run | 含幕布帧 | 互异 sha | 视觉存活跨度 | 覆盖率序列（合幕→开幕） | console |
|---|---|---|---|---|---|
| run-01 | 5 | 5 | **277ms** | 0.975 → 0.853 → 0.687 → 0.432 → 0.193 | 0 error |
| run-02 | 5 | 5 | **323ms** | 0.997 → 0.853 → 0.64 → 0.374 → 0.063 | 0 error |

- **肉眼可感知**：目检帧序列实证——`006-frame.png` 两片暗幕全遮视口（中缝可见）→ `008-frame.png` 幕布中开、中央露出事件对白与选项按钮 → `010-frame.png` 幕布将尽（两侧细条）→ `011-frame.png` 干净事件布局（对照帧，证明侧带确为幕布而非布局）。
- **存活 ≥200ms**：两次独立运行 277ms / 323ms，均 ≥200ms 任务阈值。
- **非同帧闪没**：每 run 5 张互异 sha256 幕布帧、覆盖率单调递减（开幕运动连续），旧缺陷形态（挂载 0.1ms 同帧清除）不可能产生该帧型。
- **交叉口径**：smoke 门禁仪器口径（MutationObserver + rAF）测得 17 次事件挂载存活 526–532ms；本帧采样视觉跨度较短系采样节奏（~70–80ms/帧）与「覆盖率>2%」截断所致，两口径方向一致、无矛盾。
- 采样方法学备注：首轮 burst 曾因「事件相位稳定即提前收束」把幕布尾巴截掉（166ms 低估），已修正为固定 34 帧全窗采样后重测——该偏差属取证脚本缺陷，非产品缺陷（承 SOP §8 判例口径）。

### ② qa/mobile/report.json 含「幕布存活可见」断言且 verdict=PASS —— **PASS（附瑕疵记录）**

- `verdict=PASS`，10/10 checks 全过（HEAD `d1ea496` 树内版本，generatedAt 2026-10-25T04:18:15Z，target=线上 liveUrl，375×720）。
- `checks[id=curtain]` PASS，量化证据完整：17 次事件幕布挂载、存活 526–532ms（阈值≥300ms，旧缺陷 0.1ms）、挂载点全 body、pointer-events=none 全视口 375×720、首帧后仍存活。
- 6 张截图 sha256 与磁盘逐一吻合（147964f3…/6f6894c6…/619dbf6e…/2103de51…/5cac8665…/82ee816e…），全部 NON-BLANK、750×1440。
- **瑕疵（如实记录，不粉饰）**：`screenshots`/`screenshotDigests` 均未登记幕布专项截图，curtain 断言中的「+90ms 实拍在挂=true」是页内探针布尔值而非落盘截图。复核发现 `03-event-choose.png` 实拍恰好是幕布中开态（两侧暗带覆盖率≈25%，与本报告 run-02 `009/010-frame.png` 同形态、与 `011-frame.png` 干净布局可区分），即报告截图集**事实上含幕布中间态但未标注**。本验收的专项帧序列补齐了该缺口。

### ③ 线上版本指纹 == talent-nurture 分支 HEAD —— **PASS（内容级，含如实口径说明）**

- `/health` → `version=v2-curtain-fix-1`、`ok=true`；落地页 build 戳 `0f282c7`（meta `build-version` / `__BUILD_VERSION` / `#build-badge` 三处命中）。
- **线上 31 个资产与 HEAD（`d1ea496`）`export/web/` 逐字节一致（31/31 sha256 吻合，0 不一致）**，取数路径 `api/public/assets/<file>`（注意：直连 `assets/` 前缀会 404——网关资产通道以页面 `BASE_PATH` 推导为准，误拿 404 响应体算哈希会得出假漂移结论）。
- `0f282c7..HEAD` 变更仅：qa 证据文件、`server/src/index.ts` 1 行（平台服务端，不属游戏产物）、landing 版本戳（即线上 bundle 内含版本）——**游戏源码零变更**；幕布修复 `beb9e7b` ∈ HEAD 祖先链。
- 口径说明：commit 级上线上 build 戳（`0f282c7`）是 HEAD 的祖先而非 HEAD 本身（HEAD 领先 3 个纯证据/收口提交），故严格结论为「**内容级线上==HEAD**（31/31 资产哈希 + 源码零变更），非 commit 号字面相等」。
- 方法记录：平台 hosted-apps API 端点 404（部署记录无法从平台侧独立取证），故以线上直测（/health + 资产哈希）替代，证据强度更高。

### ④ 完整证据链汇总与回写 —— 见 goal artifacts（本次回写）

六项验收（062d30d，含 V1 缺陷发现）→ 移动端门禁（c835113 / 0f282c7，PASS 10/10 含 curtain 断言）→ 视觉升级（183a2f9 实现 / 721babf 部署）→ V1 幕布修复（beb9e7b 修复 + 断言）→ 部署收口（4850768 / 9ed78b4，v2-curtain-fix-1）→ 线上取证（d1ea496）→ **本轮终局独立帧采样（本提交）**。各环节均有 commit 与证据文件可溯。

## 结论

机器可判项 **①②③ 全部 PASS**，无退回项。主观体验（好玩/画面审美/四问量表）不在机器取证范围，**待用户试玩回填**——试玩入口：liveUrl（手机浏览器或桌面 DevTools 移动仿真打开，点「开始」即可体验事件幕布过场）。

## 复跑

```bash
node games/talent-nurture/tools/curtain-burst-r6.mjs   # 对默认 liveUrl 连发截帧 2 轮
node games/talent-nurture/tools/smoke-mobile.mjs        # 10 项门禁（含 curtain 断言）
node games/talent-nurture/tools/annotate-report.mjs     # 复跑后重放元数据
```
