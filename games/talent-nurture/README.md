# 星光练习生：才艺养成物语（talent-nurture）

剧情式养成 Demo（Raising Sim + 互动视觉小说），按 approved 版策划案
`.myrd/spec/design-spec.json`（spec id `cmvm29gtn0011m9gb69e36p3j`）实现。
浏览器即玩，桌面鼠标与移动端触屏同等可玩，移动端竖屏优先。

## 玩法（10 秒上手）

- 12 周出道倒计时，每周 5 次行动：**唱功特训 / 舞蹈特训 / 休息 / 社交 / 彩排**。
- 周末舞台得分 = `唱功×0.5 + 舞技×0.35 + 心情×0.15`；<55 失败 / 55~69 及格 / 70~84 良好 / ≥85 完美；登台需体力 ≥25。
- 章节剧情事件（深夜加练 / 上台怯场 / 直播翻车 / 粉丝来信 / 公演前夜……18 个事件 × 2~3 分支）一次性改写数值，**选后即锁定**。
- 第 5-8 周迎击对手苏晴（对手分 50/62/70），第 10 周答谢祭粉丝 ×1.5，第 12 周出道公演定结局。
- 5 结局互斥且必居其一（判定优先级）：**双冠传奇 → 歌姬之路 → 舞灵之路 → 顺利出道 → 遗憾回校**；隐藏事件「巨星的深夜」（唱/舞达 S 级触发）。

## 目录语义（webgame-prototype 约定）

```
index.html            开发预览入口（静态服务器打开）
src/numeric.mjs       数值唯一来源（与 spec.numeric 一一对应）+ TUNING_META
src/entities/         idol / mentor-vocal(林澜) / mentor-dance(K哥) / rival(苏晴)
src/systems/          stat-growth / scheduler / event-engine / stage-score / ending-judge / rng
src/data/             events-placed(spec 落位) + events-conditional(条件/隐藏) + events 聚合 + endings
src/levels/           序章 + 5 章节脚本（事件排期 / 舞台配置）
src/scenes/           schedule-board / event-dialog / stage-live / ending-screen + ui 助手
src/main.mjs          显式状态机 title→intro→event→week→stage→judgement→ended
tests/contract/       8 条 spec 验收契约 + spec-shape 一致性（node 零依赖）
tools/build.mjs       零依赖构建：src → export/web + 生成 AppHost 落地页 landing.html
tools/smoke.mjs       浏览器冒烟（CDP 直连系统 Chrome，按部署形态伺服）
export/web/           部署产物（apphost.toml assets_dir 指向这里）
```

## 自检（提交前必跑）

```bash
node tests/run-all.mjs        # 37 项契约断言（8 条 spec 验收全覆盖）
node tools/build.mjs          # 出 export/web
node tools/smoke.mjs          # 真浏览器全链路：开屏→教程→事件连点幂等→12 周通关→结局→重开零残留→调参桥→console 零错误
```

最近一轮（2026-10-24）：`37 passed, 0 failed`；`SMOKE: PASS`（结局=歌姬之路，公演 75 分，舞台 8 场，console 零错误）。
冒烟曾抓出并修复 3 个真缺陷：序章周位错位（beginWeek 自增）、`h()` 把 `disabled:null` 渲染成禁用、周计划整体错位一周（公演丢失）。

## AppHost 壳契约（本仓库根）

- `apphost.toml`：name=talent-nurture / runtime=node20 / health=/health / assets_dir=games/talent-nurture/export/web
- `server/`：Node20 + Hono；`GET /` 伺服 landing.html（内联**移动端音频手势解锁器**与**调参桥**）；`GET /api/public/assets/:name{.+}` 走 asset-store（raw 文本直出 / gzip+b64 → text/plain）；`GET /health` 探针。
- 页面内引用一律相对路径（`api/public/assets/...`），经网关子路径 `/apps/talent-nurture` 访问不 404。
- 调参：`?tuning=<JSON>` 只认 TUNING_META 声明键并按 min/max 钳制（如 `?tuning={"gainBase":999}` 钳到 12）。
