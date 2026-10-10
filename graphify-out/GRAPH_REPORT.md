# Graph Report - .  (2026-10-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1721 nodes · 3256 edges · 142 communities (112 shown, 30 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 87 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c63cd3b4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ok
- chatEngine.ts
- routes/auth.ts
- emotion.ts
- properties
- scripts
- theme/index.ts
- compilerOptions
- expo
- ChatScreen.tsx
- CharacterSelectScreen.tsx
- payment.ts
- properties
- App.tsx
- MoodTimelinePanel.tsx
- lib/auth.ts
- NavigationContext.tsx
- src/index.ts
- http.ts
- AuthContext.tsx
- MessageBubble.tsx
- 心伴AI (AI 情感陪伴 App)
- 秘书 (Secretary) Agent
- main.js
- exclude
- ComplianceStatus
- utils/affection.ts
- mobile/tsconfig.json
- SeedreamProvider
- Android Icon Foreground Asset (心伴)
- Android Icon Monochrome Asset
- conversationInsights.ts
- mobile-web-smoke.mjs
- 双维度角色权限体系 (系统/项目内)
- 心伴 (Heart Companion) App Favicon
- App Icon (icon.png)
- Splash Icon (Heart Symbol)
- eslint.config.js
- Gift
- ApiClient
- 原型大师 (Prototype Master) Agent
- 聊天内输出完整 HTML 规则（禁止落盘）
- Android Adaptive Icon Background (心伴)
- Tailwind CSS + Lucide 设计风格
- Bug 缺陷产物
- 决策谱系 DecisionRecord (decisionChanged/decisionWhy)
- Knowledge 知识库产物
- Requirement 需求产物
- Skill 技能产物
- Standard 规范产物
- Workflow 工作流产物
- 项目规范 (Project Standards)
- Git 提交规范
- TypeScript 编码规范
- 统一 API 响应格式
- Expo v57 版本化文档
- iii-observability Worker
- queue Worker (builtin adapter)
- properties
- 阿秀 (爽朗直爽)
- 图像供应商抽象 (豆包 Seedream)
- 支付网关抽象 (微信/支付宝)
- 短信供应商抽象 (SMS)
- 苏雅 (成熟通透)
- 小满 (俏皮灵动)
- package.json
- client.ts
- preflight.py
- numeric.js
- selftest.mjs
- routes/characters.ts
- triggeredBy
- verdict
- kernel-determinism.spec.mjs
- properties
- gate-selftest.sh
- validate-report.mjs
- properties
- properties
- MemoryReadResult
- dependencies
- verification-report.schema.json
- required
- scripts
- minimal-3d/package.json
- lark.mjs
- browser-smoke.mjs
- properties
- enum
- persistence-v02.sh
- scene.js
- required
- required
- persistence-regression.sh
- build.mjs
- properties
- enum
- devDependencies
- server/package.json
- dev.mjs
- mobile_smoke_selftest.mjs
- preflight.mjs
- SmsProvider
- id
- types/index.ts
- OpenAICompatProvider
- verify-reproducible.mjs
- required
- prMapping
- mock.ts
- run-all.mjs
- singlefile.contract.mjs
- render-report-md.mjs
- api-test.sh
- deploy-v02.sh
- myrd-knowledge
- input-fuzz.sh
- playtest.sh
- run_case
- dev-down.sh
- dev-up.sh
- godot-game-dev/scripts/smoke.sh
- chat.ts
- ref
- lib/moodCorrections.ts
- resolve-godot.sh
- moodInsight.ts
- api/index.ts
- definitions
- required
- exportData.ts
- scripts/smoke.sh
- adjudications
- evidence
- originTarget
- criteriaHash
- reportId
- MoodInsightSummaryResult
- durationMs

## God Nodes (most connected - your core abstractions)
1. `ok()` - 47 edges
2. `authenticate()` - 33 edges
3. `colors` - 30 edges
4. `AppError` - 30 edges
5. `ApiClient` - 29 edges
6. `fontSizes` - 25 edges
7. `audit()` - 24 edges
8. `radii` - 22 edges
9. `registerChatRoutes()` - 22 edges
10. `compilerOptions` - 21 edges

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
- 2-file cycle: `apps/server/src/lib/conversationInsights.ts -> apps/server/src/lib/moodCorrections.ts -> apps/server/src/lib/conversationInsights.ts`

## Hyperedges (group relationships)
- **七类产物分类体系** — _myrd_platform_claude_agents_secretary_artifact_taxonomy, _myrd_platform_claude_agents_secretary_requirement_artifact, _myrd_platform_claude_agents_secretary_bug_artifact, _myrd_platform_claude_agents_secretary_standard_artifact, _myrd_platform_claude_agents_secretary_knowledge_artifact, _myrd_platform_claude_agents_secretary_skill_artifact, _myrd_platform_claude_agents_secretary_workflow_artifact, _myrd_platform_claude_agents_secretary_prototype_artifact [EXTRACTED 1.00]
- **心伴AI 四位人设角色体系** — apps_server_readme_xinban_ai, apps_server_readme_lin_wanqing, apps_server_readme_a_xiu, apps_server_readme_xiao_man, apps_server_readme_su_ya [INFERRED 0.85]
- **心伴AI 供应商抽象模式** — apps_server_readme_llm_abstraction, apps_server_readme_sms_abstraction, apps_server_readme_image_abstraction, apps_server_readme_payment_abstraction [INFERRED 0.85]
- **心伴 App Brand Icon Design** — apps_mobile_assets_android_icon_foreground, apps_mobile_assets_android_icon_foreground_heart_glyph, apps_mobile_assets_android_icon_foreground_adaptive_layer, apps_mobile_assets_android_icon_foreground_brand [INFERRED 0.85]
- **Heart Companion Adaptive Icon Brand Identity** — apps_mobile_assets_android_icon_monochrome, apps_mobile_assets_android_icon_monochrome_heart_glyph, apps_mobile_assets_android_icon_monochrome_adaptive_icon, apps_mobile_assets_android_icon_monochrome_heart_companion_app [INFERRED 0.85]
- **Heart Companion Brand Visual Identity** — apps_mobile_assets_favicon, heart_companion_heart_logo, heart_companion_mobile_app [INFERRED 0.85]
- **心伴AI Visual Brand Identity** — apps_mobile_assets_icon, apps_mobile_assets_icon_heart_symbol, apps_mobile_assets_icon_xinban_brand [INFERRED 0.85]
- **心伴 App Splash Screen Branding** — apps_mobile_assets_splash_icon, apps_mobile_assets_splash_icon_heart_mark, apps_mobile_assets_splash_icon_xinban_app [INFERRED 0.85]

## Communities (142 total, 30 thin omitted)

### Community 0 - "ok"
Cohesion: 0.17
Nodes (37): authenticate(), audit(), requireRole(), invalidateSensitiveCache(), getPaymentProvider(), ok(), addSensitiveWord(), adminGuard() (+29 more)

### Community 1 - "chatEngine.ts"
Cohesion: 0.11
Nodes (25): AuditAction, AuditOptions, contentAudit(), buildMultiSystemPrompt(), buildSystemPrompt(), CHARACTER_SEEDS, CharacterSeed, DEFAULT_REPLIES (+17 more)

### Community 2 - "routes/auth.ts"
Cohesion: 0.15
Nodes (14): AppError, ErrorCode, assertValidPhone(), generateCode(), getSmsProvider(), isDevFallbackCode(), TODO: 接入阿里云 dysmsapi 签名鉴权（RPC 风格）, TODO: 接入腾讯云 sms TC3-HMAC-SHA256 签名 (+6 more)

### Community 3 - "emotion.ts"
Cohesion: 0.18
Nodes (20): classifyEmotion(), createEmotion(), DEFAULT_EMOTION, deleteEmotion(), EMOTION_STATES, EmotionInput, EmotionRecord, EmotionState (+12 more)

### Community 4 - "properties"
Cohesion: 0.09
Nodes (22): type, minimum, type, minimum, type, minimum, type, breakdown (+14 more)

### Community 5 - "scripts"
Cohesion: 0.05
Nodes (43): dependencies, expo, expo-status-bar, react, react-dom, react-native, @react-native-async-storage/async-storage, react-native-safe-area-context (+35 more)

### Community 6 - "theme/index.ts"
Cohesion: 0.08
Nodes (33): AINoticeBar(), AINoticeBarProps, styles, GiftFloatLayerProps, Particle, styles, GiftSheet(), styles (+25 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (29): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib (+21 more)

### Community 8 - "expo"
Cohesion: 0.07
Nodes (28): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, expo (+20 more)

### Community 9 - "ChatScreen.tsx"
Cohesion: 0.13
Nodes (24): BreathingDot(), styles, GiftFloatLayer(), MOOD_OPTIONS, MoodCorrectionModal(), MoodCorrectionModalProps, styles, NavAction (+16 more)

### Community 10 - "CharacterSelectScreen.tsx"
Cohesion: 0.10
Nodes (23): AntiAddictionModal(), AntiAddictionModalProps, styles, AppModal(), AppModalProps, styles, CrownBadge(), styles (+15 more)

### Community 11 - "payment.ts"
Cohesion: 0.11
Nodes (13): AlipayPaymentProvider, CallbackVerifyResult, header(), MockPaymentProvider, PaymentProvider, PayOrder, PayRequest, PayResult (+5 more)

### Community 12 - "properties"
Cohesion: 0.11
Nodes (18): $ref, $ref, properties, createdAt, prMapping, redTeam, schemaVersion, scoring (+10 more)

### Community 13 - "App.tsx"
Cohesion: 0.11
Nodes (32): App(), ComplianceOverlay(), RootGate(), api, HeartbeatBar(), SegmentedToggle(), useNavigation(), CharacterSelectScreen() (+24 more)

### Community 14 - "MoodTimelinePanel.tsx"
Cohesion: 0.17
Nodes (15): MemoryPanel(), styles, MoodInsightPanel(), styles, TREND_LABEL, MOOD_META, MoodTimelinePanel(), MoodTimelinePanelProps (+7 more)

### Community 15 - "lib/auth.ts"
Cohesion: 0.13
Nodes (20): AccessTokenPayload, AuthUser, extractBearerToken(), generateAccessToken(), generateRefreshToken(), issueTokens(), RefreshTokenPayload, refreshTokens() (+12 more)

### Community 16 - "NavigationContext.tsx"
Cohesion: 0.24
Nodes (11): buildRoute(), HOME_ROUTE, NavAction, NavigationContext, NavigationContextValue, NavigationProvider(), NavState, nextKey() (+3 more)

### Community 17 - "src/index.ts"
Cohesion: 0.12
Nodes (26): AppConfig, config, prisma, createRouter(), main(), AntiAddictionResult, checkAntiAddiction(), ChatMessage (+18 more)

### Community 18 - "http.ts"
Cohesion: 0.10
Nodes (23): decodeSegment(), HttpHandler, HttpRouteContext, matchPath(), RawHttpInput, RegisteredRoute, ApiEnvelope, clientIp() (+15 more)

### Community 19 - "AuthContext.tsx"
Cohesion: 0.31
Nodes (11): setAccessToken(), setOnUnauthorized(), setRefreshToken(), AuthContext, AuthContextValue, AuthProvider(), clearSession(), loadSession() (+3 more)

### Community 20 - "MessageBubble.tsx"
Cohesion: 0.20
Nodes (11): Avatar(), AvatarProps, colorForName(), PALETTE, styles, MessageBubble(), styles, styles (+3 more)

### Community 21 - "心伴AI (AI 情感陪伴 App)"
Cohesion: 0.17
Nodes (12): React 组件规范, Mobile AGENTS.md (Expo 版本指引), Mobile CLAUDE.md, 好感度系统 (affection.progress), 合规机制 (AI 提示条/防沉迷/理性消费/内容过滤), 礼物系统, JWT 访问令牌 + 刷新令牌轮换, 林晚晴 (温婉知己) (+4 more)

### Community 22 - "秘书 (Secretary) Agent"
Cohesion: 0.18
Nodes (11): 项目秘书-心伴 (Project Secretary Xinban) Agent, 七类产物分类体系 (心伴版), 秘书 (Secretary) Agent, 七类产物分类体系, 工作流 DAG 格式 (dagjson), MyRD Platform Skill 平台使用说明, III Engine (API 网关), iii engine 配置文件 config.yaml (+3 more)

### Community 23 - "main.js"
Cohesion: 0.09
Nodes (24): camera, canvas, composer, frame(), game, gemMeshes, handleEvents(), hud (+16 more)

### Community 24 - "exclude"
Cohesion: 0.20
Nodes (9): compilerOptions, noEmit, exclude, extends, dist, node_modules, src/**/*.test.ts, src/generated/prisma/internal/** (+1 more)

### Community 25 - "ComplianceStatus"
Cohesion: 0.33
Nodes (4): SessionContextValue, ComplianceStatus, QuotaStatus, UserStatus

### Community 26 - "utils/affection.ts"
Cohesion: 0.67
Nodes (4): AFFECTION_LEVEL_STEPS, applyAffectionDelta(), computeAffection(), formatAffectionValue()

### Community 27 - "mobile/tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 29 - "Android Icon Foreground Asset (心伴)"
Cohesion: 0.83
Nodes (4): Android Icon Foreground Asset (心伴), Android Adaptive Icon Foreground Layer, 心伴 (Heart Companion) Brand, Heart Companion Heart Glyph

### Community 30 - "Android Icon Monochrome Asset"
Cohesion: 0.67
Nodes (4): Android Icon Monochrome Asset, Android Adaptive Icon Pattern, 心伴 (Heart Companion) App, Heart Glyph Brand Mark

### Community 31 - "conversationInsights.ts"
Cohesion: 0.15
Nodes (24): classifyMood(), ConversationMemoryContract, extractMemoryContent(), memoryReadDegraded(), memoryReadEmpty(), MemoryWriteResult, MoodSnapshotContract, moodTimelineDegraded() (+16 more)

### Community 32 - "mobile-web-smoke.mjs"
Cohesion: 0.08
Nodes (23): args, CANDIDATES, check(), chrome, connectCdp(), consoleErrors, cp, CRITICAL_EXT (+15 more)

### Community 33 - "双维度角色权限体系 (系统/项目内)"
Cohesion: 0.67
Nodes (3): 关键数据模型 (User/Project/Bug/Requirement/Channel/Workflow/Skill), JWT 认证, 双维度角色权限体系 (系统/项目内)

### Community 34 - "心伴 (Heart Companion) App Favicon"
Cohesion: 1.00
Nodes (3): 心伴 (Heart Companion) App Favicon, Blue Heart Logo Motif, 心伴 (Heart Companion) Mobile App

### Community 35 - "App Icon (icon.png)"
Cohesion: 1.00
Nodes (3): App Icon (icon.png), Heart Symbol, 心伴AI (Xinban AI) Brand

### Community 36 - "Splash Icon (Heart Symbol)"
Cohesion: 1.00
Nodes (3): Splash Icon (Heart Symbol), Heart Mark Symbol, 心伴 Heart Companion App

### Community 39 - "ApiClient"
Cohesion: 0.10
Nodes (8): ApiClient, MessageBubbleProps, Conversation, LoginResult, MembershipInfo, Message, Order, Product

### Community 59 - "properties"
Cohesion: 0.12
Nodes (22): items, items, type, items, type, additionalProperties, pattern, properties (+14 more)

### Community 67 - "package.json"
Cohesion: 0.08
Nodes (24): author, bugs, url, description, homepage, keywords, license, name (+16 more)

### Community 68 - "client.ts"
Cohesion: 0.12
Nodes (9): ApiError, DEFAULT_BASE_URL, Envelope, ErrorCode, getAccessToken(), isMockMode(), request(), RequestOptions (+1 more)

### Community 69 - "preflight.py"
Cohesion: 0.16
Nodes (22): fail(), main(), parse_attrs(), parse_project_godot(), Path, 解析 .tscn 方括号头里的 key=value 属性（键序无关）。, 收集 `[kind ...]` 头 → [(属性字典, 头原文), …]。, 收集 `[kind …]` 段 → [(属性字典, 段全文), …]。 必须用「段」而不是「行」：节点的 `script =… (+14 more)

### Community 70 - "numeric.js"
Cohesion: 0.17
Nodes (17): EMPTY_INTENT, TRANSITIONS, createRng(), createWorld(), finiteOr(), pushOutOfCircle(), stepWorld(), gemLayout() (+9 more)

### Community 71 - "selftest.mjs"
Cohesion: 0.14
Nodes (14): commitTexts(), extractIds(), main(), parseBranch(), parseMarkers(), resolvePrMapping(), EXAMPLES, failed (+6 more)

### Community 72 - "routes/characters.ts"
Cohesion: 0.13
Nodes (28): HttpRouter, LocalHttpRouter, AFFECTION_LEVEL_STEPS, AffectionInfo, changeAffection(), computeAffectionInfo(), getAffection(), getAffectionsForUser() (+20 more)

### Community 73 - "triggeredBy"
Cohesion: 0.11
Nodes (18): description, type, $ref, triggeredBy, actor, at, scenario, enum (+10 more)

### Community 74 - "verdict"
Cohesion: 0.11
Nodes (18): verdict, reasons, summary, value, minItems, type, description, type (+10 more)

### Community 75 - "kernel-determinism.spec.mjs"
Cohesion: 0.15
Nodes (12): greedyIntent(), createGame(), ROUND_SECONDS, SEED_DEFAULT, a, b, failures, g (+4 more)

### Community 76 - "properties"
Cohesion: 0.13
Nodes (16): items, type, minLength, enum, description, type, properties, goals (+8 more)

### Community 77 - "gate-selftest.sh"
Cohesion: 0.20
Nodes (6): run_case(), run_game_case(), run_project_case(), say_fail(), say_pass(), gate-selftest.sh script

### Community 78 - "validate-report.mjs"
Cohesion: 0.22
Nodes (12): checkEvidenceChain(), deepEqual(), DEFAULT_SCHEMA, isDateTime(), main(), readReport(), recomputeScoringAndVerdict(), SCRIPT_DIR (+4 more)

### Community 79 - "properties"
Cohesion: 0.12
Nodes (17): properties, $ref, pattern, type, description, type, checkedAt, criterionId (+9 more)

### Community 80 - "properties"
Cohesion: 0.12
Nodes (16): $ref, properties, maxLength, type, $ref, digest, excerpt, fetchedAt (+8 more)

### Community 82 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, dotenv, iii-sdk, jose, openai, @prisma/adapter-better-sqlite3, @prisma/adapter-pg, @prisma/client (+7 more)

### Community 83 - "verification-report.schema.json"
Cohesion: 0.25
Nodes (7): additionalProperties, allOf, description, $id, $schema, title, type

### Community 84 - "required"
Cohesion: 0.20
Nodes (12): required, required, required, digest, excerpt, fetchedAt, id, ref (+4 more)

### Community 85 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, db:setup, dev, dev:standalone, prisma:generate, prisma:migrate, prisma:push (+6 more)

### Community 86 - "minimal-3d/package.json"
Cohesion: 0.14
Nodes (13): esbuild, description, devDependencies, esbuild, three, name, private, scripts (+5 more)

### Community 87 - "lark.mjs"
Cohesion: 0.37
Nodes (13): API_BASE, die(), fsRead(), listChats(), main(), parseArgs(), postJson(), readStdin() (+5 more)

### Community 88 - "browser-smoke.mjs"
Cohesion: 0.15
Nodes (11): args, CANDIDATES, connectCdp(), cp, dir, failures, PORT, profile (+3 more)

### Community 89 - "properties"
Cohesion: 0.13
Nodes (15): properties, enum, type, kind, parseNote, text, verifiable, weight (+7 more)

### Community 90 - "enum"
Cohesion: 0.14
Nodes (14): enum, api_response, ci_check, doc_link, git_commit, goal, log, platform_record (+6 more)

### Community 91 - "persistence-v02.sh"
Cohesion: 0.29
Nodes (9): assert_contains(), assert_eq(), cleanup(), fail(), green(), hard_kill(), kill_test_server(), persistence-v02.sh script (+1 more)

### Community 92 - "scene.js"
Cohesion: 0.22
Nodes (11): buildArena(), buildCamera(), buildComposer(), buildGems(), buildPlayer(), buildRenderer(), buildScene(), onResize() (+3 more)

### Community 93 - "required"
Cohesion: 0.18
Nodes (13): required, required, attackType, checkedAt, claim, criterionId, evidenceIds, outcome (+5 more)

### Community 94 - "required"
Cohesion: 0.15
Nodes (13): required, adjudications, createdAt, criteria, durationMs, evidence, redTeam, reportId (+5 more)

### Community 95 - "persistence-regression.sh"
Cohesion: 0.29
Nodes (9): assert_contains(), green(), json_contains(), json_eq(), red(), persistence-regression.sh script, start_server(), stop_server() (+1 more)

### Community 96 - "build.mjs"
Cohesion: 0.20
Nodes (10): bytes, externalRefs, here, html, outPath, root, sha, template (+2 more)

### Community 97 - "properties"
Cohesion: 0.17
Nodes (12): maximum, minimum, type, writeBack, type, attempts, error, revokedReason (+4 more)

### Community 98 - "enum"
Cohesion: 0.11
Nodes (19): skipReason, status, uncoveredAttackSurface, properties, type, enum, items, type (+11 more)

### Community 99 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, prisma, tsx, @types/node, typescript, vitest, typescript, vitest (+3 more)

### Community 100 - "server/package.json"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, private, type (+1 more)

### Community 101 - "dev.mjs"
Cohesion: 0.36
Nodes (9): children, __dirname, isPortOpen(), log(), main(), match, root, shutdown() (+1 more)

### Community 102 - "mobile_smoke_selftest.mjs"
Cohesion: 0.22
Nodes (8): args, CHROME_ARG, expect(), fixtures, MIME, run(), SCRIPT, server

### Community 103 - "preflight.mjs"
Cohesion: 0.24
Nodes (6): fail(), failures, ok(), pass(), root, warnings

### Community 104 - "SmsProvider"
Cohesion: 0.28
Nodes (5): AliyunSmsProvider, DevSmsProvider, maskPhone(), SmsProvider, TencentSmsProvider

### Community 105 - "id"
Cohesion: 0.50
Nodes (4): minLength, pattern, type, id

### Community 106 - "types/index.ts"
Cohesion: 0.08
Nodes (20): Affection, AntiAddictionStatus, CharacterTier, CharacterType, ConversationMemory, ConversationMood, CustomizationResult, Dialect (+12 more)

### Community 107 - "OpenAICompatProvider"
Cohesion: 0.25
Nodes (3): ChatOptions, LlmProvider, OpenAICompatProvider

### Community 108 - "verify-reproducible.mjs"
Cohesion: 0.25
Nodes (6): existing, hashes, here, prodPath, root, tmp

### Community 109 - "required"
Cohesion: 0.25
Nodes (8): additionalProperties, required, type, criterion, kind, text, verifiable, weight

### Community 110 - "prMapping"
Cohesion: 0.14
Nodes (14): prMapping, redTeam, additionalProperties, allOf, description, required, type, additionalProperties (+6 more)

### Community 111 - "mock.ts"
Cohesion: 0.09
Nodes (19): affectionValues, BASE_CHARACTERS, BASE_GIFTS, BASE_PLANS, BASE_PRODUCTS, buildCharacters(), conversations, convMeta (+11 more)

### Community 112 - "run-all.mjs"
Cohesion: 0.33
Nodes (5): failed, gameRoot, GATES, here, results

### Community 113 - "singlefile.contract.mjs"
Cohesion: 0.33
Nodes (4): failures, here, prodPath, root

### Community 114 - "render-report-md.mjs"
Cohesion: 0.47
Nodes (5): cell(), main(), render(), SCENARIO_LABEL, VERDICT_LABEL

### Community 115 - "api-test.sh"
Cohesion: 0.67
Nodes (4): check(), green(), red(), api-test.sh script

### Community 116 - "deploy-v02.sh"
Cohesion: 0.60
Nodes (5): cleanup(), descendants(), deploy-v02.sh script, start_dist(), stop_dist()

### Community 117 - "myrd-knowledge"
Cohesion: 0.40
Nodes (4): DATABASE_URL, PROJECT_ID, npx, myrd-knowledge

### Community 118 - "input-fuzz.sh"
Cohesion: 0.60
Nodes (3): say_fail(), say_pass(), input-fuzz.sh script

### Community 119 - "playtest.sh"
Cohesion: 0.60
Nodes (3): say_fail(), say_pass(), playtest.sh script

### Community 120 - "run_case"
Cohesion: 0.60
Nodes (4): main(), Path, 跑单个用例。返回 None = 符合预期；字符串 = 失败原因。, run_case()

### Community 121 - "dev-down.sh"
Cohesion: 0.60
Nodes (3): green(), kill_tree(), dev-down.sh script

### Community 122 - "dev-up.sh"
Cohesion: 0.70
Nodes (4): green(), port_busy(), red(), dev-up.sh script

### Community 123 - "godot-game-dev/scripts/smoke.sh"
Cohesion: 0.83
Nodes (3): say_fail(), say_pass(), smoke.sh script

### Community 124 - "chat.ts"
Cohesion: 0.22
Nodes (20): readableCorrection(), chatMultiSend(), conversationDetail(), correctionResponse(), correctMoodPoint(), createConversation(), createConversationEmotion(), deleteConversationEmotion() (+12 more)

### Community 125 - "ref"
Cohesion: 0.29
Nodes (7): ref, title, description, minLength, type, properties, type

### Community 126 - "lib/moodCorrections.ts"
Cohesion: 0.18
Nodes (15): ConversationMood, applyLatestCorrection(), CORRECTION_MOODS, CORRECTION_MUTATION_ID_LENGTH, CORRECTION_REASON_LENGTH, CORRECTION_TAG_LENGTH, CORRECTION_TAG_LIMIT, CorrectionWriteReadContract (+7 more)

### Community 129 - "moodInsight.ts"
Cohesion: 0.19
Nodes (14): MemoryReadContract, MoodTimelineContract, explain(), formatScore(), isValidDate(), moodInsightDegraded(), moodInsightEmpty(), MoodInsightSummary (+6 more)

### Community 130 - "api/index.ts"
Cohesion: 0.13
Nodes (10): realApi, SendMessageParams, SendMultiMessageParams, mockApi, ChatMultiSendResult, ChatSendResult, GiftSendResult, MembershipPlan (+2 more)

### Community 131 - "definitions"
Cohesion: 0.14
Nodes (14): additionalProperties, allOf, type, definitions, adjudication, isoDateTime, sha256, target (+6 more)

### Community 132 - "required"
Cohesion: 0.15
Nodes (14): scoring, additionalProperties, required, type, enum, breakdown, fail, failed (+6 more)

### Community 133 - "exportData.ts"
Cohesion: 0.31
Nodes (9): EXPORT_FORMAT, EXPORT_SCHEMA_VERSION, ExportConversationContract, iso(), normalizedMood(), normalizedScore(), parseJsonObject(), serializeExport() (+1 more)

### Community 134 - "scripts/smoke.sh"
Cohesion: 0.42
Nodes (6): assert_contains(), assert_contains_quiet(), assert_eq(), green(), red(), smoke.sh script

### Community 135 - "adjudications"
Cohesion: 0.22
Nodes (9): items, minItems, type, items, minItems, type, $ref, adjudications (+1 more)

### Community 136 - "evidence"
Cohesion: 0.40
Nodes (5): evidence, additionalProperties, items, type, evidence

### Community 137 - "originTarget"
Cohesion: 0.40
Nodes (5): additionalProperties, properties, type, originTarget, type

### Community 138 - "criteriaHash"
Cohesion: 0.50
Nodes (4): description, pattern, type, criteriaHash

### Community 139 - "reportId"
Cohesion: 0.50
Nodes (4): reportId, description, pattern, type

### Community 141 - "durationMs"
Cohesion: 0.67
Nodes (3): minimum, type, durationMs

## Knowledge Gaps
- **651 isolated node(s):** `name`, `slug`, `scheme`, `version`, `orientation` (+646 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `definitions` connect `definitions` to `properties`, `required`, `evidence`, `triggeredBy`, `verdict`, `required`, `prMapping`, `verification-report.schema.json`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `properties` connect `properties` to `adjudications`, `evidence`, `criteriaHash`, `reportId`, `durationMs`, `properties`, `verification-report.schema.json`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `scoring` connect `required` to `definitions`, `properties`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `scheme` to the rest of the system?**
  _651 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `chatEngine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11088709677419355 - nodes in this community are weakly interconnected._
- **Should `properties` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._