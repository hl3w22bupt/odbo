# 线上冒烟取证记录（LIVE SMOKE）

- 时间：2026-10-24（最终一轮）
- 线上入口：https://leomac-studio.tail49399e.ts.net/apps/talent-nurture/
- 部署：deploymentId `cmvm59n7w002lm9gbaq0gprw9` @ commit `60c6d48`（本分支 myrd/talent-nurture-goal-cmvm1gjst0009m9gbzqvja0ji）
- 工具：`node tools/smoke-live.mjs`（零依赖 CDP 直连 Chrome，375×720 移动仿真视口，对公网网关入口实跑）

## 结论：LIVE SMOKE: PASS（console 零错误）

| 断言 | 结果 |
|---|---|
| /health 200（`{"ok":true,"app":"talent-nurture",...}`） | ✅ |
| / 壳页三标记（`__audioDebug` / `__GAME_TUNING__` 调参桥 / 相对路径资产） | ✅ |
| 资产通道 `api/public/assets/*`（main.mjs text/javascript、style.css text/css、嵌套 scenes/ui.mjs） | ✅ 200 |
| 开箱即玩：title → 开始 → 序章 → 教程三步 | ✅（vocal 10→19） |
| 分支事件连点 3 次只生效一次（AC③ 幂等，irreversible） | ✅ |
| 12 周全自动通关（真实 UI 点击路径） | ✅ 8 场舞台精确（试镜/内部考核/首秀/三对决/答谢祭/公演） |
| 结局判定 | ✅ 歌姬之路（vocal-specialist），公演 76 分，粉丝 1835 |
| 重开零残留（week=0 / vocal=10 / stamina=100 / fired=0） | ✅ |
| 调参桥（本地口径：gainBase 999 → 钳到 12） | ✅ |
| 窄屏 ≤375px 布局（截图 01/04） | ✅ 不破版，按钮热区完整 |

## 截帧清单（本目录）

1. `01-01-title-375w.png` 标题页（375w 竖屏）
2. `02-02-intro.png` 序章导师/对手开场
3. `03-03-event-choose.png` 分支事件选项页
4. `04-04-week-board-375w.png` 周日程面板（数值条/行动/日志）
5. `05-06-stage-result.png` 舞台结算
6. `06-05-event-midgame.png` 中盘剧情事件
7. `07-07-ending.png` 结局「歌姬之路」+ 结局画廊 + 重开

## 本轮修复轨迹（线上抓出 → 修复 → 重部 → 复验）

1. **网关无尾斜杠黑屏**：`/apps/talent-nurture` 不补尾斜杠，裸相对路径解析到 `/apps/api/*` → 404。landing 改 BASE_PATH 推导 + 动态注入（game-9 判例）。
2. **周计划错位一周**（本地冒烟抓出）：beginWeek 自增语义误用，公演丢失/试镜跑两遍。改为 `planForWeek(week+1)`，补逐周接线契约测试。
3. **渲染两处**（截帧抓出）：`append(null)` 字面量、数组子节点 `[object HTMLSpanElement]`。均修复并复验。

## 边界说明

- AC⑥ 真机专项：本记录为移动**仿真**视口（375×720，触屏事件语义同源），真机（iOS Safari/Android Chrome）实测留待「使用验收」节点或目标 owner 完成——壳已带音频手势解锁器与 `__audioDebug()` 取证出口。
- Godot 门禁（preflight/smoke/input-fuzz/playtest）不适用：本工程为纯 Web 静态产物（非 Godot），自检采用 spec 契约测试 + 真浏览器 CDP 冒烟 + 线上复核。
