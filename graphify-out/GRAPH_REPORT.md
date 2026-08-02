# Graph Report - /Users/leo/workspace/odbo  (2026-08-02)

## Corpus Check
- 105 files · ~56,455 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 808 nodes · 1875 edges · 67 communities (39 shown, 28 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.65)
- Token cost: 308,859 input · 0 output

## Community Hubs (Navigation)
- HTTP 路由与认证
- 服务端配置与启动
- HTTP 处理器与工具
- 服务端依赖清单
- 移动端依赖清单
- API 客户端方法
- 防沉迷与消费弹窗
- TypeScript 编译配置
- 应用图标资源
- 通知条与动画组件
- 通用弹层与徽章
- 支付供应商抽象
- 离线演示数据
- 应用根与合规门禁
- 角色定制与订单
- 登录与会话
- 导航与路由
- API 错误模型
- 包元数据字段
- 令牌与认证状态
- 头像与调色板
- 移动端产品规范
- 项目秘书与产物体系
- 开发启动脚本
- 服务端构建配置
- 合规与配额状态
- 好感度计算
- Expo TS 配置
- 图像生成供应商
- Android 前景图标
- Android 单色图标
- 配额徽章组件
- 数据库与 MCP 配置
- 平台数据模型与认证
- 网站图标品牌
- 应用图标品牌
- 启动图标品牌
- ESLint 配置
- 礼物弹层与模型
- 消息气泡与模型
- 原型大师 Agent
- HTML 原型生成规则
- Android 背景图标
- Tailwind+Lucide 风格
- Bug 缺陷产物
- 决策谱系记录
- 知识库产物
- 需求产物
- 技能产物
- 规范产物
- 工作流产物
- 项目规范
- Git 提交规范
- TS 编码规范
- 统一 API 响应格式
- Expo v57 文档
- 可观测性 Worker
- 队列 Worker
- 角色：阿秀
- 图像供应商抽象
- 支付网关抽象
- 短信供应商抽象
- 角色：苏雅
- 角色：小满

## God Nodes (most connected - your core abstractions)
1. `ok()` - 51 edges
2. `authenticate()` - 42 edges
3. `AppError` - 28 edges
4. `colors` - 26 edges
5. `ApiClient` - 25 edges
6. `audit()` - 24 edges
7. `fontSizes` - 21 edges
8. `compilerOptions` - 21 edges
9. `radii` - 18 edges
10. `fontWeights` - 18 edges

## Surprising Connections (you probably didn't know these)
- `React 组件规范` --conceptually_related_to--> `Mobile AGENTS.md (Expo 版本指引)`  [INFERRED]
  .myrd-platform/.claude/CLAUDE.md → apps/mobile/AGENTS.md
- `项目秘书-心伴 (Project Secretary Xinban) Agent` --semantically_similar_to--> `秘书 (Secretary) Agent`  [INFERRED] [semantically similar]
  .myrd-platform/.claude/agents/项目秘书-心伴.md → .myrd-platform/.claude/agents/秘书.md
- `七类产物分类体系 (心伴版)` --semantically_similar_to--> `七类产物分类体系`  [INFERRED] [semantically similar]
  .myrd-platform/.claude/agents/项目秘书-心伴.md → .myrd-platform/.claude/agents/秘书.md
- `iii engine 配置文件 config.yaml` --conceptually_related_to--> `III Engine (API 网关)`  [EXTRACTED]
  apps/server/config.yaml → .myrd-platform/.claude/skills/myrd-platform-skill.md
- `iii-sdk Worker 架构 (registerWorker/registerFunction/registerTrigger)` --references--> `III Engine (API 网关)`  [EXTRACTED]
  apps/server/README.md → .myrd-platform/.claude/skills/myrd-platform-skill.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **七类产物分类体系** — _myrd_platform_claude_agents_secretary_artifact_taxonomy, _myrd_platform_claude_agents_secretary_requirement_artifact, _myrd_platform_claude_agents_secretary_bug_artifact, _myrd_platform_claude_agents_secretary_standard_artifact, _myrd_platform_claude_agents_secretary_knowledge_artifact, _myrd_platform_claude_agents_secretary_skill_artifact, _myrd_platform_claude_agents_secretary_workflow_artifact, _myrd_platform_claude_agents_secretary_prototype_artifact [EXTRACTED 1.00]
- **心伴AI 四位人设角色体系** — apps_server_readme_xinban_ai, apps_server_readme_lin_wanqing, apps_server_readme_a_xiu, apps_server_readme_xiao_man, apps_server_readme_su_ya [INFERRED 0.85]
- **心伴AI 供应商抽象模式** — apps_server_readme_llm_abstraction, apps_server_readme_sms_abstraction, apps_server_readme_image_abstraction, apps_server_readme_payment_abstraction [INFERRED 0.85]
- **心伴 App Brand Icon Design** — apps_mobile_assets_android_icon_foreground, apps_mobile_assets_android_icon_foreground_heart_glyph, apps_mobile_assets_android_icon_foreground_adaptive_layer, apps_mobile_assets_android_icon_foreground_brand [INFERRED 0.85]
- **Heart Companion Adaptive Icon Brand Identity** — apps_mobile_assets_android_icon_monochrome, apps_mobile_assets_android_icon_monochrome_heart_glyph, apps_mobile_assets_android_icon_monochrome_adaptive_icon, apps_mobile_assets_android_icon_monochrome_heart_companion_app [INFERRED 0.85]
- **Heart Companion Brand Visual Identity** — apps_mobile_assets_favicon, heart_companion_heart_logo, heart_companion_mobile_app [INFERRED 0.85]
- **心伴AI Visual Brand Identity** — apps_mobile_assets_icon, apps_mobile_assets_icon_heart_symbol, apps_mobile_assets_icon_xinban_brand [INFERRED 0.85]
- **心伴 App Splash Screen Branding** — apps_mobile_assets_splash_icon, apps_mobile_assets_splash_icon_heart_mark, apps_mobile_assets_splash_icon_xinban_app [INFERRED 0.85]

## Communities (67 total, 28 thin omitted)

### Community 0 - "HTTP 路由与认证"
Cohesion: 0.08
Nodes (86): authenticate(), createRouter(), HttpRouteContext, HttpRouter, main(), getAffectionsForUser(), checkAntiAddiction(), audit() (+78 more)

### Community 1 - "服务端配置与启动"
Cohesion: 0.06
Nodes (48): AppConfig, config, prisma, AFFECTION_LEVEL_STEPS, AffectionInfo, changeAffection(), computeAffectionInfo(), getAffection() (+40 more)

### Community 2 - "HTTP 处理器与工具"
Cohesion: 0.07
Nodes (40): HttpHandler, optionalAuth(), RawHttpInput, AccessTokenPayload, AuthUser, extractBearerToken(), generateAccessToken(), generateRefreshToken() (+32 more)

### Community 3 - "服务端依赖清单"
Cohesion: 0.04
Nodes (46): author, dependencies, dotenv, iii-sdk, jose, openai, @prisma/adapter-better-sqlite3, @prisma/adapter-pg (+38 more)

### Community 4 - "移动端依赖清单"
Cohesion: 0.05
Nodes (39): dependencies, expo, expo-status-bar, react, react-native, @react-native-async-storage/async-storage, react-native-safe-area-context, devDependencies (+31 more)

### Community 5 - "API 客户端方法"
Cohesion: 0.08
Nodes (16): ApiClient, realApi, SendMessageParams, SendMultiMessageParams, mockApi, Affection, Character, ChatSendResult (+8 more)

### Community 6 - "防沉迷与消费弹窗"
Cohesion: 0.11
Nodes (23): AntiAddictionModal(), AntiAddictionModalProps, styles, AppModal(), CustomizeModal(), HAIRSTYLES, OUTFITS, styles (+15 more)

### Community 7 - "TypeScript 编译配置"
Cohesion: 0.07
Nodes (29): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib (+21 more)

### Community 8 - "应用图标资源"
Cohesion: 0.07
Nodes (28): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, expo (+20 more)

### Community 9 - "通知条与动画组件"
Cohesion: 0.12
Nodes (20): AINoticeBar(), AINoticeBarProps, styles, BreathingDot(), styles, GiftFloatLayer(), GiftFloatLayerProps, Particle (+12 more)

### Community 10 - "通用弹层与徽章"
Cohesion: 0.13
Nodes (19): AppModalProps, styles, CrownBadge(), styles, Sheet(), SheetProps, styles, CharacterSelectScreenProps (+11 more)

### Community 11 - "支付供应商抽象"
Cohesion: 0.11
Nodes (13): AlipayPaymentProvider, CallbackVerifyResult, header(), MockPaymentProvider, PaymentProvider, PayOrder, PayRequest, PayResult (+5 more)

### Community 12 - "离线演示数据"
Cohesion: 0.12
Nodes (16): affectionValues, BASE_CHARACTERS, BASE_GIFTS, BASE_PLANS, BASE_PRODUCTS, buildCharacters(), conversations, convMeta (+8 more)

### Community 13 - "应用根与合规门禁"
Cohesion: 0.22
Nodes (15): App(), ComplianceOverlay(), RootGate(), SegmentedToggle(), SegmentedToggleProps, styles, useNavigation(), CharacterSelectScreen() (+7 more)

### Community 14 - "角色定制与订单"
Cohesion: 0.11
Nodes (16): CustomizeModalProps, AntiAddictionStatus, CharacterTier, CharacterType, CustomizationPayload, CustomizationResult, Dialect, MembershipPlanBenefit (+8 more)

### Community 15 - "登录与会话"
Cohesion: 0.22
Nodes (14): api, LoginScreen(), styles, SessionContext, SessionProvider(), avatarLetter(), centsToYuan(), clockTime() (+6 more)

### Community 16 - "导航与路由"
Cohesion: 0.18
Nodes (16): buildRoute(), HOME_ROUTE, NavAction, NavigationContext, NavigationContextValue, NavigationProvider(), NavState, nextKey() (+8 more)

### Community 17 - "API 错误模型"
Cohesion: 0.12
Nodes (9): ApiError, DEFAULT_BASE_URL, Envelope, ErrorCode, getAccessToken(), isMockMode(), request(), RequestOptions (+1 more)

### Community 18 - "包元数据字段"
Cohesion: 0.12
Nodes (16): author, bugs, url, description, homepage, keywords, license, main (+8 more)

### Community 19 - "令牌与认证状态"
Cohesion: 0.31
Nodes (11): setAccessToken(), setOnUnauthorized(), setRefreshToken(), AuthContext, AuthContextValue, AuthProvider(), clearSession(), loadSession() (+3 more)

### Community 20 - "头像与调色板"
Cohesion: 0.22
Nodes (10): Avatar(), AvatarProps, colorForName(), PALETTE, styles, MessageBubble(), styles, styles (+2 more)

### Community 21 - "移动端产品规范"
Cohesion: 0.17
Nodes (12): React 组件规范, Mobile AGENTS.md (Expo 版本指引), Mobile CLAUDE.md, 好感度系统 (affection.progress), 合规机制 (AI 提示条/防沉迷/理性消费/内容过滤), 礼物系统, JWT 访问令牌 + 刷新令牌轮换, 林晚晴 (温婉知己) (+4 more)

### Community 22 - "项目秘书与产物体系"
Cohesion: 0.18
Nodes (11): 项目秘书-心伴 (Project Secretary Xinban) Agent, 七类产物分类体系 (心伴版), 秘书 (Secretary) Agent, 七类产物分类体系, 工作流 DAG 格式 (dagjson), MyRD Platform Skill 平台使用说明, III Engine (API 网关), iii engine 配置文件 config.yaml (+3 more)

### Community 23 - "开发启动脚本"
Cohesion: 0.36
Nodes (9): children, __dirname, isPortOpen(), log(), main(), match, root, shutdown() (+1 more)

### Community 24 - "服务端构建配置"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, exclude, extends, dist, node_modules, src/**/*.test.ts, src/generated/prisma/internal/** (+1 more)

### Community 25 - "合规与配额状态"
Cohesion: 0.33
Nodes (4): SessionContextValue, ComplianceStatus, QuotaStatus, UserStatus

### Community 26 - "好感度计算"
Cohesion: 0.67
Nodes (4): AFFECTION_LEVEL_STEPS, applyAffectionDelta(), computeAffection(), formatAffectionValue()

### Community 27 - "Expo TS 配置"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 29 - "Android 前景图标"
Cohesion: 0.83
Nodes (4): Android Icon Foreground Asset (心伴), Android Adaptive Icon Foreground Layer, 心伴 (Heart Companion) Brand, Heart Companion Heart Glyph

### Community 30 - "Android 单色图标"
Cohesion: 0.67
Nodes (4): Android Icon Monochrome Asset, Android Adaptive Icon Pattern, 心伴 (Heart Companion) App, Heart Glyph Brand Mark

### Community 31 - "配额徽章组件"
Cohesion: 0.50
Nodes (3): QuotaPill(), QuotaPillProps, styles

### Community 32 - "数据库与 MCP 配置"
Cohesion: 0.50
Nodes (3): DATABASE_URL, npx, myrd-knowledge

### Community 33 - "平台数据模型与认证"
Cohesion: 0.67
Nodes (3): 关键数据模型 (User/Project/Bug/Requirement/Channel/Workflow/Skill), JWT 认证, 双维度角色权限体系 (系统/项目内)

### Community 34 - "网站图标品牌"
Cohesion: 1.00
Nodes (3): 心伴 (Heart Companion) App Favicon, Blue Heart Logo Motif, 心伴 (Heart Companion) Mobile App

### Community 35 - "应用图标品牌"
Cohesion: 1.00
Nodes (3): App Icon (icon.png), Heart Symbol, 心伴AI (Xinban AI) Brand

### Community 36 - "启动图标品牌"
Cohesion: 1.00
Nodes (3): Splash Icon (Heart Symbol), Heart Mark Symbol, 心伴 Heart Companion App

## Knowledge Gaps
- **282 isolated node(s):** `npx`, `DATABASE_URL`, `name`, `slug`, `scheme` (+277 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `HTTP 路由与认证` to `HTTP 处理器与工具`, `支付供应商抽象`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `ok()` connect `HTTP 路由与认证` to `服务端配置与启动`, `HTTP 处理器与工具`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `ApiError` connect `API 错误模型` to `通知条与动画组件`, `离线演示数据`, `API 客户端方法`, `防沉迷与消费弹窗`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `npx`, `DATABASE_URL`, `name` to the rest of the system?**
  _282 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `HTTP 路由与认证` be split into smaller, more focused modules?**
  _Cohesion score 0.07572977481234362 - nodes in this community are weakly interconnected._
- **Should `服务端配置与启动` be split into smaller, more focused modules?**
  _Cohesion score 0.060882800608828 - nodes in this community are weakly interconnected._
- **Should `HTTP 处理器与工具` be split into smaller, more focused modules?**
  _Cohesion score 0.07111756168359942 - nodes in this community are weakly interconnected._