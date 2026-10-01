---
name: style-card-library
description: "风格参考卡库：把「美术风格统一」从口头约定变成结构化卡片（调色板/线条/形状语言/纹理/禁忌），供美术生成提示词与风格统一检查引用。当任务是给游戏建风格规范、生成美术素材、或 QA 检查素材风格一致性时使用。"
---

# 风格参考卡库（style-card-library）

> 来源（mobius-design D9 / 需求 R9）：触乐《当 AI 开始重写小游戏生产流程》—— AI 帮不了的
> 4 件事之三：**美术风格统一**。每个素材单独写提示词必然跑偏；统一的前提是把风格显性化成
> 机器可引用的卡片 —— 生成时贴提示词，检查时逐卡对照。

## 1. 卡片形态（固定结构，一张卡 = 一个风格锚点）

```markdown
# style-card: <card-id>          ← 小写字母/数字/中划线，如 palette-night
- scope: <global|项目名>          ← 卡片作用域
- applies-to: <character|ui|tileset|sfx|…>   ← 适用品类
## 定义
- <维度>: <值>                    ← 见 §2 维度表，值要具体可判
## 生成提示词模板
<直接可粘贴的提示词，{subject} 为占位符>
## 反例（禁止）
- <明确禁止的样子，供检查引用>
```

## 2. 维度表（卡片里写哪些维度，按品类取用）

| 品类 | 必写维度 |
|---|---|
| palette（配色） | 主色/辅色/强调色（HEX）、饱和度倾向、明度范围 |
| character（角色） | 头身比、线条（粗细/描边有无）、形状语言（圆润/棱角）、比例参考 |
| ui（界面） | 圆角半径、描边、按钮三态表现、字体层级（标题/正文/数字） |
| tileset（场景块） | 像素密度（16/32/48px）、透视（俯视/侧视/等距）、接缝规则 |
| sfx / music | 乐器/波形、BPM 范围、混响量、响度基准 |

## 3. 使用协议

### 生成时（game-artist）

1. 先读项目已装的 style-card 文档（`GET /api/v1/knowledge/docs?scope=project&projectId=<pid>`，
   category=`style_card`）；没有 → 先建卡再画，禁止「先画后定风格」。
2. 素材生成提示词 = 卡片的「生成提示词模板」+ `{subject}`，**不得**在模板外自行添加风格词。
3. 一张素材只归属一张 applies-to 匹配的卡；跨品类素材（如 UI 图标）以更具体的卡为准。

### 检查时（QA / 人工验收）

1. 对照卡片「定义」逐维度核对素材（每个维度给出 pass/deviate 结论）；
2. 命中「反例」清单任一条 → reject，feedback 引用 card-id + 维度；
3. 结论格式：`style-check: pass | reject | partial（卡: 维度: 说明）`。

### 存储约定（零内核，复用知识库）

- 卡片 = `KnowledgeDoc`，`category: "style_card"`，`scope: project`（或 global），`tags: ["style-card", <card-id>, <applies-to>]`；
- 通过既有知识 API 创建/更新，不新增模型、不加字段 —— 卡库升级只改内容不改结构。

## 4. 种子卡（新建项目可先导入再改）

- `cards/palette-neutral-night.md` — 低饱和夜景配色
- `cards/character-chibi-2head.md` — 2 头身 Q 版角色
- `cards/ui-flat-rounded.md` — 扁平圆角 UI
