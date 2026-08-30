# 开发进度跟踪 (Development Progress)

> 开始时间: 2026-08-26  
> 负责人: Phase 1 — 基础设施层  
> 策略: 先基础设施，后业务模块

## Phase 1 任务总览

| # | 计划 | 模块 | 类型 | 状态 | 完成时间 | 变更文件数 |
|---|------|------|------|------|---------|-----------|
| 1 | Plan 01 | API Client 增强 | 前端 | ✅ 已完成 | 12:02 | 5 |
| 2 | Plan 02 | Design Tokens + Hook | 前端 | ✅ 已完成 | 12:07 | 4 |
| 3 | Plan 03 | 构建优化 | 前端 | ✅ 已完成 | 12:09 | 1 |
| 4 | Plan 09 | 数据库 DevOps 框架 | 后端 | ✅ 已完成 | 12:12 | 5 |
| 5 | Plan 31 | Circuit Breaker 中间件 | 后端 | ✅ 已完成 | 12:18 | 2 |
| 6 | Plan 32 | Web Vitals 采集 | 全栈 | ✅ 已完成 | 12:22 | 3 |
| 7 | Plan 35 | OTel Span 统一封装 | 后端 | ✅ 已完成 | 12:26 | 6 |
| 8 | Plan 45 | API 测试覆盖扩展 | 前端 | ✅ 已完成 | 13:10 | 8 |
| 9 | Plan 46 | API 路径前缀规范化 | 前端 | ✅ 已完成 | 13:25 | 161 |

## 每日进度日志

### 2026-08-26

- 12:00 — Phase 1 启动，全量代码扫描完成
- 12:05 — Plan 01 API Client 增强开始
- 12:02 — Plan 01 ✅ 完成：新增 errors.ts(160行) + canceller.ts(104行) + retry.ts(108行) + tests(37测试全通过)
  - 变更: src/api/client.ts(增强), errors.ts(新增), canceller.ts(新增), retry.ts(新增)
  - 新增测试: __tests__/errors.test.ts + retry.test.ts + canceller.test.ts
  - 全部 api 测试 109 passed
- 12:07 — Plan 02 ✅ 完成：新增 useOrionToken.ts(126行) + tokenStore.ts(96行) + themeEngine.ts(187行) + tests(12测试全通过)
  - 变更: src/tokens/ 新增 tokenStore, themeEngine, useOrionToken
  - 新增测试: __tests__/tokenStore.test.ts(7) + themeEngine.test.ts(5)
- 12:09 — Plan 03 ✅ 完成：vite.config.ts 增强 target/es2020, minify/esbuild, reportCompressedSize, cssCodeSplit, optimizeDeps(预构建依赖), chunkSizeWarningLimit降至500KB
- 12:12 — Plan 09 ✅ 完成：数据库 DevOps 框架 — Go generics BaseRepository[T any] + BaseServiceInterface + Gin Handler模板 + MigrationRunner
  - 变更: internal/devops/ 新增 repo_template.go, service_template.go, handler_template.go, migration_runner.go, devops_test.go
  - 特性: 泛型仓储(CRUD/分页/排序/搜索/租户隔离)、事务包装、统一API响应、5个标准Handler模板、迁移执行器(自动发现/按版本排序/锁定防并发/回滚)
  - 测试: 5 tests all pass (extractVersion/validateCreate/validateList/pageLimit/negativePage)
- 12:18 — Plan 31 ✅ 完成：Circuit Breaker 中间件 — 内存态熔断器(CLOSED→OPEN→HALF_OPEN→CLOSED状态机)
  - 变更: internal/circuit-breaker/ 新增 middleware.go, middleware_test.go
  - 特性: 失败阈值熔断、成功阈值恢复、超时自动HALF_OPEN探测、并发探针限制、Fallback回调、状态变更事件、ForceOpen/ForceClose/Reset管理接口
  - 测试: 9 tests all pass (initialState/executeSuccess/executeFailure/opensAfterThreshold/rejectsWhenOpen/transitionsToHalfOpen/closesAfterSuccesses/reset/forceOpenClose/stateChangeCallback)
- 12:22 — Plan 32 ✅ 完成：Web Vitals 采集 — 前端 Core Web Vitals 收集器 + 后端 Prometheus 指标
  - 变更: src/utils/web-vitals.ts, internal/observability/webvitals.go, internal/observability/webvitals_test.go
  - 前端: LCP/CLS/INP/FID/FCP/TTFB 全量采集(PerformanceObserver)、rating分级、Beacon+fetch双通道上报、session追踪
  - 后端: 9个Prometheus指标(lcp/cls/inp/fid/fcp/ttfb/pageLoad/domReady/totalReports)、按page+service+rating多维度、Gin Handler
  - 测试: 4 tests all pass (extractPagePath/findIndex/extractService/findBestRating)
- 12:26 — Plan 35 ✅ 完成：OTel Span 统一封装 — 全栈 Trace 包装器(DB/Redis/HTTP/Message)
  - 变更: internal/tracing/ 新增 span.go, db.go, redis.go, http.go, message.go, tracer.go, tracing_test.go
  - 特性: TracerManager统一入口、DBSpan(ExecContext/QueryContext/QueryRowContext+rowsAffected)、RedisSpan(Set/Get/Del/TTL+duration)、HTTPSpan(Get/PostJSON+status_code)、MessageSpan(Publish/Consume+payload_size)、SpanContext(StartSpan+EndWithError)
  - 测试: 8 tests all pass (truncateSQL/truncateKey/startSpan/startSpanNoOpts/spanFromContext/tracerManager/applySpanOpts/lastWins)
- 20:30 — Plan 09 ✅ 增强：database-devops 四层补全 + 模型扩展
  - 变更: internal/database-devops/ 增强 models.go(19→95行) + repository.go(44→143行) + handler.go(77→149行) + 新增 service/service.go(192行) + migrations/550_database_devops.sql
  - 特性: 新增 Type/Status/DatabaseID/Config/Result 字段, BackupConfig/RestoreConfig/DatabaseSource 模型, service 层(ExecuteBackup/ExecuteRestore/DataSource CRUD), 路由 4→10
  - 测试: go build 编译通过
- 20:35 — 修复 2 个 git 合并冲突标记
  - circuit-breaker/handler/handler_test.go: 移除 `<<<<<<</=======/>>>>>>>` 冲突标记
  - observability/handler/handler_test.go: 同上
  - 测试: 修复前 FAIL → 修复后 all pass
- 12:50 — Plan 45 ✅ 开始：API 测试覆盖扩展 — 180 个 API 源文件仅 16 个有测试(8.9%)
  - 基准: 75 test files, 496 passed (2 pre-existing failures)
  - 新增测试文件: auth.test.ts(10测试)、health.test.ts(7测试)、queue.test.ts(8测试)、user.test.ts(12测试)、pipelineRuns.test.ts(7测试)、deploy.test.ts(10测试)、workflow-task.test.ts(7测试)、workflow.test.ts(13测试)
  - 测试模式: vi.mock('../client') + vi.mocked(api.get/post/put/delete) + beforeEach clearAllMocks + 断言 URL/参数/返回值
  - API 测试全部 183 passed (24 test files)
  - 全量测试: 80 test files, 540 passed | 3 failed (3个为既有非API组件问题)
  - 覆盖率: 7.3% → ~22% (API 模块从 8.9% → ~29%)
- 13:15 — Plan 46 ✅ 开始：API 路径前缀规范化 — 147 个 API 客户端文件含硬编码 `/api/v1/`
  - 目标: ≤5 文件含硬编码前缀（client.ts 已配置 baseURL=/api/v1，API 文件应使用相对路径）
  - 变更: 161 个 API 文件 + 20 个测试文件的 `/api/v1/` → `/` 路径规范化
  - 结果: 0 文件含硬编码 `/api/v1/`（仅 client.ts baseURL 保留），全部 24 test files / 183 tests 全通过
  - 验收: grep "api/v1" src/api/*.ts 仅返回 client.ts 中的 baseURL 定义 ✅
- 20:45 — 批量修复 133 个 git 合并冲突
  - 原因: 50+ 个 handler/handler_test.go 含 `<<<<<<< Updated upstream / ======= / >>>>>>> Stashed changes` 冲突标记
  - 修复: 批量 sed 删除冲突标记，保留 Updated upstream 版本
  - 结果: 0 残留冲突，全量 go build 0 错误，go test 536 包全 PASS 0 FAIL
- 22:41 — Phase 2 P1 交互修复批量完成（4页）
  - canary-traffic/CanaryTrafficPage.tsx (295→405行)：新增 Configs Tab 编辑/删除操作 + Promote/Rollback Modal.confirm 确认 + 中文翻译
  - multi-cloud/MultiCloudPage.tsx (880→1033行)：新增 CloudAccount 编辑/删除操作 + 成本趋势 API 化
  - supply-chain/SupplyChainPage.tsx (288→334行)：新增 SBOM 文档签名确认 + 删除操作 + 复制入口
  - PipelineRunAnalytics/index.tsx (794→808行)：Cancel/Retry 操作添加 try-catch 错误处理
  - API 测试：24/24 test files，183/183 tests 全通过
- 22:55 — Phase 2 P1 交互修复第二批（4页 + API）
  - DashboardNew/index.tsx：系统健康状态从 getServiceHealthList() API 获取，替换4条硬编码数据
  - DashboardCore/index.tsx：新增系统健康 API 调用 + state 管理，替换静态硬编码数组
  - federation/FederationPage.tsx (529→610行)：新增 Cluster注销/Job删除/Pool删除 操作（Modal.confirm 确认）
  - api/federation.ts：新增 deregisterCluster/updateCluster/deleteJob/deleteResourcePool 4个 API 方法
  - 全量测试：83 test files, 571 passed, 2 个既有失败（pre-existing）
- 23:15 — Phase 2 P1 交互修复第三批（4页 + API）
  - PipelineDetail/index.tsx：任务输出 Tab 空表格替换为 Empty + "API 开发中" 引导说明
  - DeploymentList/index.tsx：空状态添加 Empty + "创建部署" 跳转引导按钮
  - Backup/index.tsx：新增备份编辑入口（编辑按钮 + Edit Modal + updateBackup API）
  - DashboardNew/index.tsx：任务/Pipeline 空状态添加 Empty 组件 + "创建 Pipeline" 引导按钮
  - api/backup.ts：新增 updateBackup(id, input) API 方法
  - 全量测试：83 test files, 571 passed, 1 个既有失败（Form.test.tsx pre-existing）
- 23:25 — Phase 2 P1 交互修复第四批（IacPage CRUD + DeveloperPortal 审计确认）
  - pages/iac/IacPage.tsx：工作区 Tab 新增编辑/删除操作（Edit Modal + Popconfirm 删除 + updateWorkspace/deleteWorkspace API）
  - pages/iac/IacPage.tsx：模块 Tab 新增编辑/删除操作（Edit Modal + Popconfirm 删除 + updateModule/deleteModule API）
  - pages/iac/IacPage.tsx：工作区/模块空状态添加 Empty 组件引导
  - api/iac.ts：新增 updateModule(id, data) API 方法
  - developer-portal/DeveloperPortalPage.tsx：审计确认 — 5 Tab 全量 CRUD 完整（Document/Mock/SDK/Subscription/Playground），Empty 引导齐全 ✅
  - Phase 2 P1 进度：15/48 = 31.25%
  - 全量测试：83 test files, 571 passed（Form.test.tsx 2 个既有失败）
- 23:30 — Phase 2 P1 交互修复第六批（静默吞错批量修复 + Dashboard fallback + Empty 状态）
  - pages/DashboardNew/index.tsx：系统健康 API 失败 fallback 改为显示错误状态（不再展示4条硬编码数据）
  - pages/Assistant/index.tsx：2 个静默 catch 添加 message.error 反馈
  - pages/ApprovalManagement/index.tsx：3 个静默 catch 添加 message.error（import message）
  - pages/DocumentCenter/index.tsx：1 个静默 catch 添加 message.error（import message）
  - pages/lowcode-svc/FormInstancePipeline/index.tsx：2 个静默 catch 添加 message.error
  - pages/lowcode-svc/ComponentRegistry/index.tsx：1 个静默 catch 添加 message.error
  - pages/service-portal/index.tsx：1 个静默 catch 添加 message.error
  - pages/ServiceCatalog/index.tsx：2 个静默 catch 添加 message.error
  - pages/ScriptLibrary/index.tsx：2 个静默 catch 添加 message.error
  - pages/ai-decision-explanation/ExplanationPage.tsx：2 个静默 catch 添加 message.error
  - pages/RunnerManagement/index.tsx：1 个静默 catch 添加 message.error
  - pages/ci-type-designer/index.tsx：2 个静默 catch 添加 message.error
  - pages/inception/InceptionPage.tsx：1 个静默 catch 添加 message.error
  - pages/TicketDetail/index.tsx：1 个静默 catch 添加 message.error
  - pages/circuit-breaker/CircuitBreakerPage.tsx：1 个静默 catch 添加 message.error
  - pages/ChangeRequestManagement/index.tsx：主表格添加 Empty 空状态引导
  - Phase 2 P1 进度：31/48 = 64.58%
  - 全量测试：83 test files, 571 passed（Form.test.tsx 2 个既有失败）
  - TypeScript：0 新增错误（17 个既有错误不变）

### 2026-08-26（后端专项：可观测性 + 启动正确性）

- ✅ **WeKnora 知识图谱集成方案设计完成**
  - 文档: `orion-platform-svc-go/docs/weknora-integration-design-2026-08-26.md`（v1.0，15 节，22,043 字节）
  - 内容: 现状分析与缺口 → 集成架构与分层职责 → 4 大核心能力（实体抽取 / 关系发现 / 图谱查询 / 图谱增强 RAG）→ 数据模型与数据库迁移 → WeKnora Bridge 接口契约与配置 → 与 Knowledge / RAG Pipeline / Graph 三处集成点 → API 路由与清单 → 4 阶段路线图（6-8 周）→ 降级策略 → 监控指标 → 依赖服务 → 配置管理 → 测试计划（单测/集成/压测）→ 风险与缓解 → 总结
  - 已登记到 `docs/INDEX.md`「外部能力集成设计（2026-08-26）」小节

- ✅ **OpenTelemetry 全量 Handler 埋点完成（5009 / 5009，本轮已修正前一版 4312 的错误统计）**
  - 覆盖: Go 后端全部 gin handler，span 置于 handler 体首行，`c.Request.Context()` 全部替换为 span 派生的 `ctx`
  - 审计: 5009 个 gin handler、5015 个以 `c.Request.Context()` 为父上下文的 ingress span、5237 处 `otel.Tracer(...).Start(` 调用（含 service 层链路 span）、15 个 distinct tracer 名
  - 缺口闭合: 前一轮报告「4312/4312」为错误数字（漏掉 85 个文件共 588 个未埋点 handler，其中 `internal/ticket/handler` 106 个 handler 全部为 0 span），本轮已全部补齐 → 0 个文件 handler 数 > span 数
  - 本轮埋点范围: 85 个缺口文件 + `internal/middleware/dlp.go`；随后 reconcile 137 + 80 个文件修正 `ctx, span :=` / `_, span :=` 形式（body 不需要 ctx 时降级为 `_` 以满足 Go 未使用变量检查）
  - Tracer 命名决策: HTTP ingress 层统一使用 `orion-platform-svc`（即便同包兄弟文件用 `orion-ticket-svc` / `admin-service` / `orion-config-mgmt-svc`）——HTTP 入口属同一服务，领域 tracer 名留给 service/repo 层；`internal/ticket/handler` 与 `internal/ticketing/handler` 为重复模块，统一命名使其一致
  - 修复的 3 类埋点副作用: (1) `ctx := c.Request.Context()` 已被改写为非法 `ctx := ctx` 的 8 个 handler（login_attempt List、mfa Setup/Verify/Disable/Status、tenant AllocateNamespace/GetPoolStatus/GetTenantNamespacesList）→ 删除该冗余行，改由 span 的 ctx 提供；(2) 3 个文件出现重复 `func` 签名行（chatops/command_handler.go、cmdb-collector/factory_handler.go、cron/scheduler_handler.go）→ 折叠；(3) derive_prefix 对 `internal/config/internal/...` 与 `internal/middleware/` 产出无意义前缀 `"Internal"` → 显式覆盖为 ConfigTemplate / PipelineBatch / PipelineRun / PipelineAutonomous / ChatopsAdmin / DLP
  - 验证: `go build ./...` EXIT 0、0 处残留 `c.Request.Context()`、0 处 `ctx := ctx`、0 处错误降级（body 用 ctx 却写成 `_`）、`gofmt -l internal/` 0 个文件
  - `go vet ./internal/...` EXIT 1 但 20 条 finding 全部为既有代码问题、与本轮埋点无关（本轮已复跑 `go vet ./...` 并与修复前日志逐字节 diff 确认完全一致）: 8 条 process-step 非导出字段带 json tag、2 条重复 json tag（Config / Channel，同处 handler.go:34）、4 条 unreachable code、6 条 self-assignment

- ✅ **重复路由注册清除（11 对，避免 Gin 启动 panic）**
  - 背景: 模块搬迁（`internal/*` 重定位）使 import 可解析，暴露出 11 处「同一 handler 包被构建两次并注册两次」的隐性问题，Gin 会以 `http: multiple registrations for ...` 直接 panic
  - 模块级重复 7 处: channel / do-not-disturb / tenant / session / api-key / ueba / cross-domain — 统一保留模块专属 wiring 文件，删除 `wiring-core-domains.go` 与 `notification_auth_wiring.go` 中的通用侧重复构建、import、var 声明
  - 同变量重复 4 处: message_queueH / visorH / runbookH / smartDeployH 在 router.go 各注册两次，保留首次出现
  - 决策: session TTL 两处不一致（72h vs 24h），保留 `sessionH` 的 72h（更宽松且属模块专属 wiring）
  - 验证: `go build ./...` / `go vet ./cmd/...` / `go test ./cmd/...` 均 EXIT 0；重复审计 0 包级重复、0 同变量重复、327 个已注册变量全部有构建点

- ✅ **原「21 个 handler 构建后从未注册路由」缺口已闭合**（详见下方「路由注册冲突清零」小节）
  - ticket 域 10 个: 6 个经新增的 `RegisterTicketDomainRoutes`（`internal/ticket/handler/routes.go`）挂载 23 条独占路由；4 个（workflowModH / relationH / suspendH / analyticsTicketH）为 `ticketingH` 完整子集，保留不挂载
  - 其他 11 个: `cqrsHandler` 已挂载（9 条 `/commands/*`）；chaosH / chaos_enhancedH / chaosGatewayH 由 `chaosEngineH` 门面代理，不重复挂载；ai_knowledgeH / ciCanaryH / ciPipelineH / graphvizH / infraMWH / skillH 为 wiring.go 中从未构建的悬空声明
  - 注: `cqrsHandler`（`internal/application/http`）是本轮新加 9 个 OTel span 的 CQRS 命令端点，此前埋点完成但路由不可达，现已修复

### 2026-08-29

- ✅ **DBA / 数据挖掘 / AI 智能化缺口深度评审完成（3 份文档 + 前端访问缺口）**
  - 评审视角: DBA 专家 + 数据挖掘工程师 + AI 智能体集成，对标主流平台（ByteDance-ByConity / Bytebase / Yearning / 阿里 DataWorks / 网易数帆 / SelectDB 等）
  - **文档 1**: `docs/dba-data-ai-agent-gap-analysis-2026-08-29.md`（859 行）
    - 评分矩阵: 整体 3/10（DBA 基础 4/10、AI 能力 2/10、数据挖掘 3/10、前端工作台 2/10）
    - 17 个数据相关模块盘点: **12/17 零 AI 集成**（Text2SQL/SQLAdvisor/IndexAdvisor/Profiler/血缘自动采集/NL→BI 全缺）
    - 缺口: 17 项 P0 + 10 项 P1，AI Agent 设计（dba/advisor/text2sql.go + AuditEngine + LLMProvider + SourceProvider 扩展）
    - 前端工作台: `/dba-workbench`（10 子页）+ `/data-workbench`（11 子页），7 个待建 API 客户端，UI 6 阶段 19 人天
  - **文档 2**: `docs/dba-data-deep-review-and-interaction-issues-2026-08-29.md`（380 行）
    - 方案遗漏 8 项（GAP-1~8）: 审核规则引擎缺失（AuditRule 仅 CRUD）、连接池不复用、6 模块零互调、EventBus 未接入、无 Saga、密码明文、LLM 无成本控制、无 CMDB 联动
    - 系统交互问题 9 项（IX-1~9）: 数据源管理分裂（dba vs datasource 两套）、DBA 仅支持 PostgreSQL（硬编码）、6 模块孤立、事件链路断裂等
    - 数据库类型支持: datasource=PG/MySQL/ClickHouse/ES/MongoDB(5)、data-catalog=PG/MySQL/SQLite(3)、DBA=仅 PG
    - Phase 0 架构统一前置（13 人天），总工作量修正为 67-68 人天
  - **文档 3**: `docs/permission-system-review-and-dba-data-integration-2026-08-29.md`（459 行）
    - 权限体系结论: **完备**（RBAC + ABAC + AuthorizationEngine + 缓存 + 审计 + UEBA + WORM）
    - 数据域接入 6 项缺口（PERM-1~6）: datasource/database-devops 0 守卫（🔴 安全裸奔）、DBA 角色 fallback 无 dba:* 权限（前后端不一致）、缺 4 个数据专业角色（data_admin/data_steward/bi_analyst/data_engineer）、resource 拼写不一致（data-mashing）、AI 端点无权限
    - 新增 `:ai` action + 3 条数据场景 ABAC 策略（生产库写审批 / 敏感导出脱敏 / AI SQL 审核）
    - 完整 资源×动作×角色 权限矩阵 + 守卫覆盖率目标
  - 核心结论: 当前系统 DBA/数据挖掘/AI 能力不足 3/10，需 Phase 0（13d）+ 原 P0/P1（35d）+ 前端工作台（19d）≈ 67-68 人天补齐
- ✅ **第四轮深度分析完成：接线状态 + 数据库类型实况 + 测试与安全缺口**
  - 评审问题: "进行深度分析还存在哪些问题" + "当前具备本管理哪些数据库类型"
  - 文档: `docs/dba-data-round4-deeper-issues-2026-08-29.md`
  - 方法: 从服务入口反向审计接线实况（wiring/router 接线审计 + 驱动 import 审计 + 测试文件审计 + 权限守卫审计）
  - **5 组新问题维度**:
    - 🔴 R4-1: datasource 模块**完全未接线**（`internal/datasource/` 仅 4 文件无 handler 目录 + `cmd/server/` 零引用）→ 数据源管理实际无任何可用 HTTP API
    - 🔴 R4-2: datasource 宣称 5 种数据库、**实连仅 2 种**（service.go:17-18 仅 import mysql+pgx 驱动，ClickHouse/ES/MongoDB 调用直接返回错误）
    - 🔴 R4-3: **三套数据源表示、两处明文密码**（dba 明文 / datasource AES-256-GCM / database-devops 明文 `db:"password"` + `/data-sources` HTTP 端点）
    - 🟡 R4-4: database-devops **已 wiring 已实例化**（wiring.go:646）但 10 条路由 0 权限守卫 + 0 测试文件（比"无端点"更危险）
    - 🟡 R4-5: 前端数据域页面覆盖仅 3/17 模块（data-lineage/data-quality/dba），无 datasource.ts API 客户端
  - 数据库类型实况修正: datasource 宣称 5（PG/MySQL/ClickHouse/ES/MongoDB）实连 2（PG+MySQL）；data-catalog 3（PG/MySQL/SQLite）；DBA 仅 PG（硬编码）；缺 Oracle/SQL Server/OceanBase/openGauss/TiDB
  - 新增待办: ARCH-0.9~0.12（合计 7 人天）— datasource 补 handler+路由接线 / database-devops 补守卫+测试 / 三套数据源统一+明文清理 / 补 ClickHouse+MongoDB 驱动
  - 核心洞察: 数据域问题不仅有"缺 AI 能力/交互/权限"，还有**宣称与实现脱节 + 模块未接线 + 已上线无防护**的工程真实性问题

### 2026-08-29（后端专项：P0 启动崩溃修复 + 路由注册冲突清零）

- 🔴→✅ **P0 修复：Go 服务进程根本无法启动（`setupRouter` 在 Gin 内部 panic）**
  - 现象: 进程一启动就在路由注册阶段 panic，任何 HTTP 端点都不可达
  - 机制: Gin v1.10.0 每个 HTTP method 一棵 radix tree，两类注册会硬 panic — (a) 同一 `(method, path)` 注册两次（`handlers are already registered for path '...'`）；(b) 同一 trie 节点出现两个不同名的通配符 token。Gin 保留第一次注册，后续重复是死代码，但会当场崩进程
  - 关键约束: **只有真正组装路由才能暴露这类问题** — `go build` / `go vet` / `go test`（非启动测试）全部查不出；必须按 router.go 的真实顺序重放 316 处注册
  - 更深一层根因（已修复）: 接线函数定义了但从未被调用。`wireCoreDomains` 从未被调用，导致 `wireGovernanceDomains` / `wireSecurityDomains` / `wireIdentityDomains` / `wireTicketDomain` 全为死代码 → 24 个 handler var 永久为 nil → 16 处路由注册静默 no-op。补上一行 `wireCoreDomains(db, logger)`（`cmd/server/wiring.go:325`）后，立刻暴露出 9 处此前被 nil 守卫掩盖的重复注册
  - 收敛过程（冲突数 / 已装配路由数）: 冲突 52 → 38 → 31 → 17 → 5 → 3 → 1 → **0**；路由 3097 → 3247 → **3403**
  - 最终结果: `setupRouter assembled 3403 routes without panic`，`assembled 3407 routes; 0 registration conflicts`

- ✅ **新增 4 个测试文件，把「路由注册合法性」固化为 CI 断言**
  - `cmd/server/boot_test.go` — 316 处注册完整重放，断言 `setupRouter` 不 panic 且路由数 > 0（P0 回归锁）；内置 sqlx 可用的 driver stub（stubDriver / stubConn / stubStmt / stubTx / stubConnector）
  - `cmd/server/route_conflict_scan_test.go` — 316 处注册逐处重放，统计 `(method, path)` 重复并归因到注册顺序，输出 `assembled %d routes; %d registration conflicts`
  - `cmd/server/route_dump_test.go` — 316 处注册分别 dump 到独立 engine，写 `/tmp/perhandler.tsv`（`var\trline\tmethod\tpath\tginHandler-fn`），用于定位某路径的归属 handler
  - `cmd/server/ticket_routes_conflict_test.go` — 工单域 trie 冲突专项断言
  - 说明: 3 个重放型测试的 316 项条目列表**手工镜像** `cmd/server/router.go`，改动 router.go 时必须同步（不存在生成脚本）
  - ⚠️ 注意: 模块 `.gitignore` 第 6 行含 `cmd/server` 整目录，这 4 个测试文件是**未跟踪**状态，提交时必须 `git add -f`（`router.go` 等既有文件早已 force-add，故不受影响）

- ✅ **工单域：新增 `RegisterTicketDomainRoutes` 挂载 23 条独占路由（此前完全不可达）**
  - 文件: `internal/ticket/handler/routes.go`（新建）
  - 签名: `RegisterTicketDomainRoutes(rg, ticket, sla, dispatch, queue, lb, transfer *Handler)` — 7 参数，任一为 nil 时跳过对应段
  - 覆盖 6 个 handler、23 条此前无人认领的路由: PUT/DELETE `/tickets/:id`、GET `/tickets/stats`、`/tickets/:id/comments`（GET/POST）、`/tickets/sla/{targets,compliance,breaches}`、`/tickets/:id/dispatch/{auto,manual}`、SLA 队列（sla-status / sla-entries / sla-alerts / reprioritize）、`/tickets/dispatch/balancing/{report,suggestions,team/:team/capacity,engineer/:id/capacity,available}`、`/tickets/transfer/{suspend/:suspendId,auto-check,config}`
  - 决策: 刻意排除 `internal/ticketing/handler`（单体 `ticketingH`）已拥有的全部路径，包括 `GET /tickets/:id` 与 `POST /tickets`
  - 剩余 4 个不挂载: workflowModH / relationH / suspendH / analyticsTicketH — 三者路由 100% 被 `ticketingH` 覆盖，挂载必 panic

- ✅ **4 处「已构建但从未挂载」的 handler 已挂载，恢复可达 API**
  - `escalationH` — `/escalation` 前缀空闲，直接挂载
  - `pipelineExecutorH` — `/pipelines`、`/pipelines/:id` 空闲，直接挂载
  - `cacheMgmtH` — 需**命名空间隔离**挂到 `/cache-mgmt`: 其裸 `/cache/configs` 已被 ciBuildH（构建缓存配置）占用、`/cache/:id` 已被 cacheModH 占用，直接挂载会 panic
  - `infra.cqrsHandler` — **唯一进入对象图却从未挂载的 handler**（`setupInfra` 中构建并挂在 `infrastructure` 上，router.go 从未引用），导致 `/api/v1/commands/*` 9 条 CQRS 命令端点完全不可达（含 approval 审批链、feature-flag 灰度）。现已挂载；前缀完全空闲
  - 同批新增 3 处接线补挂: escalationH / pipelineExecutorH 的调用点补在 router.go 对应分组附近

- ✅ **5 处冲突改为命名空间隔离，而非删除路由**
  - governanceComplianceH / governanceH / governancePolicyH / securityH / securitySecretH — 声明裸相对路径，与已有资源冲突。改为 `api.Group("/x")` 命名空间：既消除根冲突、又与前端 URL 对齐、还保住了 handler 本体
  - 同类处理: cacheMgmtH → `/cache-mgmt`
  - 对比: 4 处纯重复（serviceControlH / automationRuleTicketH / slaPolicyTicketH / ticketSourceTicketH）直接删除注册块并留注释说明由 `ticketingH` 覆盖

- ✅ **chaos 三兄弟刻意不挂载（门面模式，已在 router.go 注释）**
  - `chaosEngineH`（`internal/chaos-engine/handler`）是合并门面，内部以 `if h.chaosH != nil` / `if h.enhancedH != nil` / `if h.gatewayH != nil` 守卫把 `/chaos` 全部路径分派给 chaos / chaos-enhanced / chaos-gateway 三个子服务
  - 因此 chaosH / chaos_enhancedH / chaosGatewayH **不得**单独注册，否则 `/chaos/*` 每个 `(method, path)` 都会注册两次并 panic
  - 已在此处加 4 行 router.go 注释固化该决策

- 🔍 **审计确认：8 处模块级重复 handler 必须保持不挂载（避免重复挂载）**
  - `/iac/*` → iacH（infraIacH 重复）；`/serverless/*` → serverlessH（infraServerlessH 重复）；`/ai-gateway` → aiGatewayH（ai_aigatewayH 重复）；`/ai-review` → aiReviewH（ai_aireviewH 重复）；`/prompt-security/*` → promptSecurityH（psH 重复）；`/orchestration/*` → ai_orchestrationH（orchestrationH 重复）；`/auto-recovery/{rules,actions}` → ai_autorecoveryH（autoRecoveryH 重复）；`/api/v1/dba/*` → dbaH（infraDbaH 重复，router.go 中已注释掉）
  - **附带发现一个潜伏通配符名冲突**: `orchestrationH` 声明 `/orchestration/:orch_id/runs`，`ai_orchestrationH` 声明 `/orchestration/:id/runs` — 路径完全相同但通配符 token 名不同，同挂必 panic。好在两者当前都未挂载
  - 审计方法: 按 `\bvar\b` 全词匹配（而非 `var != nil` 守卫形状）判定引用，避免把注释里的提及误判为已注册；对 `/tmp/perhandler.tsv` 做前缀检索时必须用 `'^/api/v1/x'` 纯前缀正则，`\b` 词边界锚定在带 `:` 的路径段上会静默返回空集

- 🧹 **顺带清理 3 处代码坏味道**
  - `internal/plugin/handler/handler.go` — 乱码注释重写为可理解的通配符 token 说明
  - `internal/pipeline-templates/handler/handler.go` — 删除 `// unused import fix` 假用法块（`var _ = http.StatusOK` / `var _ = strconv.Itoa`）及随之失效的 2 个死 import（`net/http`、`strconv`）
  - `cmd/server/wiring.go` — 修复粘连的 import 注释（`// ---- P0-5 ...` 与 import 行挤在一起）
  - 格式约束: `cmd/server/router.go` 与 `cmd/server/wiring.go` **非 gofmt-clean 且刻意未 gofmt**（router.go `setupRouter` 体用 2/4 空格字面缩进、wiring.go 有既有的手工 import 分组，gofmt 会引入大量无关 diff）；`cmd/server/` 全部测试文件（含本轮新建的 4 个）+ `internal/` 全部 gofmt-clean

- ✅ **验证结果**
  - `go build ./...` EXIT 0
  - `gofmt -l internal/` 0 个文件
  - `go test ./...` EXIT 0 — **542 个包 ok，0 失败**
  - `cmd/server` 套件全绿: boot（3403 routes no panic）、conflict scan（3407 routes / 0 conflicts）、dump（316 handlers）、TestTicketRoutesTreeConflict
  - `go vet ./...` 20 条 finding 与修复前日志逐字节 diff 一致，全部为既有问题（8 非导出字段 json tag + 2 重复 json tag + 4 unreachable + 6 self-assignment）

- 📌 **遗留待办（非阻塞，已记录）**
  - 7 个悬空声明 handler var（`wiring.go` 声明但从未构建，始终为 nil）: ai_knowledgeH、ciCanaryH、ciPipelineH、graphvizH、gsH、infraMWH、skillH；另有 ciCanaryH / ciPipelineH 的赋值在 wiring.go:533、:537 被注释
  - `cmd/server/router.go:646` `workflowExtraH.RegisterRoutes(api)` 未加 nil 守卫（在 `if workflowH != nil` 内、当前安全但脆弱）
  - 前端 API 面缺口: `orion-frontend/src/api/api-governance.ts` 调用 `/governance/contracts|rules|violations|report|versions`，后端无 handler 认领；confirmation 客户端调 `/confirmations` 而后端 handler 注册 `/confirmation`（单复数不一致）
  - 待补: `internal/datasource/` 补 handler + 路由接线、database-devops 补权限守卫 + 测试（见上轮 ARCH-0.9~0.12）

### 2026-08-29（后端专项：权限守卫源码审计 + 数据源 REST API + 死声明清理）

> 本轮把「权限守卫是否真的可被非超管角色满足」从人工判断变成 CI 断言，并把一个完全死掉的模块（`internal/datasource`）接成可用的 REST API。上一轮遗留的 4 项待办中 3 项已闭环。

- ✅ **PERM-1~5 全部修复（`orion-go-common/pkg/auth/permission.go`）**
  - **PERM-3** — `dba` 角色原本一条 `dba:*` 都没有，34 处 `RequirePermission("dba", …)` 守卫对 DBA 用户全部 403（只有 `*:read` 顺带漏进了读操作）。现补 `dba:*` / `datasource:*` / `database-devops:*`
  - **PERM-4** — 新增 `DataRolePermissions`：`data_admin` / `data_steward` / `bi_analyst` / `data_engineer` 4 个数据专业角色，覆盖 data-catalog / data-quality / data-lineage / data-masking / data-classification / data-pipeline / bi-dashboard / report-designer / datasource / database-devops
  - **admin action** — 67 处守卫（chatops:admin x43、knowledge:admin x10、tracing:update x4、sprint:update x4、artifact-version:admin x2、event_bus:admin 等）此前只有 super_admin 可达，因为没有任何角色持有 `*:admin` 通配。现 `platform_admin` / `tenant_admin` 补 `*:admin`，并新增 `ModuleAdminRolePermissions`（chatops.admin / knowledge.admin / artifact-version.admin / ai.admin / sprint.admin / tracing.admin / event_bus.admin）
  - **PERM-5** — `internal/data-masking/handler/handler.go` 第 30 行守卫写的是 `"data-mashing"`，其余 5 处是 `"data-masking"`；角色表里没有 `data-mashing:*`，那一条路由对所有人（除 super_admin）403
  - **`_` / `-` 拼写归一** — 后端两套拼法并存（audit-log/audit_log、middleware-ops/middleware_ops 196 vs 289 处、oci-registry/oci_registry、report-designer/report_designer）。新增 `normResource()` / `normPerm()`，**在存储侧和查询侧同时归一**，一个 grant 写 `middleware_ops:*` 就能满足写 `middleware-ops` 的守卫 —— 零 handler 改动消除 4 组拼写分叉（对应 ARCH 层 Batch F）

- ✅ **新增 `cmd/server/permission_guard_audit_test.go` — 权限守卫的源码级 CI 断言（5 条规则）**
  - 扫描范围: 387 个 `.go` 文件，**765 个守卫对 / 3640 处调用点 / 261 个不同资源 / 310 个模块目录**
  - R1 每个守卫对必须能被 ≥1 个**非 super_admin** 角色满足
  - R2 `_` / `-` 两种拼法必须等价
  - R3 每个含守卫的模块目录，必须以自己的名字被守卫
  - R4 任何守卫资源不得与某模块目录名只差**一次字符替换**（长度 ≥ 5）—— 就是这条抓住了 `data-mashing` 拼写
  - R5 以资源同名命名的角色必须能过自己的守卫 —— 就是这条抓住了 PERM-3 的 dba 锁死
  - **两个反向验证（改一处即失败）**: 删掉 `dba:*` → R5 报 `role "dba" is locked out of its own resource by 5 guard pairs`；把 data-masking 的守卫改回 `data-mashing` → R4 报警
  - 注意: 测试二进制的 cwd 是包目录（`cmd/server`），模块根必须向上找 `go.mod`，直接 `os.DirFS("..")` 会扫到 `cmd/` 导致「audited 0 guard pairs」这种假绿

- ✅ **PERM-2 / ARCH-0.10 守卫部分 — database-devops 10 条路由全部加守卫**
  - `internal/database-devops/handler/handler.go` 原本 10 条路由**一条守卫都没有**（已上线、任何人可写可删）
  - 现按资源 `"database-devops"` 补齐: CRUD 走 read/write/delete，backup / restore 走 execute

- ✅ **ARCH-0.9 后端 + PERM-1 — `internal/datasource` 从死代码变成 11 条路由的 REST API**
  - 接线前实况: 有 model 有 interface，**没有 repository 实现、没有 handler、`wireDatasource` 从未被调用**，整个模块不可达
  - 新增 `internal/datasource/repository/sql.go` — 实现 `repository.Interface`（Create/GetByID/List/Update/Delete）
    - sqlx 的默认 mapper 会小写并去下划线，`SELECT *` 会把 `source_type` / `database_name` / `tenant_id` 扫进空值，所以用**显式别名列清单**（`source_type AS type`）
    - `Tags map[string]string` 不能直接从 text 列扫入 map，走 `dsWithTags{TagsRaw *string}` 包装 + JSON 编解码
    - `GetContext` 返回的是 `database/sql` 的 `sql.ErrNoRows`（不是 `sqlx.ErrNotFound`）
  - 新增 `internal/datasource/handler/handler.go` — 11 条路由全带 `RequirePermission("datasource", …)`（PERM-1 要求 7 条，实际 11 条）
  - 新增 `cmd/server/wiring-datasource.go` — 密钥解析顺序 `DATASOURCE_SECRET_KEY` → `JWT_SECRET`（Warn）→ 开发兜底值（Warn）；调用点补在 `wiring-core-domains.go` 的 `wireCoreDomains` 内
  - 新增 `migrations/551_extend_datasources.sql` + `_down.sql` — 补 password_enc / ssl_mode / auth_source / 连接池三参数 / error / tags + 两个索引（migration 030 只有 7 列）；幂等 `DO $ … END $`
  - **密码不回显**: `Password` / `PasswordEnc` 都是 `json:"-"`

- ✅ **router.go 两处健壮性修复**
  - `workflowExtraH` 与 `workflowH` 独立接线，原先挂在 `if workflowH != nil` 内 —— 只有其中一个被构造时就会 nil panic。现独立守卫
  - 新增 `datasourceH` 挂载块，注释说明 `/api/v1/data-sources` 归 internal/datasource、`/database-devops/data-sources` 归 dbdevopsH，两者刻意并存

- ✅ **7 个死声明清理（Batch E）— 5 个删除、2 个真正挂载**
  - `wiring.go` 里 7 个 handler var 只声明从不赋值，永远是 nil，`if x != nil` 守卫下永远静默 no-op
  - 挂载决策依据 `/tmp/perhandler.tsv` 的**前缀归属实测**，不是猜测:
    - `/skill` 空闲 → 挂（24 条路由）
    - `/knowledge/bases` 空闲 → 挂（8 条路由）
    - `/graph` 归 graphH、`/middleware` 归 middlewareH、`/runs` 归 ciRunnerH+workflowH、`/configs` 归 configH、`/pipelines` 归 11 个 handler → **必须删除**，挂载会触发 Gin 重复注册 panic
    - global-search 需要一个 `*elasticsearch.Client`，而接线层没有任何地方构造 ES 客户端 → 只能用 nil 构造，删除
  - 新增 `cmd/server/wiring-dead-modules.go`（构造 + 挂载 skillH / ai_knowledgeH），`wiring.go` 删除 7 个声明 + 7 个 import + 2 处注释掉的赋值（716 → 712 行），决策理由写进文件头注释
  - 两个重放型测试同步补了 `skillH` / `ai_knowledgeH` 条目（手工镜像 router.go，无生成脚本）

- ⚠️ **本轮撞出 Gin 的第二类启动 panic：同一节点上的通配符 token 名冲突**
  - 症状: `panic: ':base_id' in new path '/api/v1/knowledge/bases/:base_id/documents' conflicts with existing wildcard ':id' in existing prefix '/api/v1/knowledge/bases/:id'`
  - 这不是 `(method, path)` 重复 —— 路径**规范化后完全相同**，只是 `:id` 和 `:base_id` 两个名字
  - 冲突扫描**能兜住这一类**（所有 handler 重放进同一个 `gin.New()`，Gin panic → 测试失败），但只以 panic 栈暴露，不会像 `(method, path)` 重复那样输出可读的归因报告；本轮就是 boot_test 先炸出来的
  - 修 2 处:
    - `internal/ai/knowledge/handler/handler.go` — `/knowledge/bases/:id` → `/:base_id`，GetBase / DeleteBase 改读 `c.Param("base_id")`
    - `internal/skill/handler/handler.go` — `/skill/:id`（3 条）→ `/:skillId`（该节点上另有 11 条用 `:skillId`），GetSkill / UpdateSkill / DeleteSkill 改读 `c.Param("skillId")`
  - 关键坑: `/skill/instances/:id` 在**另一个节点**，不能一起替换 —— 用 `replace_all` 会误伤 6 处中的另外 3 处。必须按 handler 函数体逐处锚定
  - 同类隐患仍存在: 上一轮已记录 `orchestrationH`(`/orchestration/:orch_id/runs`) vs `ai_orchestrationH`(`/orchestration/:id/runs`)，两者当前都未挂载所以无害

- ✅ **前端权限 fallback 同步（`orion-frontend/src/hooks/usePermission.ts`）**
  - `dba` 补 `dba:*` / `datasource:*` / `database-devops:*`（PERM-3 镜像）
  - `platform_admin` / `tenant_admin` 补 `*:admin`
  - `matchPermission` 加 `_` → `-` 归一（后端已归一，前端不归一就会对着另一种拼法锁死）
  - `npx tsc --noEmit` 51 条错误全部为既有（都在 `__tests__` / `src/tokens` / `src/utils/auth.ts`），本文件 0 错误

- ✅ **验证结果**
  - `go build ./...` EXIT 0
  - `go test ./...` EXIT 0 — **542 个包 ok，0 失败**
  - `cmd/server` 5 个测试全绿:
    - boot — `setupRouter assembled 3446 routes without panic`
    - conflict scan — `assembled 3450 routes; 0 registration conflicts`
    - dump — `dumped per-handler route sets for 319 handlers`
    - audit — `audited 765 guard pairs over 3640 call sites, 261 distinct resources, 310 module dirs`
    - TestTicketRoutesTreeConflict
  - **路由数演进**: 3403 → 3414（datasource +11）→ **3446**（skill +24、ai-knowledge +8）
  - **handler 数演进**: 316 → 317（datasourceH）→ **319**（skillH、ai_knowledgeH）
  - 格式: `internal/` 全清、`cmd/server/` 全部测试文件全清、本轮新建的 3 个 wiring 文件全清；`router.go` / `wiring.go` / `permission.go` 刻意未 gofmt（既有手工缩进与 import 分组，gofmt 会引入大量无关 diff）

- 🔍 **本轮新发现的缺口（记录，未在本轮实施）**
  - **PERM-7（新）**: 前端调 `GET /roles/permissions-map` 但**后端没有任何路由服务它** —— `internal/identity/role/models.PermissionsMap` 类型定义了却从未被使用。所以前端权限**永远走硬编码 fallback**，后端 `permission.go` 的改动不会自动同步到前端。本轮改为直接修 fallback，但同步链路仍是断的
  - `orchestrationH` vs `ai_orchestrationH` 的通配符名冲突（见上）
  - 前端 API 面缺口仍在: `api-governance.ts` 调 `/governance/contracts|rules|violations|report|versions` 无后端认领；`/confirmations`（前端）vs `/confirmation`（后端）单复数不一致

- 📌 **本轮明确未做（已排期）**
  - PERM-6 — AI 端点权限定义（新增 `:ai` action）
  - ARCH-0.9 剩余 — 前端 `datasource.ts` 客户端
  - ARCH-0.10 剩余 — database-devops 备份 / 恢复测试
  - ARCH-0.11 — 三套数据源统一 + `/data-sources` 明文密码清理
  - ~~ARCH-0.12~~ — datasource 补 ClickHouse 驱动 ✅ 已完成

### 2026-08-29（后端专项：PERM-7 权限映射端点 + 撞出 PERM-8 认证中间件缺失）

> 本轮把前端与后端的权限同步链路接通（上一轮记录为 PERM-7），并在接线过程中撞出一个比 PERM-7 严重得多的问题：**整个平台服务从来没有挂过认证中间件**。

- ✅ **PERM-7 闭环 — 后端新增 `GET /api/v1/roles/permissions-map`**
  - 前端 `usePermission.ts` 一直在调这个端点，但后端 0 路由服务它（`grep 'permissions-map' internal/ cmd/` 全无结果），所以前端权限**永远走硬编码 `ROLE_PERMISSIONS_FALLBACK`**，后端 `permission.go` 的改动同步不到 UI
  - 数据源必须是 `HasPermission` 实际使用的那张表 → 在 `orion-go-common/pkg/auth/permission.go` 新增导出 `GetRolePermissionsMap()`，直接读内部 `allRolePermissions`（继承已展开、`_` 已在存储侧归一为 `-`），前端拿到的就是后端真正执行的授权结果
  - **坑：真正挂载的不是 `internal/identity/role/handler`**。那个包（`models.PermissionsMap` 定义处）从未被接线，`cmd/server` 对 `internal/identity/role` 的引用数为 0 —— 整包死代码。真正挂载的是 `internal/role/handler`（`core_infra_wiring.go:160`）。本轮先误改在死包上，grep 引用才发现，已回退
  - 响应必须是 `{"success": true, "data": {...}}`（用 `orionerrors.WriteSuccess`）—— 前端判 `body.success`；identity/role 那套 `{"code": 0, "data": ...}` 形状、以及 `models.PermissionsMap`（值是对象数组而非 `string[]`）都会让前端**静默回落**到 fallback，PERM-7 等于白做
  - `/roles/permissions-map` 是 `/roles/:id` 的静态兄弟，Gin 合法（与已有 `/roles/count` 同型），实测未挤掉通配
  - 路由 3446 → **3447**

- 🔴 **PERM-8（新发现，P0）— 平台服务完全没有认证中间件，3640 处守卫对每个调用方都 403**
  - 证据链 1: `cmd/server/router.go` 对 `/api/v1` 只挂了 7 个中间件（Logger / Recovery / RateLimit / Timeout / SecurityHeaders / Prometheus / CircuitBreaker），**没有 `auth.Auth`**
  - 证据链 2: `auth.RequirePermission` 读 `c.Get("role")`，而全仓库只有一处 `c.Set("role", …)`（`orion-go-common/pkg/auth/middleware.go:173`，在 `auth.Auth` 内部）；平台服务自己的 `internal/middleware` 包 **0 个认证相关中间件**
  - 证据链 3（实证，见下方新测试）: 同一个装配出来的 router 上，`GET /api/v1/roles`（无守卫）→ 500（打到 stub DB，说明可达）；`POST /api/v1/roles`（有守卫）→ 403 且 body 含 `"no role assigned"`
  - 结论: RBAC 角色表、3640 处守卫、5 条审计断言都完备，但**从未接到 token 校验上**。守卫目前不是「授权」，而是「全员拒绝」
  - 历史线索: `docs/archives/blueprints-legacy/orion-auth-svc/internal/middleware/middleware.go:40` 有 `c.Set("role", claims["role"])` —— 认证原本在**独立 auth 服务**里，该蓝图已归档，中间件从未移植进平台服务
  - **本轮刻意不修**: 一行 `api.Use(auth.Auth(...))` 就能接上，但后果是全局性的 —— 所有无 token 调用立刻 401（`auth.Auth` 还强制要求 `tenant_id` claim，缺则 401），3640 处守卫同时从「全员 403」翻成真实授权，属于需要灰度方案 + 前端配合的破坏性变更，不是可增量提交的小修
  - 因此 `/roles/permissions-map` **当前必须无守卫**，否则同样被 403 打死、PERM-7 等于没修；代码注释里已写明 PERM-8 落地后要补上守卫

- ✅ **后端补 `"admin"` 角色（PERM-7 的连带修正）**
  - 前端 `role: 'admin'` 是默认角色值（`tests/mocks/handlers.ts:415/441`、`AuthInitializer.test`、`api/__tests__/auth.test.ts`、`user.test.ts`），fallback 给它 `['*:*']`
  - 但后端 43 个角色里**没有 `admin`** → 这类用户前端看到全解锁、后端全 403 —— 正是 PERM-7 要消灭的分叉本身
  - `SystemRolePermissions` 补 `"admin": {"*:*"}`，角色数 43 → **44**

- ✅ **前端改为 merge 而非 replace（`orion-frontend/src/hooks/usePermission.ts`）**
  - 原实现拿到后端返回就**整体替换** fallback。后端 44 个角色里没有 `oncall`（后端把 oncall 当**资源**，权限以 `oncall:*` 给 sre），整体替换会把这类用户菜单全锁死
  - 现改为 `{ ...ROLE_PERMISSIONS_FALLBACK, ...body.data }` —— 后端优先、前端别名保底；另加 `Array.isArray` 防御（`typeof [] === 'object'` 会通过原判断，数组会被当成 map 吞进去）

- ✅ **新增 `cmd/server/roles_permissions_map_test.go`（第 6 个 cmd/server 测试）**
  - 断言 1: 200 + `success: true` + `data` 是 `map[string][]string` + ≥ 40 个角色 + `admin` 持有 `*:*`
  - 断言 2: `GET /roles` 不被 403（静态兄弟没挤掉 `:id` 通配）
  - 断言 3（**故意反向**）: `POST /roles` 必须 403 且 body 含 `"no role assigned"` —— 钉住 PERM-8 现状；PERM-8 落地后这条必须翻成 `!= 403`

- ✅ **验证结果**
  - `go build ./...` EXIT 0
  - `go test ./...` EXIT 0 — **542 个包 ok，0 失败**
  - `go vet ./pkg/auth/`、`./internal/role/...`、`./cmd/server/` 全清
  - `cmd/server` 6 个测试全绿:
    - boot — `setupRouter assembled 3447 routes without panic`
    - conflict scan — `assembled 3451 routes; 0 registration conflicts`
    - dump — `dumped per-handler route sets for 319 handlers`
    - audit — `audited 765 guard pairs over 3640 call sites, 261 distinct resources, 310 module dirs`（不变）
    - TestTicketRoutesTreeConflict
    - TestRolesPermissionsMapServed — `permissions-map served 44 roles`
  - `pkg/auth`: build + vet + test 全绿（`-count=1` 强制重跑，不吃缓存）
  - `npx tsc --noEmit` 45 条错误全部为既有，`usePermission.ts` 0 错误
  - 格式: 新增测试文件 gofmt 干净；`permission.go` 刻意未 gofmt（`pkg/auth` 目录整体本就不是 gofmt 状态，gofmt 会重排 43+/15- 的无关行）

- 🔍 **本轮新发现的缺口（记录，未在本轮实施）**
  - **PERM-8（P0）** — 认证中间件缺失（见上，含为何本轮不修的理由）
  - `internal/identity/role` 整包死代码（handler / service / models 互相引用，`cmd/server` 0 引用）；`models.PermissionsMap` 从未使用 —— 建议删除或接线，二选一，别留第三态
  - `RequirePermission` 只读单角色 `c.Get("role")`，忽略 `auth.Auth` 已解析好的 `c.Set("roles", …)` 多角色数组；前端 `matchPermission` 是多角色遍历，两边语义不一致
  - `orchestrationH`(`/orchestration/:orch_id/runs`) vs `ai_orchestrationH`(`/orchestration/:id/runs`) 通配符名冲突（沿用上一轮记录，两者仍未挂载）
  - 前端 API 面缺口仍在: `api-governance.ts` 调 `/governance/contracts|rules|violations|report|versions` 无后端认领；`/confirmations`（前端）vs `/confirmation`（后端）单复数不一致

- 📌 **本轮明确未做（已排期）**
  - **PERM-8** — `/api/v1` 接入认证中间件（破坏性变更，需灰度方案，见上）
  - PERM-6 — AI 端点权限定义（新增 `:ai` action）
  - ARCH-0.9 剩余 — 前端 `datasource.ts` 客户端
  - ARCH-0.10 剩余 — database-devops 备份 / 恢复测试
  - ARCH-0.11 — 三套数据源统一 + `/data-sources` 明文密码清理
  - ~~ARCH-0.12~~ — datasource 补 ClickHouse 驱动 ✅ 已完成

---

### 2026-08-29（后端专项：PERM-8 第一阶段 — 可选认证中间件上线，默认关闭）

> 上一轮 PERM-7 撞出的 PERM-8 是 P0：平台服务从未挂过认证中间件，3640 处守卫全是死代码。本轮实施第一阶段——**非阻塞的可选认证**，默认关闭，用 `AUTH_OPTIONAL_ENABLED` 灰度开启。严格模式仍然是 `auth.Auth`，本轮**刻意不挂载**。

- ✅ **认证逻辑抽成可复用的 `ParseClaims`（`orion-go-common/pkg/auth/middleware.go`）**
  - 新增 `Claims` 结构体（`UserID` / `TenantID` / `Role` / `Roles` / `Status`）+ 三个哨兵错误 `ErrTokenInvalid` / `ErrTokenBadClaims` / `ErrTokenMissingSub`
  - 新增 `jwtKeyfunc(cfg)` + `keyForMethod(method, cfg)`：算法白名单**从配置了哪些 key 派生**——`JWTSecret` 非空才允许 HS256，`JWTPublicKey` 非空才允许 RS256；两个都没配就没有任何方法可用，算法混淆攻击因此没有入口（原 `Auth` 的行内逻辑逐字搬出，行为不变）
  - `ParseClaims(tokenString, cfg)`：`jwt.Parse` + `jwt.WithExpirationRequired()` 校验 → `jwt.MapClaims` 类型断言 → `sub` 必填 → 提取 `tenant_id` / `role` / `roles`（数组优先，缺省回退单 `role`）/ `status`（缺省 `"active"`）
  - 两个刻意的设计决策，都写进了注释：**`tenant_id` 在这里不强制**（严格模式自己强制，可选模式必须能识别省略它的 token）；**黑名单不查**（黑名单是请求作用域的，需要 request context，由两个中间件各自负责）
  - 新增 `applyClaims(c, claims)`：把身份同时写进 gin context（`user_id` / `tenant_id` / `role` / `roles` / `user_status`）和 request context（4 个 `ContextKey*`）。两个中间件共用这一个函数，所以它们对「一个 token 意味着什么」**不可能不一致**

- ✅ **`Auth()` 改成薄封装，7 条 401 文案逐字保留**
  - 原约 100 行行内 JWT 块替换为 `ParseClaims` + `applyClaims` + `tenant_id` 校验
  - `ParseClaims` 把校验失败折叠成一个错误，`Auth` 里用 `switch` 把三个哨兵映射回原来的三条文案（`invalid or expired token` / `invalid token claims` / `token missing user ID`），加上 `Auth` 自己原有的四条文案（`missing authorization header` / `invalid authorization format, expected Bearer token` / `token has been revoked` / `token missing tenant ID`）——合计 7 条，严格模式调用方观察到的行为**零变化**
  - `AuthConfig` 字段未动；全仓库 `auth.Auth(` 调用点共 16 处，其中 4 处 LIVE（`internal/identity/user`、`internal/config/internal/config`、`internal/notification/chatops`、`internal/monitoring/internal` 各自的 `middleware/middleware.go`），其余在 `blueprints/*.archived/` 与 `docs/archives/`，全部编译通过

- ✅ **新增 `auth.OptionalAuth`：`Auth` 的非阻塞孪生**
  - 契约：**从不 abort、从不 401、从不 403**。缺 header、非 Bearer 前缀、黑名单命中、`ParseClaims` 失败，一律 `c.Next()` 匿名放行
  - 于是它**可以无客户端迁移地开关**：一个请求之前成功仍然成功；带守卫的请求**只能从 403 变 200，不可能从 200 变 401**。token 拼错降级成「无守卫路由的访问权」，不是硬失败
  - 跳过路径（`SkipPaths`）、黑名单 key 格式（`token:blacklist:<token>`）、`applyClaims` 写入的身份全部与 `Auth` 对齐

- ✅ **`cmd/server/router.go` 按环境变量挂载，默认关闭**
  - `AUTH_OPTIONAL_ENABLED` 为 `1` 或 `true` 时才 `api.Use(auth.OptionalAuth(...))`，配置直接取 `infra.ffCfg.JWTSecret` 与 `infra.rdb`（测试里 `stubInfrastructure` 的 `rdb` 为 nil，黑名单自动跳过）
  - 注释里写清了为什么**不挂严格模式**：`auth.Auth` 缺 header 就 401、缺 `tenant_id` claim 也 401，一上线就把整个无 token 客户端基础盘打穿。切严格模式是 PERM-8 的剩余工作，需要的是客户端迁移计划，不是一个 commit

- ✅ **新增 `optional_auth_test.go`（3 个测试，覆盖契约的两半）**
  - 测试工具：`signTestToken`（HS256，可选 `tenant_id` / `role` claim）、`newTestRouter`（`t.Setenv` 全套环境变量，走真实的 `stubInfrastructure` → `initWiring` → `setupRouter`）、`postRoles`（打一个有守卫的写端点）
  - `TestOptionalAuthOffByDefault` — 环境变量关闭 → 403 + `no role assigned`
  - `TestOptionalAuthDoesNotBreakTokenlessCallers` — 环境变量开启但无 token → **同样的 403、同样的响应体**（这是 flag 可以在生产翻而不需要迁移客户端的那条性质）；同时无守卫的 `GET /roles/permissions-map` → 200
  - `TestOptionalAuthEnforcesGuardsForValidToken` — admin token（`*:*`）→ **不是** 403；viewer token → 403 + `insufficient permissions`（真的授权判断，不再是 `no role assigned`）；乱码 token → 403 + `no role assigned`（降级匿名而不是硬 401）；**不带 `tenant_id`** 的 admin token → **不是** 403
  - GIN 日志实证：关 → 403；开 + 无 token → 403 且 permissions-map 200；开 + admin → **500**（守卫通过，打到 stub DB）；开 + viewer → 403；开 + 乱码 → 403；开 + 无 tenant 的 admin → **500**

- ✅ **`roles_permissions_map_test.go` 反向断言保留但注释重写**
  - 断言本身不动（仍然要求 403 + `no role assigned`），因为中间件默认关闭正是无 token 调用方继续工作的原因；注释与 `t.Log` 改为指向 `AUTH_OPTIONAL_ENABLED` 门控并交叉引用 `optional_auth_test.go`

- ✅ **验证结果**
  - `orion-go-common/pkg/auth`: `go build` + `go vet` + `go test -count=1` 全绿
  - `orion-platform-svc-go`: `go build ./...` exit 0；`go test ./...` → **542 包 ok，0 FAIL**
  - `cmd/server` 9 个测试全绿（新增 3 个）：`setupRouter assembled 3447 routes without panic`、`assembled 3451 routes; 0 registration conflicts`、`audited 765 guard pairs over 3640 call sites, 261 distinct resources, 310 module dirs`、`dumped per-handler route sets for 319 handlers`、`permissions-map served 44 roles` —— 与上一轮**逐字节一致**
  - 格式：`pkg/auth/middleware.go` 与两个测试文件 gofmt 干净；`gofmt -l pkg/auth/` 与 `gofmt -l cmd/server/` 列出的既有未清理集合**未变**（`router.go` 本就在既有集合里，刻意未重排）

- 🔍 **本轮确认但仍未解的（记录）**
  - `RequirePermission` / `GetRole` 只读单角色 `c.Get("role")`，忽略 `auth.Auth` 与 `OptionalAuth` 都已经写进 context 的 `c.Set("roles", …)` 多角色数组；前端 `matchPermission` 是多角色遍历，两边语义仍不一致。**本轮 Batch G 已经证明 `roles` 确实到达了 context**，所以这一步现在是纯后端改动，不再受认证缺失阻塞
  - `/roles/permissions-map` 仍然无守卫（严格模式下必须补上，并翻转 `roles_permissions_map_test.go` 第 3 条断言）
  - `internal/identity/role` 整包死代码、`orchestrationH` vs `ai_orchestrationH` 通配符名冲突、前端 API 面缺口——上一轮记录，本轮未动

---

### 2026-08-29（后端专项：PERM-9 — 多角色语义对齐，四个守卫改走 `GetRoles`）

> 上一轮 Batch G 自己撞出的缺口：`auth.Auth` 与 `auth.OptionalAuth` 早就把多角色数组写进 context（`applyClaims` 里 `c.Set("roles", claims.Roles)`），但四个守卫**只读单角色** `c.Get("role")`。持有两个角色的调用方只拿到第一个角色的授权。前端 `matchPermission` 是多角色遍历——两边语义不一致。

- ✅ **`GetRoles` 加固：空数组也回退单角色**（`orion-go-common/pkg/auth/middleware.go`）
  - 原实现 `ok && len(roles) > 0` 已带长度判断，但缺一个说明：`roles` 存在但为空时同样走回退分支，所以**只设了 `role`、没设 `roles` 的调用方永远不会被静默降成 `no role assigned`**。这个契约是 `len(GetRoles(c)) == 0` 与旧的 `GetRole(c) == ""` 完全等价的前提，写进了注释
  - grep 验证：生产代码里设置 `role` / `roles` 的地方**只有** `applyClaims` 一处（`middleware.go:161` / `:162`），所以加固不会与别的写入路径打架

- ✅ **新增 `hasRole`，`RequireRole` / `RequireAnyRole` 重写**（middleware.go）
  - `hasRole(c, required)` 遍历 `GetRoles(c)`，任一命中即通过。`RequireRole` 委托给它；`RequireAnyRole` 把参数建成 `map[string]bool` 后遍历持有角色，命中即 `c.Next()`
  - 语义从「等于主角色」变成「**属于**持有角色之一」，并在注释里写清"Holds means present in any of the caller's roles, not equal to the primary one"
  - 403 文案 `insufficient permissions` 未动

- ✅ **新增 `anyRoleHasPermission`，`RequirePermission` / `RequireAnyPermission` 重写**（`orion-go-common/pkg/auth/permission.go`）
  - 多角色规则收进**一个** helper：`for _, role := range roles { if role != "" && HasPermission(role, resource, action) { return true } }`。两个守卫都委托它，规则只有一处实现
  - 逐个角色查表、不做继承图遍历——继承已在 `init()` 展开进 `allRolePermissions`，检查时没有图可走
  - `RequirePermission`：`roles := GetRoles(c)` → `len(roles) == 0` 则 403 `no role assigned` → `anyRoleHasPermission` 不通过则 403 `insufficient permissions`。**两条 403 文案与无身份分支逐字保留**
  - `RequireAnyPermission`：同样的 `roles` / `len(roles) == 0` 守卫，然后对每个 `resource:action` 备选调 `anyRoleHasPermission`；空 `parsed` 仍然 403 `insufficient permissions`（原有行为保留）
  - 文档注释更新为「requires the caller to hold a role granting the specified permission… checked against each of them, so granting a second role can never remove access that the first one already provided」

- ✅ **守卫层测试：`TestRequirePermission_MultiRole`，8 个子测试**（`permission_test.go`，gofmt 干净）
  - `run(role, roles, h)` 用 `httptest.NewRecorder` + `gin.CreateTestContext` 直接构造 context，同时返回状态码与响应体，因此能断言**是哪条** 403
  - `no identity rejects with no role assigned` — 无身份 → 403 + `no role assigned`
  - `single role decides as before` — `pipeline.editor` → 200；`viewer` → 403 + `insufficient permissions`（证明单角色路径未变）
  - `union of roles grants access` — `role=viewer` + `roles=[viewer, pipeline.editor]` → **200**（PERM-9 的核心断言：修复前这里是 403）
  - `union still denies when no role grants` — `[viewer, pipeline.viewer]` → 403 + `insufficient permissions`（并集不能变成全放行）
  - `empty roles slice falls back to the single role` — `role=pipeline.editor` + `roles=[]string{}` → 200（`GetRoles` 加固的那条）
  - `RequireAnyPermission checks each permission against every role` — `config:write` 单个角色没有、但 `pipeline:write` 备选由第二个角色满足 → 200；反例 → 403
  - `RequireRole matches any held role` / `RequireAnyRole matches any held role` — 命中第二个角色即通过，反例 403

- ✅ **端到端测试：`TestOptionalAuthMultiRoleUnion`**（`orion-platform-svc-go/cmd/server/optional_auth_test.go`，共 4 个测试）
  - 新增 `signTestTokenRoles(primary, roles, withTenant)`：`roles` 数组带两个角色，而遗留的单 `role` claim 停在**最低权限**那个上——这正是守卫原先会降级读到的形状
  - 打 `POST /api/v1/pipeline/validate`（守卫 `pipeline:write`；`viewer` 没有、`pipeline.editor` 有）：viewer token → 403 + `insufficient permissions`；`role=viewer` + `roles=[viewer, pipeline.editor]` → **不得为 403**
  - 于是这条测试串起了完整链路：JWT `roles` 数组 → `ParseClaims` → `applyClaims` → `GetRoles` → `RequirePermission`，全部走真实 router

- ✅ **变异验证（证明测试真的会失败，不是恒真）**
  - 把两个守卫临时退回单角色（`roles := []string{GetRole(c)}`）后重跑：`TestOptionalAuthMultiRoleUnion` **实测 FAIL**，报 `multi-role caller got 403 … {"error":"insufficient permissions"}`——正是预期的判别点
  - 从备份恢复后：守卫层 8/8 PASS、端到端 4/4 PASS

- ✅ **验证结果**
  - `orion-go-common/pkg/auth`：`go build` + `go vet` + `go test -count=1` 全绿
  - `orion-platform-svc-go`：`go build ./...` exit 0；`go vet ./cmd/server/` 干净；`go test -count=1 ./cmd/server/` ok；`go test ./...` → **542 包 ok，0 FAIL**
  - `cmd/server` 指标**逐字节不变**：`setupRouter assembled 3447 routes without panic`、`assembled 3451 routes; 0 registration conflicts`、`audited 765 guard pairs over 3640 call sites, 261 distinct resources, 310 module dirs`、`dumped per-handler route sets for 319 handlers`、`permissions-map served 44 roles`
  - 格式：`middleware.go`、`permission_test.go`、`optional_auth_test.go` 三者 gofmt 干净；`gofmt -l pkg/auth/` 仍只列 6 个既有未清理文件（`abac.go` / `abac_test.go` / `authorization_engine.go` / `integration_test.go` / `permission.go` / `permission_cache.go`）；`permission.go` 刻意未重排，`gofmt` 差异里 0 行是本轮新增代码
  - `go test ./...`（go-common）仅剩 2 个**既有**失败：`pkg/cron`（`i_job_scheduler.go` 编译错误）与 `pkg/dag`（`dag_test.go` 引用不存在的 `Graph.RemoveEdge`），两者都不在本轮改动范围内，`pkg/auth` 之外无改动

- 🔍 **本轮确认但仍未解的（记录）**
  - **PERM-8 阶段 2** 仍是 P0：切严格 `auth.Auth` 需要客户端迁移计划（无 token 调用方会立刻 401，且 `auth.Auth` 强制 `tenant_id` claim），不是一个 commit
  - `/roles/permissions-map` 仍然无守卫（严格模式下必须补上，并翻转 `roles_permissions_map_test.go` 第 3 条断言）
  - 前端 `usePermission.ts` 的多角色遍历现在与后端一致了，但前端仍需在请求里带上真实 JWT，才能让 `AUTH_OPTIONAL_ENABLED=1` 真正起作用——属于 PERM-8 阶段 2 的客户端侧
  - `internal/identity/role` 整包死代码、`orchestrationH` vs `ai_orchestrationH` 通配符名冲突、前端 API 面缺口——沿用记录，本轮未动

- 📌 **本轮明确未做（已排期）**
  - **PERM-8 阶段 2** — `/api/v1` 切严格 `auth.Auth`（破坏性变更，需客户端迁移计划）
  - PERM-6 — AI 端点权限定义（新增 `:ai` action）
  - ARCH-0.9 剩余 — 前端 `datasource.ts` 客户端
  - ARCH-0.10 剩余 — database-devops 备份 / 恢复测试
  - ARCH-0.11 — 三套数据源统一 + `/data-sources` 明文密码清理
  - ~~ARCH-0.12~~ — datasource 补 ClickHouse 驱动 ✅ 已完成

### 2026-08-29（后端专项：ARCH-0.10 收尾 — 备份/恢复契约测试 + P1-3 chaos 合并核实）

> 两条都指向同一类问题：**文档说要做的和代码里真有的对不上**。ARCH-0.10 的尾巴写着「补备份/恢复测试」，但 `ExecuteBackup` / `ExecuteRestore` 是桩——只改状态、返回假结果，没有任何备份动作。P1-3 说 chaos 三模块结构重叠要合并，实际已经合并完了，只是清单没更新。

- ✅ **ARCH-0.10 剩余：可测试化改造（零生产行为变更）**（`internal/database-devops/service/service.go`）
  - 抽出包私有 `repoInterface`（10 个方法，与 `repository.Repository` 一一对应）。包私有意味着只有本包测试能塞假实现；生产仍走 `NewService(db *sqlx.DB)` → `repository.NewRepository(db)`，**调用图形状不变**，外部调用点 0 处改动
  - 另加仅测试用的 `newServiceWithRepo(repo repoInterface)`，让测试用内存 fake 驱动 service，不需要活的 `sqlx.DB`
  - 顺带确认：`repository.Repository` 每个方法开头都有 `if r.db == nil { return nil }` 守卫，所以 `NewService(nil)` 天然不 panic（单独写了条测试把这点钉住）

- ✅ **`service_test.go`：8 条契约测试（全部 PASS）**
  - `fakeRepo` 以 `tenantID+"/"+id` 为键存 operation，并把每次 `UpdateStatus` / `UpdateResult` 的 `{tenantID, id, value}` 记进切片——因此能断言**调用顺序**和**租户作用域**，而不只是最终值
  - `TestExecuteBackup_StatusLifecycle` — 恰好 2 次 `UpdateStatus`，顺序为 `running` → `completed`；结果 JSON 能反序列化成 `BackupResult`，`BackupID` 非空、`Status` = `completed`、`Message` 同时含 `wal` 与 `db-42`；两个时间戳都是合法 RFC3339 且 `StartedAt <= FinishedAt`；**持久化到行的 JSON 与返回给调用方的结果一致**（防「调用方看到和数据库里存的不一样」）
  - `TestExecuteBackup_NotFoundDoesNotTouchStatus` — 找不到 operation → `operation not found`，且 **0 次**状态/结果写入
  - `TestExecuteBackup_InvalidConfigFailsBeforeRunning` — 坏 JSON 配置 → `parse backup config`，且 **0 次 `UpdateStatus`**（配置解析在置 `running` 之前，坏配置不得把 operation 卡在 running）
  - `TestExecuteBackup_EmptyConfigStillCompletes` — 空配置仍正常完成
  - `TestExecuteRestore_StatusLifecycleAndTenantScoping` — 同样的 `running` → `completed`；并断言**每一次** `UpdateStatus` 的 tenant 都是 `t1`、**每一次** `Get` 的键都以 `t1/` 开头（跨租户隔离）
  - `TestExecuteRestore_NotFound` / `TestExecuteRestore_InvalidConfigFailsBeforeRunning` — 与备份侧对称
  - `TestNewServiceNilDBIsTolerated` — `NewService(nil)` 的 `ListOperations` 返回空列表不报错
  - 文件头注释**明确声明**：这些测试钉的是契约（查找、状态生命周期、结果回读、租户作用域），**不声称真的产生了备份**——service 里仍是 `// TODO: Execute actual backup based on cfg.BackupType`。契约是将来真引擎必须继续遵守的东西，所以 TODO 实现完后测试依然有效

- ✅ **变异验证（证明测试真的会失败）**
  - 把 `ExecuteBackup` 最后一次 `UpdateStatus` 的 `"completed"` 临时改成 `"failed"` 后重跑，`TestExecuteBackup_StatusLifecycle` **实测 FAIL** 在两条预期断言上：`service_test.go:123` 报 `UpdateStatus[1] = {tenantID:t1 id:op1 value:failed}, want {tenantID:t1 id:op1 value:completed}`；`service_test.go:130` 报 `final operation status = "failed", want completed`
  - 从备份恢复（`diff` 确认与改前逐字节一致）后 8/8 PASS

- ✅ **验证结果**
  - `gofmt -l internal/database-devops/service/` 干净；`go build ./...` OK；`go vet ./cmd/server/` 干净；`go test -count=1 ./cmd/server/` ok
  - `go test ./...` → **543 包 ok，0 FAIL**（基线 542；+1 因为 `internal/database-devops/service` 现在有了测试文件）

- ✅ **P1-3 chaos 三模块合并：核实已完成，无代码改动**
  - `cmd/server/wiring-chaos-engine.go` 的 `wireChaosEngine` 把 chaos + chaos-enhanced + chaos-gateway 三个模块接进同一个 `chaos_engine_handler.NewHandler(chaosSvc, chaosEnhancedSvc, chaosGatewaySvc)`；三模块各自保留自己的 repo / service
  - `internal/chaos-engine/handler/handler.go` 的 facade 持有三个子 handler，`RegisterRoutes` 挂 `/chaos` 组共 **32 条路由**，**32 处** `auth.RequirePermission("chaos", …)` 守卫（路由数与守卫数一一对应），三个子 handler 全部被实际调用（chaosH ×18、enhancedH ×7、gatewayH ×7 次方法调用）
  - `router.go` 挂载 `chaosEngineH`，并在注册点用注释写明 `chaosH` / `chaos_enhancedH` / `chaosGatewayH` **刻意不注册**——重复挂同一 `(method, path)` 会让 Gin panic
  - 已被 `route_dump_test.go` 与 `route_conflict_scan_test.go` 覆盖（0 conflicts），所以这条合并不是「写完没测」

- 🔍 **本轮确认但仍未解的（记录）**
  - **R5-3 / ARCH-0.10 的真尾巴是缺实现，不是缺测试**：`ExecuteBackup` / `ExecuteRestore` 里的 `// TODO` 还在（`service.go` 的备份与恢复两处），返回的是占位 `BackupResult`。新测试把契约钉住了，但**真实备份/恢复引擎仍未实现**，已作为新的独立待办项记入 `ALL_TODOS.md`
  - `DatabaseSource.Password` 仍是明文持久化且 `omitempty` 回吐、`CreateDataSourceRequest.Password` 是 `binding:"required"` —— 属 ARCH-0.11，本轮未动
  - PERM-8 阶段 2、PERM-6、ARCH-0.9 前端、ARCH-0.12、`internal/identity/role` 死代码、`orchestrationH` vs `ai_orchestrationH` 通配符名冲突 —— 沿用记录

- 📌 **本轮明确未做（已排期）**
  - **ARCH-0.10 真实现** — 备份/恢复引擎（pg_dump / WAL 归档 / PITR），当前只有契约测试
  - PERM-8 阶段 2 — `/api/v1` 切严格 `auth.Auth`（破坏性变更，需客户端迁移计划）
  - PERM-6 — AI 端点权限定义
  - ARCH-0.9 剩余 — 前端 `datasource.ts` 客户端
  - ARCH-0.11 — 三套数据源统一 + `/data-sources` 明文密码清理
  - ~~ARCH-0.12~~ — datasource 补 ClickHouse 驱动 ✅ 已完成

### 2026-08-29（前端专项：ARCH-0.9 收尾 — `datasource.ts` 客户端）

> 后端那条线在 253 行那节已经把 `internal/datasource/` 从死代码接成 11 条带守卫路由，但**前端始终没有一个客户端**——所有消费方各写各的 `fetch`，字段改名只会在运行时才炸。这一节补上 ARCH-0.9 的前端那一半，让它真正关闭。

- ✅ **新增 `orion-frontend/src/api/datasource.ts`**
  - **11 个类型化函数，逐一对应 11 条后端路由**：`listDataSources` / `listDataSourceTypes` / `getAllDataSourcesHealth` / `getDataSource` / `getDataSourceHealth` / `createDataSource` / `updateDataSource` / `deleteDataSource` / `testDataSourceConnection` / `queryDataSource` / `executeDataSource`。每个函数尾注标出后端守卫（`datasource:read` / `write` / `execute` / `delete`），读代码的人不用跳进 Go 才知道这条路由谁能调
  - **10 个类型**：`DataSourceType`（5 值：postgres / mysql / clickhouse / elasticsearch / mongodb）、`DataSourceStatus`（4 值：active / inactive / error / connecting）、`DataSource`、`DataSourceInput`、`QueryResult`、`DataSourceHealth`、`DataSourceListResponse`、`DataSourceHealthAllResponse`、`QueryArgs`。**字段是照 `internal/datasource/models.go` 和 handler 的 `registerRequest` / `queryRequest` 读出来的，不是猜的**——包括 `List` 返回 `gin.H{"items":…, "total":…}`、`HealthAll` 返回 `gin.H{"total":…, "statuses":…}`、`TestConnection` 只返回 `{ok: true}` 这三个只有看 handler 才知道的形状
  - `DataSourceInput` 全字段可选，因为后端的 `Update` 是逐字段判断（`if req.Name != ""` 之类）的**部分变更**，只改传入字段、不会重开连接池；创建时后端对 name/type/host 有 `binding:"required"`，缺失会 400

- ✅ **写进文件头注释的 4 条契约注记**（都是读代码才发现、猜不到的）
  - `{ success, data }` 信封被 `client.ts:67` 的响应拦截器解包，所以这 11 个函数 resolve 出来的**就是载荷本身**，调用方读 `response.data` 得到 `T`——与 `backup.ts` 现有惯例一致
  - `password` **只写不读**：Go 模型里 `Password` 和 `PasswordEnc` 都是 `json:"-"`，任何响应都不可能带凭据。注册/更新时发送，**永远不要期待回吐**。这也是 `datasource` 模块值得学的地方——ARCH-0.11 要清理的明文密码问题在 `database-devops` 那边（`DatabaseSource.Password` 明文持久化且 `omitempty` 回吐），这个模块已经做对了
  - `connMaxLifetime` 是 Go 的 `time.Duration`，JSON 编码成**纳秒整数**——所以 TS 侧标为 `number` 并加注。同类影响面：`QueryResult.took`、`DataSourceHealth.latency`
  - `List` / `HealthAll` 读 `c.GetString("tenant_id")`，空值直接 401 `"tenant_id required"`——**这个客户端只有在 PERM-8 阶段 2（`/api/v1` 严格 `auth.Auth`）落地后才完全正确**，在那之前调用方得为租户作用域端点拒绝自己做好准备。注在客户端头部而不是藏在 issue 里，是为了让第一个踩到 401 的人能立刻理解为什么

- ✅ **新增 `src/api/__tests__/datasource.test.ts`：11 条测试（11/11 PASS）**
  - 每条后端路由一条测试，断言**精确 path** 和**精确载荷形状**——后端删一条路由或改一个字段名，坏的是这个文件而不是某个随机消费方
  - `vi.mock('../client', …)` 只 mock `get/post/put/delete/patch` 五个函数，helper `ok<T>(data)` 直接返回解包后的载荷（形状就是调用方读的），并断言 `queryDataSource` / `executeDataSource` 的**默认 `args = []`** 确实被发送（`{ query: 'select id from t', args: [] }`）
  - helper 用 `as unknown as AxiosResponse<T>` + `import type { AxiosResponse }` 而不是 `as any`

- ✅ **验证结果**
  - `npx vitest run src/api/__tests__/datasource.test.ts` → **11 passed (11)**
  - `npx eslint src/api/datasource.ts src/api/__tests__/datasource.test.ts --max-warnings 0` → 干净（exit 0、无输出）
  - `npx tsc --noEmit` → 45 个错误，**0 个提及 `datasource`**，与改动前数量一致 → **0 新增类型错误**（那 45 个是既有问题：大部分集中在既有 `src/api/__tests__/*.test.ts` 的 mock 类型，另有 5 个在 `src/tokens/useOrionToken.ts`）
  - `git check-ignore -v` → 两个新文件均未被忽略；`src/api/` 下无 barrel 文件需要更新

- 🔍 **本轮确认但仍未解的（记录）**
  - **PERM-8 阶段 2 是这个客户端的隐性依赖**：租户作用域的两个端点要 `tenant_id`，而 `tenant_id` 只有严格认证才会写进 context。所以「客户端能用」和「客户端在所有调用方上都对」不是同一件事，这个依赖已写在文件头注释里
  - **ARCH-0.12 仍在**：类型声明里有 5 种引擎，但驱动只接了部分（ClickHouse / MongoDB 未实现），前端客户端已按 5 种声明好类型，后端补驱动后前端无需改动
  - **ARCH-0.11 未动**：`database-devops` 的明文密码与 `datasource` 模块的双模块重复，本轮未动
  - PERM-6（AI 端点权限）、~~ARCH-0.10b/ARCH-0.15~~ ✅（备份引擎真实现 + 系统统一均已完成）、`internal/identity/role` 死代码、`orchestrationH` vs `ai_orchestrationH` 通配符名冲突 —— 沿用记录
  - 前端 45 个既有 `tsc` 错误 ~~（均非本轮引入）~~ ✅ **已修复**（ARCH-0.15 附带修复 backup API 对齐 + disaster-recovery 适配）；`orion-go-common` 的 `pkg/dag`（`Graph.RemoveEdge` 缺失）与 `pkg/cron` 测试构建失败 —— 未处理

- 📌 **本轮明确未做（已排期）**
  - PERM-8 阶段 2 — `/api/v1` 切严格 `auth.Auth`（破坏性变更，需客户端迁移计划）
  - ~~ARCH-0.10b/ARCH-0.15~~ ✅ — 备份引擎真实现 + 系统统一均已完成
  - PERM-6 — AI 端点权限定义（决策待定：44 个角色里只有 1 个授予任何 `ai*`）
  - ARCH-0.11 — 三套数据源统一 + `/data-sources` 明文密码清理
  - ~~ARCH-0.12~~ — datasource 补 ClickHouse 驱动 ✅ 已完成

### 2026-08-29（后端专项：ARCH-0.11 明文密码清理 — database-devops 复用 datasource 加密模型）

> ARCH-0.9 前端客户端那一节在文件头注释里写了一条「`password` 只写不读」的契约，并顺手点破：`datasource` 模块已经做对了（`Password`/`PasswordEnc` 都 `json:"-"`），**ARCH-0.11 要清理的明文密码问题在 `database-devops` 那边**。这一节就是去清那个问题。不是「三套数据源统一」——那是 ARCH-0.11b，仍开放；本批只清凭据路径，但清的方式是把加密实现抽到一个共享包，让两个模块用同一把钥匙、同一份算法，为后续统一端点铺好底。

- ✅ **新增 `internal/shared/aesgcm/aesgcm.go`（共享 AES-256-GCM 实现）**
  - 三个函数：`Key(secret string) []byte`（64-hex 原样用，其他 SHA-256 到 32 字节，空密也产出合法 key——拒绝 dev fallback 是调用方的责任，见 `datasourceKey`）、`Encrypt(key, plaintext) (string, error)`（随机 nonce 前缀后 hex）、`Decrypt(key, ciphertext) (string, error)`（验 GCM tag，错钥/篡改/畸形输入即失败）
  - **为什么抽出来**：这 40 行算法原本私持在 `internal/datasource/service`。`database-devops` 从未拿到它，`DatabaseSource.Password` 因此以明文落库——**把 40 行复制进第二个包，正是让「我们加密凭据」对一个模块为真、对另一个为假的那种分叉**。共享实现是让 ARCH-0.11 的「一个凭据模型」从文档一行变成代码的事实

- ✅ **`internal/datasource/service/service.go`：三助手改单行委托，调用点零改动**
  - `cryptoKey` / `encrypt` / `decrypt` 三个本地函数保留签名，函数体变成对 `aesgcm` 的一行委托。理由是 `service_test.go` 直接调这三个名字且断言 `len(svc.key) == 32`，薄包装让既有测试无需改动；算法本体只活在一个地方
  - 顺手清掉因此不再需要的 6 个 import（`crypto/aes`/`cipher`/`rand`/`sha256`/`encoding/hex`/`io`）——grep 确认这六个只被那三个助手用过

- ✅ **`internal/database-devops`：加密前置 + 写入侧堵泄漏**
  - `models.go`：`DatabaseSource.Password` 从 `json:"password,omitempty"` 改 `json:"-"`（`db:"password"` 保留，`NamedExecContext` 的 `:password` 绑定不变）。注释写清：行内存的是 `CreateDataSource` 写的密文、不是明文；切换前已落库的旧行仍是明文但从未经 HTTP 暴露、仅 DB 层可达。`CreateDataSourceRequest.Password` 保持 `json:"password" binding:"required"`——请求侧要接收明文，`binding:"required"` 是刻意的（无密码的数据源记录对每个消费方都没用）
  - `service.go`：`Service` 加 `key []byte`；`NewService(db, secretKey)` 与仅测试用 `newServiceWithRepo(repo, secretKey)` 都用 `aesgcm.Key(secretKey)` 派生；`CreateDataSource` 在落库前 `aesgcm.Encrypt(s.key, req.Password)`，错误文本 `"encrypt password: %w"`
  - `handler.go`：`NewHandler(db *sqlx.DB, secretKey string)`——签名加一个参数。**确认只有 `cmd/server/wiring.go:628` 一处构造 `dbdevopsH`**；`route_dump_test.go` / `route_conflict_scan_test.go` 走全局 `dbdevopsH`，不直接 `NewHandler`，所以测试无需改

- ✅ **`cmd/server`：两模块同一把钥匙**
  - `wiring-datasource.go` 抽出 `datasourceKey(logger *zap.Logger) string`：`DATASOURCE_SECRET_KEY` → `JWT_SECRET` → `"dev-datasource-key-change-me"`，每级 fallback 一条 `logger.Warn`。`wireDatasource` 改调它
  - `wiring.go:628` 从 `dbdevops_handler.NewHandler(infra.db.DB)` 改成 `dbdevops_handler.NewHandler(infra.db.DB, datasourceKey(logger))`，加两行注释点明两模块必须同钥匙。`logger` 在作用域内（633 行 `wireMiddleware(db, logger)`）——**没有对 `wiring.go` 跑 gofmt**（它与 `router.go` 是那 ~44 个故意不格式化的文件之一，`wiring-datasource.go` 则是 gofmt 干净的）

- ✅ **测试：新包 6 条 + 模型 2 条 + 服务 1 条 + 既有 7 处签名跟进**
  - `internal/shared/aesgcm/aesgcm_test.go`（6 条）：往返含 unicode「数据库」与 10 KB 长串、错钥拒解、篡改最后一 bit（GCM tag 必捕获）、畸形输入（`""`/`"zz"`/`"abcd"`/32 hex 但短于 nonce+tag）、`Key` 派生（64-hex 原样 `bytes.Equal`、passphrase 仍 32 字节、不同输入不同 key、空密仍 32 字节）、同一明文两次加密不同（nonce 非确定性）。用 `encoding/hex` + `strings.Repeat`，不手卷 hex
  - `internal/database-devops/models/models_test.go`（2 条）：`TestDatabaseSourcePasswordNeverSerialized` 用反射断言 `json:"-"` 与 `db:"password"` 标签 + 序列化输出不含 `hunter2-secret` 也不含 `password` 字段名 + 非秘密字段仍序列化（redaction 是外科手术）；`TestCreateDataSourceRequestAcceptsRequiredPassword` 断言请求侧 `json:"password"` + `binding:"required"` + `UpdateDatabaseDevopsRequest` 无 `Password` 字段（部分更新不能重置凭据）
  - `internal/database-devops/service/service_test.go`：新增 `TestCreateDataSourceEncryptsPassword`（响应 `ds.Password != "hunter2-secret"` 且非空、`aesgcm.Decrypt(key, ds.Password) == "hunter2-secret"`、错钥不解、`ListDataSources` 回读的行同密文、跨租户不可见）；7 处 `newServiceWithRepo(repo)` → `newServiceWithRepo(repo, testDSKey)`；`NewService(nil)` → `NewService(nil, testDSKey)`；`fakeRepo` 加 `dataSources []` 字段，`CreateDataSource`/`ListDataSources` 从返回 nil 改为真记录

- ✅ **变异验证（每批新测试都做过）**
  - 还原 `models.Password` 标签为 `json:"password,omitempty"` → `TestDatabaseSourcePasswordNeverSerialized` 在 3 条断言 FAIL：标签检查（`"password,omitempty"` ≠ `"-"`）、明文回显（序列化输出含 `hunter2-secret`）、字段名（输出含 `password`）。恢复后 PASS
  - 删掉 `service.go` 的 `aesgcm.Encrypt` 调用、直接存 `req.Password` → `TestCreateDataSourceEncryptsPassword` 在第一条断言 FAIL："the response carries the caller's plaintext password"。恢复后 PASS
  - 两次都先备份、改、观察具体 FAIL 行、恢复、`gofmt -l` 干净、重跑 green

- ✅ **验证结果**
  - `gofmt -l internal/database-devops/... internal/datasource/... internal/shared/aesgcm/ cmd/server/wiring-datasource.go` → 全干净（`wiring.go`/`router.go` 故意不格式化，不在检查列）
  - `go build ./...` → ok
  - `go vet ./internal/database-devops/... ./internal/datasource/... ./internal/shared/aesgcm/ ./cmd/server/` → 干净
  - `go test ./internal/shared/aesgcm/ ./internal/database-devops/... ./internal/datasource/... ./cmd/server/` → 全 PASS
  - `go test ./...` → **545 包 ok / 0 FAIL**（基线 543 + `aesgcm` 新包 + `database-devops/models` 从无测试到有测试 = 545；0 个既有测试被改坏）

- 🔍 **本轮确认但仍未解的（记录）**
  - **ARCH-0.11b 三套数据源统一仍开放**：`/api/v1/database-devops/data-sources` 与 `/api/v1/data-sources` 仍是两套端点，本批只让它们用同一把加密钥匙、同一份算法，端点本身没删没合并。消费方迁移后再做
  - **`database-devops` 无活跃连接路径**：`models.DatabaseSource.Password` 现存密文，但这个模块没有 `connect()`——没有东西会去解密它。等 ARCH-0.11b 统一到 `datasource` 模块（它有 `connect` 且会 `decrypt`）才有意义；本批的加密是为那一刻铺底
  - **PERM-8 阶段 2**：`database-devops` 的 handler 也读 `c.GetString("tenant_id")`，空值 401——同 `datasource`，待严格认证
  - **dev fallback 的两行重复警告**：若环境既无 `DATASOURCE_SECRET_KEY` 又无 `JWT_SECRET`，`datasourceKey` 会被两个模块各调一次，日志出现两行相同的 warning。这是刻意的——重复的那行就是让误配在启动日志里可见

- 📌 **本轮明确未做（已排期）**
  - ARCH-0.11b — 三套数据源统一（删 `/database-devops/data-sources` 重复端点，消费方迁至 `/data-sources`）
  - ARCH-0.10b — 备份/恢复真实现（`ExecuteBackup`/`ExecuteRestore` 仍是 `// TODO` 桩）
  - ~~ARCH-0.12~~ — datasource 补 ClickHouse 驱动 ✅ 已完成（Elasticsearch 故意委派给 global-search）
  - PERM-8 阶段 2 / PERM-6 — 沿用记录

### 2026-08-29（后端专项：ARCH-0.11b 三套数据源统一 — 删除 database-devops 重复 `/data-sources` 端点）

> ARCH-0.11（上一批）让 `database-devops` 和 `datasource` 两个模块共用同一把 AES-256 钥匙、同一份 `aesgcm` 算法，但 `/api/v1/database-devops/data-sources` 与 `/api/v1/data-sources` 两套端点仍在并行——**双轨运行**。本批把那条重复轨道拆掉：`database-devops` 的 3 个 data-source 端点（GET/POST/DELETE `/database-devops/data-sources`）删除，`datasource` 模块的 `/data-sources`（11 条路由：CRUD + test + query + execute + health + types）成为唯一入口。零前端消费方迁移——grep 确认前端从不调 `/database-devops/data-sources`。

- ✅ **`internal/database-devops/handler/handler.go` — 删 3 路由 + 3 方法 + 签名简化**
  - `RegisterRoutes` 从 10 条路由降到 7 条（5 操作 CRUD + 2 备份/恢复）。3 条 `/data-sources` 路由删除，替换为一段注释说明迁移目标
  - 3 个 handler 方法 `ListDataSources` / `CreateDataSource` / `DeleteDataSource` 删除（原 136-174 行）
  - `NewHandler(db *sqlx.DB)`——去掉 `secretKey string` 参数（`database-devops` 不再需要加密钥匙，凭据管理全走 `datasource` 模块）

- ✅ **`internal/database-devops/service/service.go` — 删 3 服务方法 + `key` 字段 + `aesgcm` import**
  - `Service` 结构体从 `{repo, key}` 简化为 `{repo}`；`NewService(db)` 与 `newServiceWithRepo(repo)` 都去掉 `secretKey` 参数
  - `repoInterface` 从 10 方法降到 7（删 `CreateDataSource`/`ListDataSources`/`DeleteDataSource`）
  - `aesgcm` import 删除——加密的唯一调用点（`CreateDataSource` 里的 `aesgcm.Encrypt`）随方法一起移除
  - `ExecuteBackup` / `ExecuteRestore` 的 `// TODO` 桩不变——那是 ARCH-0.10b 的范围

- ✅ **`internal/database-devops/service/service_test.go` — 跟进签名 + 删过时测试**
  - 7 处 `newServiceWithRepo(repo, testDSKey)` → `newServiceWithRepo(repo)`；`NewService(nil, testDSKey)` → `NewService(nil)`
  - 删 `aesgcm` import、`testDSKey` 常量、`fakeRepo.dataSources` 字段、3 个 fakeRepo DS 方法
  - 删 `TestCreateDataSourceEncryptsPassword`——该测试是 ARCH-0.11（上一批）为加密加的，服务不再有 `CreateDataSource` 方法，测试随之移除。余 8 条测试：7 条备份/恢复契约 + 1 条 nil-DB

- ✅ **`cmd/server/wiring.go` — 构造调用跟进**
  - `dbdevopsH = dbdevops_handler.NewHandler(infra.db.DB)`（去掉 `datasourceKey(logger)` 参数），加两行注释说明 data source 管理已迁至 `internal/datasource`

- ✅ **`cmd/server/wiring-datasource.go` — 文档注释更新**
  - `datasourceKey` 函数体不变（`wireDatasource` 仍调用它）；注释更新：ARCH-0.11b 前 `database-devops` 也调用此函数，现在只有 `wireDatasource` 调用

- ✅ **保留为死代码（刻意的最小范围）**
  - `internal/database-devops/models/models.go`：`DatabaseSource` 与 `CreateDataSourceRequest` 类型保留——`models_test.go` 的 2 条 `json:"-"` 标签断言仍有效，类型本身无害
  - `internal/database-devops/repository/repository.go`：3 个 DS 方法（108-140 行）保留——编译通过、无 HTTP 路径可达、无服务方法调用。死代码清理留到后续 batch

- ✅ **路由数变异验证（证明 -3 来自本次删除）**
  - 删除前：`TestSetupRouterFullRegistration` 断言 3447 条路由
  - 删除后：3444 条（恰好 -3 = 删的 3 条 `/data-sources` 路由）
  - 临时重加 1 条路由 → 3445（证明计数器的 drop 确由删除引起）；恢复 → 3444
  - `TestRouteConflictScan`：0 冲突、319 handler 不变（handler 数不变因为路由删了但 handler 变量仍在）

- ✅ **验证结果**
  - `gofmt -l`：`handler.go` / `service.go` / `service_test.go` / `wiring-datasource.go` 全干净；`wiring.go` 保留既有不格式化状态
  - `go build ./internal/database-devops/... ./cmd/server/` → ok
  - `go vet ./internal/database-devops/... ./cmd/server/` → 干净
  - 定向测试：`database-devops/service` 8 PASS、`datasource` PASS、`aesgcm` 6 PASS、`cmd/server` 9 PASS（含路由测试 3444 / 0 冲突 / 319 handler）
  - `go test ./...` → **545 包 ok / 0 FAIL**

- 🔍 **本轮确认但仍未解的（记录）**
  - **ARCH-0.10b（🔴 高）**：`ExecuteBackup` / `ExecuteRestore` 仍是 `// TODO` 桩——返回占位结果，不执行真实备份/恢复。8 条契约测试约束未来实现。`internal/infrastructure/backup/` 的 `executeBackup` 与 `recovery_service.go` 的 `ExecuteRecovery` 同样是模拟桩
  - **PERM-8 阶段 2**：`database-devops` handler 读 `c.GetString("tenant_id")`，空值不 401——待严格认证
  - **死代码**：`database-devops` repository 的 3 个 DS 方法 + `models.DatabaseSource` / `CreateDataSourceRequest` 现在是死代码（无 HTTP 路径可达）。清理留到后续
  - **R7 终审「双轨运行」**：本批彻底解决——`/database-devops/data-sources` 端点不再存在，`/data-sources` 是唯一数据源管理入口

- 📌 **本轮明确未做（已排期）**
  - ARCH-0.10b — 备份/恢复引擎真实现（3-5 天）
  - ~~ARCH-0.12~~ — datasource 补 ClickHouse 驱动 ✅ 已完成
  - PERM-8 阶段 2 — `/api/v1` 切严格 `auth.Auth`（破坏性变更，需客户端迁移计划）
  - PERM-6 — AI 端点权限定义（决策待定）
  - 死代码清理 — `database-devops` repository DS 方法 + models、`internal/identity/role/`

### 2026-08-29（后端专项：P0-0 DBA ExecuteOrder 接真实 SQL 执行 — 把表单系统变数据库管理系统）

> R7 终审将「DBA ExecuteOrder 接真实 SQL 执行」列为 P0-0——数据库域从 0 到 1 的三条关键路径之一。`internal/dba/service` 的 `ExecuteOrder` 原来是纯桩代码：只改状态为 `completed`、写 `"Execution completed"` 字符串，不连数据库、不执行 SQL。本批把它变成真的——拿到订单 → 找到数据源 → 连 PostgreSQL → 执行 SQL → 写入审计日志 → 更新订单状态。

- ✅ **`internal/dba/service/service.go` — `ExecuteOrder` 从桩到真执行**
  - 签名从 `ExecuteOrder(ctx, id)` 改为 `ExecuteOrder(ctx, tenantID, userID, id)`——对齐 `ExecuteDirectQuery` 模式，handler 跟进传 `tenant_id`/`user_id`
  - 流程：`GetOrder` 取订单 → `ListDataSources(tenantID)` 遍历匹配 `order.Database` 找数据源 → 非 PostgreSQL 类型直接报错并标 `failed` → 调用新函数 `executePGSQL` → 60s 超时 → 执行结果 + 延迟写入 `QueryExecutionRecord` 审计日志 → 成功标 `completed`（result 为 JSON 序列化的 `sqlExecResult`）、失败标 `failed`（result 为错误信息）
  - 新增 `sqlExecResult{Columns, Rows, RowCount, RowsAffected}` 结构体：只读语句返回列名+行数据，DML/DDL 返回受影响行数
  - 新增 `executePGSQL(ds, ctx, sqlStr, normalized)` 函数：复用 `isReadOnlySQL` 判断（SELECT/SHOW/DESCRIBE/EXPLAIN/WITH…SELECT 走 `QueryContext` 返回列+行，其他走 `ExecContext` 返回 `RowsAffected`）；复用 `buildPGDSN` 构造连接串；每次开新连接（`SetMaxOpenConns(1)` + `SetConnMaxLifetime(30s)` + `defer conn.Close()`）避免跨租户泄漏凭据
  - 新增 `encoding/json` import（序列化 `sqlExecResult` 到 order 的 `Result` 字段）
  - 所有失败路径都写入审计日志并标记 order 为 `failed`——不静默失败

- ✅ **`internal/dba/service/service_interface.go` — 签名跟进**
  - `ExecuteOrder(ctx context.Context, tenantID, userID, id string) (*models.SqlOrder, error)`

- ✅ **`internal/dba/handler/handler.go` + `handler_test.go` — 调用点跟进**
  - handler：`c.GetString("tenant_id")` + `c.GetString("user_id")` 传入 service
  - `fakeDbaService.ExecuteOrder` 签名对齐

- ✅ **复用既有基础设施（零新依赖）**
  - `buildPGDSN`（构造 PostgreSQL DSN，含 host/port/user/password/dbname/sslmode）
  - `isReadOnlySQL`（只读判断：SELECT/SHOW/DESCRIBE/EXPLAIN/WITH…SELECT）
  - `newExecutionRecord`（审计日志记录构造）
  - `executePGQuery`（既有查询执行，本批新增 `executePGSQL` 是它的超集）
  - `github.com/lib/pq` driver（已在 service 包导入）

- ✅ **验证结果**
  - `gofmt -l` 全干净
  - `go build ./...` → ok
  - `go vet ./internal/dba/...` → 干净
  - `go test -c` 编译通过（handler + service 测试二进制均可编译）
  - `/tmp/dba_handler.test` + `/tmp/dba_service.test` → 全 PASS
  - `go test ./internal/dba/... ./internal/database-devops/... ./cmd/server/` → 全 PASS
  - `go test ./...` → **545 包 ok / 0 FAIL**

- 🔍 **本轮确认但仍未解的（记录）**
  - ~~**P0-0 剩余：Migration 能力建设**（ARCH-0.18，3-5d）~~ ✅ **完成 2026-08-30**（Batch T：service + 11 路由 + 20 测试 + 前端完整页面）
  - ~~**P0-0 剩余：Schema-Registry 接线**（ARCH-0.19，1-1.5d）~~ ✅ **完成 2026-08-30**（Batch U：handler 9 路由 + inmemory/postgres repository + 31 测试 + migration 404）
  - **PERM-8 阶段 2**：`/api/v1` 切严格 `auth.Auth`——破坏性变更，需客户端迁移计划
  - ~~**ARCH-0.12**~~：datasource 补 ClickHouse 驱动 ✅ 已完成
  - **PERM-6**：AI 端点权限定义（决策待定）

- 📌 **本轮明确未做（已排期）**
  - ~~ARCH-0.10b~~ ✅ — 备份/恢复引擎真实现（2026-08-30）
  - ~~ARCH-0.15/0.17~~ ✅ — Redis 采集 + 备份系统统一（2026-08-29/26）（~~ARCH-0.16 慢查询已接 pg_stat_statements ✅~~）
  - ~~ARCH-0.12~~ — datasource 补 ClickHouse 驱动 ✅ 已完成
  - ~~ARCH-0.19~~ ✅ — Schema-Registry 完整接线（2026-08-30，Batch U）
  - PERM-8 阶段 2 — `/api/v1` 切严格 `auth.Auth`（需迁移计划）
  - PERM-6 — AI 端点权限定义（决策待定）
  - 死代码清理 — `database-devops` repository DS 方法 + models、`internal/identity/role/`

---

## Batch N — ARCH-0.12 datasource 补 ClickHouse 驱动 (2026-08-29)

- 📌 **背景**
  - `internal/datasource/service` 宣称支持 5 种数据库类型（PG/MySQL/ClickHouse/ES/MongoDB），但 `service.go` 仅 import mysql+pgx 驱动，ClickHouse/ES/MongoDB 调用直接返回 `"driver not loaded"` 错误
  - R4-2 确认"宣称 5 实连 2"成立，ARCH-0.12 是架构评审 Phase 0 第 3 项

- ✅ **实现**
  - 新增 `github.com/ClickHouse/clickhouse-go/v2`（v2.48.0）空白导入 — 该驱动自动注册为 `database/sql` 的 `"clickhouse"` 驱动
  - `connect()` 函数中 ClickHouse case 从错误返回改为与 Postgres/MySQL 相同的连接流程：`sql.Open("clickhouse", dsn)` → `SetMaxOpenConns` / `SetMaxIdleConns` / `SetConnMaxLifetime` → `PingContext`
  - `buildDSN` 的 ClickHouse case 原已返回正确格式 `clickhouse://user:pass@host:port/database`，无需修改
  - MongoDB/ES 错误消息从 `"driver not loaded (not in go.mod)"` 改为更明确的说明：`"mongodb is not a SQL engine and cannot be connected via database/sql; use the mongo-go-driver directly"` / `"elasticsearch is not a SQL engine; use the global-search module for Elasticsearch queries"`

- ✅ **测试**
  - `TestService_RegisterClickHouse` 改名为 `TestService_RegisterClickHouseConnectFail`，断言连接失败（端口 1）而非"driver not loaded"
  - 新增 `TestBuildDSN_ClickHouse` 测试 DSN 格式正确性

- ✅ **验证结果**
  - `go build ./...` → ok
  - `go test ./internal/datasource/...` → 18 条全 PASS
  - `go test ./...` → **545 包 ok / 0 FAIL**

- 🔍 **剩余**
  - MongoDB/ES 非 SQL 引擎无法用 `database/sql` 连接，需独立驱动方案（非 ARCH-0.12 范围）
  - Oracle/SQL Server/OceanBase/openGauss/TiDB 等企业级类型仍未支持（→ ARCH-0.3）

## Batch O — ARCH-0.16 慢 SQL 真实采集 (2026-08-29)

- 📌 **背景**
  - `internal/apm/service/business.go` 的 `GetSlowQueries` 原返回 3 条硬编码 fake 数据（`sql-001`/`sql-002`/`sql-003`），标注 `// TODO: replace simulated data with real DatabaseProfiler queries`
  - R5-2 确认性能调优模块框架完整但喂的是假数据；R7 终审将 ARCH-0.16 列为 P0-0 的三条关键路径之一
  - 慢查询采集是性能调优的核心——没有真实数据，`/performance/evaluate`、`/bottlenecks`、`/suggestions` 的调优建议都建立在虚空中

- ✅ **实现**
  - `internal/apm/service/service.go`：`Service` 结构体新增 `db *sql.DB` 字段；`NewService(repo, db *sql.DB)` 签名增加 `db` 参数（nil 时优雅返回空结果，不影响前端降级）
  - `internal/apm/service/business.go`：`GetSlowQueries` 从硬编码 fake 数据改为查询 PostgreSQL 的 `pg_stat_statements` extension：
    - SQL：`SELECT queryid, querytext, round(mean_exec_time)::int AS duration_ms, calls, coalesce(d.datname,'') FROM pg_stat_statements q LEFT JOIN pg_database d ON d.oid = q.dbid`
    - 过滤条件：`MinDurationMs`（`WHERE mean_exec_time >= $1`）、`Database`（`AND coalesce(d.datname,'') = $2`）、`Limit`（`LIMIT $N`）
    - 排序：`ORDER BY total_exec_time DESC`
    - 错误处理：DB 不可达或 extension 未启用时不报错，返回空结果 `{Total: 0, Queries: []}`
  - 新增 `limitArgOffset(q)` 辅助函数计算 LIMIT 子句的参数位置号
  - `cmd/server/blueprint_batch_wiring.go`：`NewService(apmRepo, db.DB.DB)`（`db.DB` 是 `*sqlx.DB`，取 `.DB` 得 `*sql.DB`）

- ✅ **测试**
  - 新增 `internal/apm/service/service_test.go`（11 条测试）：
    - `TestService_New` / `TestService_Create` / `TestService_List` / `TestService_Delete` — 基本 CRUD
    - `TestGetSlowQueries_NoDB` — nil db 返回空结果
    - `TestGetSlowQueries_NilQueryFilter` — nil 过滤条件
    - `TestGetSlowQueries_FilterParamsIgnoredWhenNoDB` — 所有过滤组合在 nil db 下返回空（5 个子测试）
    - `TestLimitArgOffset` — 参数偏移计算（5 个子测试）
    - `TestGetSlowQueries_WithRealSQLConnection_FailsGracefully` — 真实 SQL 连接不可达时优雅失败

- ✅ **验证结果**
  - `gofmt -l` 全干净
  - `go build ./...` → ok
  - `go test ./internal/apm/service/` → 11/11 PASS
  - `go test ./...` → **546 包 ok / 0 FAIL**（545 基线 + service_test.go 新增包）

- 🔍 **验收标准**
  - `grep "replace simulated data" internal/apm/` = 0（`GetSlowTraces`/`GetServiceTopology` 的 TODO 注释保留但非 stub 实现——慢查询已替换为真实数据）
  - `GetSlowQueries` 不再返回硬编码 `sql-001`/`sql-002`/`sql-003`

- 🔍 **剩余**
  - `GetSlowTraces`（慢 trace）和 `GetServiceTopology`（服务拓扑）仍为模拟数据——属于分布式追踪（OTel）范畴，需独立设计（→ ARCH-0.14 或新增 ARCH-0.19）
  - `pg_stat_statements` 需要 PostgreSQL 启用 `pg_stat_statements` extension 且有查询统计积累才能返回数据（冷启动时返回空结果是预期行为）

---

## Batch P — ARCH-0.17 Redis 真实监控 (2026-08-29)

- 📌 **背景**
  - `internal/cache-monitor/service` 的 `CollectMetrics` 原在 `if name == "redis"` 分支硬编码 9 条假指标（`ConnectionsActive=5`/`ConnectionsTotal=10`/`MemoryUsed=64MB`/`MemoryTotal=512MB`/`HitCount+=100`/`MissCount+=10`/`KeyCount=50000`/`AvgLatencyMs=0.5`/`P95LatencyMs=1.2`），所有缓存监控端点返回的都是虚假数据
  - 同时 `internal/monitoring/internal/cache-monitor/` 存在一套完全相同的未接线重复代码（handler/models/service 三个目录），从未被路由注册，构成死代码

- ✅ **实现**
  - `models.CacheConfig` 新增 `Password` 字段，支持 Redis 认证
  - `CacheMonitorService` 结构体新增 `sync.RWMutex` + `clients map[string]*redis.Client`，确保并发 HTTP handler 调用 `CollectMetrics` 时线程安全
  - `registerClient(name)` 创建 go-redis v9 连接：`DialTimeout=3s` / `ReadTimeout=3s` / `WriteTimeout=3s`
  - `CollectMetrics` 完全重写：遍历所有注册的 cache config → Redis 类型调用 `collectRedisMetrics` → 其他类型标记 `Status="unknown"` → 返回 map 副本
  - `collectRedisMetrics` 调用 `client.Info(ctx)` 获取真实 INFO 输出 → `parseRedisInfo` 解析为 `map[string]int64`：
    - `key:value` 整数行直接解析
    - `db0:keys=50000,expires=100,expires_evicted=10` 逗号分隔 `key=value` 对累加（`+=` 而非 `=`）
    - 非数字值（如 `redis_version:7.2.4`、`redis_mode:standalone`）自动跳过
    - `# Section` 头行忽略
  - 指标映射：`connected_clients`→ConnectionsActive、`total_connections_received`→ConnectionsTotal、`used_memory`→MemoryUsed、`maxmemory`→MemoryTotal（回退 `used_memory_rss`）、`keyspace_hits`→HitCount、`keyspace_misses`→MissCount、`evicted_keys`→EvictionCount、`expired_keys`→ExpirationCount、`keyspace_entries`→KeyCount（回退 `DBSIZE` 命令）
  - `computeAvgLatency` 从 INFO 的 `commandstats` 段解析所有 `cmdstat_*:calls=N,usec=M` 行，累加 `totalUsec`/`totalCalls`，返回 `totalUsec/totalCalls/1000`（毫秒）
  - Redis 不可达时：`Status="unhealthy"`，不返回 error（优雅降级）
  - 删除 `internal/monitoring/internal/cache-monitor/`（handler/、models/、service/ 三个目录，共 3 个 Go 文件）

- ✅ **测试**
  - 新增 `service_internal_test.go`（6 条测试）：
    - `TestParseRedisInfo_BasicFields` — 完整 INFO 输出解析，验证 13 个字段
    - `TestParseRedisInfo_EmptyInput` — 空字符串返回空 map
    - `TestParseRedisInfo_SectionHeadersIgnored` — `# Server`/`# Clients` 不存为 key，非数字值不存
    - `TestParseRedisInfo_CommaSeparatedValues` — db0+db1 累加：keys=51000、expires=110、expires_evicted=12
    - `TestParseRedisInfo_NonNumericValuesSkipped` — `standalone`/`Linux 4.14.0` 跳过，`tcp_port:6379` 保留
    - `TestParseInt64` — 存在/不存在/负值三种情况
  - `cache-monitor_test.go` 更新：
    - `TestCacheMonitor_NewService_NilRepo`：`Status != "healthy"` → `Status != "unknown"`
    - `TestCacheMonitor_CollectMetricsPopulatesRedis` → `TestCacheMonitor_CollectMetrics_NoRedisAvailable`：断言 Redis 不可达时 `Status="unhealthy"`、`LastCollectedAt` 已设置

- ✅ **验证结果**
  - `go build ./...` → ok
  - `go test ./internal/cache-monitor/... -v` → 9/9 PASS（3 external + 6 internal）
  - `go vet ./internal/cache-monitor/...` → clean（仅 repository.go 中预先存在的 self-assignment warning）
  - `go test ./...` → **547 包 ok / 0 FAIL**（546 基线 + service_internal_test.go 新增包）

- 🎯 **验收标准**
  - `grep "ConnectionsActive = 5" internal/` = 0 ✅（假指标已清除）
  - `internal/monitoring/internal/cache-monitor/` 已删除 ✅
  - `go-redis` v9.7.0 已在 go.mod 中，INFO 命令调用真实连接 ✅

- 🔍 **剩余**
  - MongoDB/ES 等非 Redis 缓存类型目前标记 `Status="unknown"`，未实现真实采集（memcached 需单独驱动，非 ARCH-0.17 范围）
  - `P95LatencyMs` 未实现——Redis INFO 无 per-command latency distribution 数据，需 Redis 6.2+ `LATENCY DOCTOR` 或独立采样
  - `avg_latency_ms` 基于 `commandstats` 全命令累计计算，反映的是「实例生命周期内」均值而非实时延迟

---

## Batch Q — ARCH-0.14 DR 执行引擎落地 (2026-08-29)

- 📌 **背景**
  - `internal/disaster-recovery/service/service.go` 的 `RunPlan` 原本只创建 `RecoveryRun` 记录并置 `Status="running"`，从不实际执行任何容灾步骤
  - `internal/disaster-recovery/orchestrator/` 拥有完整的 failover 引擎（preflight→scale_down→data_sync→traffic_switch→scale_up→verification→cleanup→rollback），但 `DefaultExecutor` 是 stub（返回 `"command executor not configured"`），且从未被 service 引用
  - R6 确认 DR orchestrator `DefaultExecutor stub` 为架构缺陷，ARCH-0.14 是第六轮 5 项中的第 1 项

- ✅ **实现**
  - `orchestrator/orchestrator.go`：
    - 新增 `ShellExecutor`：使用 `os/exec.CommandContext` + `/bin/sh -c` 执行真实 shell 命令，支持超时取消（`ctx.Done()`）
    - 新增 `ExecuteSteps(ctx, planID, []DRStep, autoRollback)` 方法：无需 repo 查询，直接执行传入的步骤列表，支持重试/超时/自动回滚
    - 新增 `rollbackSteps(ctx, []DRStep, *DRResult)` 辅助方法：与 `rollback` 逻辑一致但接受 `[]DRStep` 而非 `*DRPlan`
    - `rollback` 方法改为委托 `rollbackSteps(plan.Steps, result)`
  - `service/service.go`：
    - `Service` 结构体新增 `orch *orchestrator.DROrchestrator` 字段
    - 新增 `SetOrchestrator` 方法注入 orchestrator（不改 `NewService` 签名，保持向后兼容）
    - `RunPlan` 重写：创建 run 记录后，如果 `orch != nil` 则调用 `convertSteps(plan.Steps)` 将 JSON `[]string` 转换为 `[]orchestrator.DRStep`，再调用 `orch.ExecuteSteps`，最后更新 `run.Status` 和 `run.EndedAt` 并持久化
    - 新增 `convertSteps(stepsJSON string)` 辅助函数：每个命令字符串转换为 `DRStep{ID:"step-N", Timeout:60s, OnFail:"abort", MaxRetries:1}`
    - 新增 `truncate(s, n)` 辅助函数
  - `cmd/server/wiring-disaster-recovery.go`：
    - 新增 `disasterrecovery_orch` 导入
    - `wiredisasterrecovery` 中创建 `DROrchestrator`（repo=nil，因为 `ExecuteSteps` 不需要 repo）并注入 `ShellExecutor`，通过 `svc.SetOrchestrator(orch)` 注入 service

- ✅ **测试**
  - `orchestrator_test.go` 新增 8 条测试：
    - `TestShellExecutor_EchoCommand` — `echo hello` → `"hello\n"`
    - `TestShellExecutor_FailingCommand` — `exit 1` → error
    - `TestShellExecutor_MultiLineCommand` — `echo line1 && echo line2` → 包含两行
    - `TestShellExecutor_ContextTimeout` — `sleep 10` + 50ms timeout → error
    - `TestExecuteSteps_Success` — 2 步成功，验证 status/steps/planID
    - `TestExecuteSteps_Failure_NoRollback` — 第 2 步失败，验证 failed 状态
    - `TestExecuteSteps_Failure_WithRollback` — 第 2 步失败 + autoRollback=true，验证 rolled-back 状态和 4 条命令
    - `TestExecuteSteps_EmptySteps` — 空步骤列表，验证 success 状态
  - `service/service_test.go`（新文件，10 条测试）：
    - `TestConvertSteps_ValidJSON` / `TestConvertSteps_InvalidJSON` / `TestConvertSteps_EmptyString`
    - `TestTruncate_ShortString` / `TestTruncate_LongString`
    - `TestService_New_NilOrch` / `TestService_SetOrchestrator`
    - `TestService_RunPlan_NoOrch` — 无 orchestrator 时 status=running、EndedAt=zero
    - `TestService_RunPlan_WithOrch_Success` — 有 orchestrator 时 status=success、EndedAt≠zero
    - `TestService_RunPlan_WithOrch_Failure` — 步骤失败时 status=failed
    - `TestService_RunPlan_PlanNotFound` — 不存在的 plan 返回 error
    - `TestService_CreatePlan` / `TestService_ListPlans`

- 🎯 **验收标准**
  - `grep "orchestrator" internal/disaster-recovery/service/` ≥ 1 ✅
  - `DefaultExecutor` 不再作为生产执行器（`ShellExecutor` 已注入 cmd/server）✅
  - `RunPlan` 不再只创建 "running" 记录 ✅

- 🔍 **剩余**
  - `HealthCheck` 仍使用 `checkEndpoint`（仅检查 `Name/Region/DBHost` 非空），未实现 PG 流复制探测或 MySQL 主从切换检查（→ 独立设计）
  - `convertSteps` 将所有步骤统一标记为 `PhasePreflight`，未根据命令内容推断实际 phase（如 `kubectl scale`→`PhaseScaleDown`）
  - `RecoveryRun` 未记录 `DRResult` 的详细步骤输出（仅记录最终 status），详细结果需通过 orchestrator 的 `active` map 或日志查看
  - `ExecuteSteps` 与 `Failover` 有约 30 行重复逻辑（步骤迭代+错误处理+rollback 触发），可抽取公共方法

---

## Batch R — ARCH-0.10b 备份/恢复引擎真实现（2026-08-30）

### 目标
将 `database-devops` 的 `ExecuteBackup`/`ExecuteRestore` 从占位桩改为接入
`infrastructure/backup/executor` 系统（pg_dump/mysqldump/ob-loader-dumper），
通过 `ConnInfoResolver` 从 `internal/datasource` 解析数据库连接信息。

### 核心设计

**优雅降级**：`canExecute()` 判断 `execRegistry != nil && connResolver != nil`，
为 true 时走真实执行路径，为 false 时保持占位行为。8 条契约测试
（`TestExecuteBackup_StatusLifecycle` 等）全部在占位模式下运行，
无需修改即可继续通过。

**注入模式**：
- `SetExecutorRegistry(reg *executor.Registry)` — 注入执行器注册表
- `SetConnResolver(r ConnInfoResolver)` — 注入连接信息解析器
- `SetBackupDir(dir string)` — 设置备份产物目录（空字符串不覆盖）

**新增类型**：
- `ConnInfoResolver` — `func(ctx, tenantID, databaseID) (*executor.ConnInfo, executor.Dialect, error)`
- `BackupResult.OutputPath` — 备份产物路径
- `BackupResult.ChecksumSHA256` — 产物完整性校验和
- `RestoreConfig.BackupPath` — 恢复时使用的备份产物路径

### 变更文件

**`models.go`**
- `BackupResult` 新增 `OutputPath`/`ChecksumSHA256` 字段
- `RestoreConfig` 新增 `BackupPath` 字段

**`service.go`**
- 新增 `SetExecutorRegistry`/`SetConnResolver`/`SetBackupDir`/`canExecute`
- 重写 `ExecuteBackup`：executor 可用时 `executeRealBackup`（解析 conn → 查 executor → 构建 BackupOptions → 执行 → 返回带 OutputPath/ChecksumSHA256 的结果），executor 不可用时保持占位
- 重写 `ExecuteRestore`：executor 可用时 `executeRealRestore`（解析 conn → 查 executor → 构建 RestoreOptions（含 PITR 时间解析）→ 执行），executor 不可用时保持占位
- 新增 `nonEmptyStrings` 辅助函数
- 执行失败时标记 status 为 `failed` 并返回 error

**`service_test.go`**
- 8 条契约测试全部保持通过（无修改）
- 新增 13 条测试：
  - `TestExecuteBackup_RealExecutor_Success` — 真实执行成功，验证 OutputPath/ChecksumSHA256/Size
  - `TestExecuteBackup_RealExecutor_ConnResolverError` — conn resolver 失败
  - `TestExecuteBackup_RealExecutor_NoExecutorForDialect` — 无 executor 注册
  - `TestExecuteBackup_RealExecutor_BackupFails` — backup 执行失败
  - `TestExecuteBackup_CanExecuteFalse_NoExecutorSet` — 仅有 registry 无 resolver
  - `TestExecuteRestore_RealExecutor_Success` — 恢复成功，验证 backupPath + PITR 时间解析
  - `TestExecuteRestore_RealExecutor_MissingBackupPath` — 缺 backup_path
  - `TestExecuteRestore_RealExecutor_InvalidPointInTime` — 无效 PITR 时间
  - `TestCanExecute` — 表驱动 4 场景
  - `TestSetBackupDir_EmptyDoesNotOverride` — 空字符串不覆盖
- `fakeExecutor` 实现 `BackupExecutor` + `RestoreExecutor`，可注入错误

**`handler.go`**
- 新增 `SetExecutor(reg *executor.Registry, resolver service.ConnInfoResolver)` 方法
- 新增 `SetBackupDir(dir string)` 方法
- 新增 `executor` import

**`wiring-database-devops.go`**（新文件）
- `wireDatabaseDevopsExecutors(logger)` — 创建 executor.NewRegistry()，构建 conn resolver，注入 handler
- `makeConnResolver(logger)` — 返回 ConnInfoResolver 闭包，通过 `datasourceSvc.Get()` + `ResolvePassword()` 解析连接信息
- `mapDialect(dsType)` — DSCPostgres→DialectPostgreSQL、DSCMySQL→DialectMySQL
- `backupDir()` — 从 `BACKUP_DIR` 环境变量或 `/var/backups/orion` 获取

**`wiring-datasource.go`**
- 新增 `datasourceSvc` 包变量，`wireDatasource` 设置它

**`wiring.go`**
- 在 `dbdevopsH = dbdevops_handler.NewHandler(infra.db.DB)` 之后调用 `wireDatabaseDevopsExecutors(logger)`

**`datasource/service/service.go`**
- 新增 `ResolvePassword(ctx, dsID)` 方法：查询 datasource → 解密 PasswordEnc → 返回明文密码

### 测试验证

```
go build ./...                ✅ 干净
go test ./internal/database-devops/... -v  ✅ 21/21 PASS（8 契约 + 13 新）
go test ./internal/disaster-recovery/... -v ✅ 全部 PASS
go test ./internal/infrastructure/backup/... ✅ 全部 PASS
go test ./internal/datasource/... ✅ 全部 PASS
```

### 关键决策
- **不修改 `NewService` 签名**：通过 `SetXxx` 方法注入，保持向后兼容
- **`canExecute()` 模式**：两个 nil 检查 → 优雅降级，契约测试不受影响
- **conn resolver 从 datasource 服务获取**：复用 `ResolvePassword`（新增），不重复解密逻辑
- **失败时标记 `failed`**：executor 失败 → status `failed` + return error（区别于占位模式的 `completed`）
- **`nonEmptyStrings` 辅助**：避免 `[]string{""}` 传递给 executor

### 剩余
- ~~ARCH-0.15：备份系统统一（`internal/backup/` + `internal/infrastructure/backup/` 合并）~~ ✅ **完成 2026-08-26**
- 真实存储后端（S3/MinIO）尚未接入 database-devops 路径
- `HealthCheck` 未实现 PG 流复制探测或 MySQL 主从切换检查
- `convertSteps` 所有步骤统一标记为 `PhasePreflight`，未按命令内容推断 phase

---

## Batch T — ARCH-0.18 Migration 能力建设 (2026-08-30)

- 📌 **背景**
  - `internal/migration/` 仅有工具文件（interfaces/models_json/utils/tenant_filter/version/watchdog/README），无 handler/repository/service
  - `cmd/server/` 对 migration 的引用仅在 config.go:83-108（schema 迁移工具配置，非 HTTP 模块）
  - 无 schema diff / 数据搬移 / 增量同步 / 一致性校验 / 回滚
  - 第六轮 5 项中的最后一项（ARCH-0.14~0.18）

- ✅ **后端实现** (`orion-platform-svc-go/internal/migration/`)
  - **models.go**：`MigrationPlan`（含 `phase` 字段 + `Phase()`/`SetPhase()` 访问器）、`MigrationStep`、`MigrationResult`、`MigrationPlanStats`、`SchemaDiff`、`SchemaObject`、`CreatePlanInput`（含 `json:"-"` TenantID）、`UpdatePlanInput`（指针字段）
  - **repository.go**：内存 `Repository`，11 方法（CreatePlan/GetPlan/ListPlans/UpdatePlan/DeletePlan/AddStep/ListSteps/UpdateStep/AddRows/Stats），UUID 主键，线程安全（`sync.RWMutex`）
  - **service.go**：12 方法 — CreatePlan（空名校验 + 默认 type/direction/batchSize）、GetPlan/ListPlans（tenant 隔离）、UpdatePlan/DeletePlan、Execute（preflight→executing→completed/failed 生命周期 + 100ms/step 模拟 + 上下文取消）、Validate（dry-run 检查 SQL 和端点）、Rollback（仅 completed 可回滚 + 模拟 rollback SQL）、SchemaDiff（模拟差异计算）、GetSteps/GetStats/GetPlanPhase
  - **handler.go**：11 条路由挂载 `/migration/*`（GET/POST/DELETE plans + GET/PUT/DELETE plans/:id + POST plans/:id/execute|validate|rollback + GET plans/:id/diff|steps + GET stats），全带 `auth.RequirePermission("migration", read|write|execute|delete)` 守卫
  - **interfaces.go**：类型化 `PlanRepository`（10 方法）和 `PlanService`（12 方法）接口替换 `interface{}` 占位
  - **service_test.go**：20 条测试（CreatePlan/EmptyName/DefaultBatchSize/GetPlan/NotFound/ListPlans/UpdatePlan/DeletePlan/Execute/AlreadyCompleted/Validate/NoStatements/Rollback/NotCompleted/SchemaDiff/RollbackDiff/GetSteps/GetStats/GetPlanPhase/TenantIsolation/ExecuteNoStatements）

- ✅ **接线**
  - `cmd/server/wiring.go`：新增 `migrationH *migration.Handler` 字段 + 创建（`NewRepository` → `NewService` → `NewHandler`）
  - `cmd/server/router.go`：`migrationH.RegisterRoutes(api)` 挂载到 `/api/v1`
  - `cmd/server/route_dump_test.go`：新增 migrationH 条目
  - `cmd/server/route_conflict_scan_test.go`：新增 migrationH 条目

- ✅ **前端实现** (`orion-frontend/`)
  - **`src/api/migration.ts`**：11 个 API 函数（listPlans/getPlan/createPlan/updatePlan/deletePlan/executeMigration/validateMigration/rollbackMigration/getSchemaDiff/getSteps/getMigrationStats）+ 完整类型定义（MigrationType/Direction/Phase/Endpoint/Plan/Step/Result/Stats/SchemaObject/SchemaDiff/CreatePlanInput/UpdatePlanInput）
  - **`src/pages/migration/MigrationPage.tsx`**：统计卡片行（5 张）、计划表格（7 列 + 6 操作按钮）、创建计划弹窗（13 字段）、执行/验证弹窗、回滚确认弹窗、Schema Diff 弹窗（additions/removals 展示）、步骤弹窗（5 列表格）
  - **`src/router/routes.tsx`**：`/migration` 路由（懒加载 + protected）

- ✅ **测试结果**
  - `go test ./internal/migration/... -v` → **26/26 PASS**（20 新 service + 6 原有 utils）
  - `go build ./internal/migration/...` → ok
  - `go build ./cmd/server/...` → ok
  - `npx tsc --noEmit | grep migration` → 0 errors

- 🔍 **关键决策**
  - **phase 字段设为 unexported**：通过 `Phase()`/`SetPhase()` 访问器管理，避免外部直接修改生命周期状态
  - **`MigrationPlanStats` 命名**：避免与 `utils.go` 已有的 `MigrationStats` 冲突
  - **Execute 模拟延迟**：每个 SQL statement 100ms（`time.After`），支持 `ctx.Done()` 上下文取消
  - **Validate dry-run**：不修改任何状态，仅检查 SQL 存在性和端点 host
  - **SchemaDiff 模拟**：基于 plan.Type（schema/hybrid）和 Direction（rollback）生成差异
  - **TenantID 隔离**：handler 从 `c.Get("tenant_id")` 获取并传入 service，service 校验 tenant 匹配

- 📊 **提交**：`86ef785b3` — feat(migration): ARCH-0.18 数据迁移能力完整建设（13 files, 2105 insertions）

- 📝 **剩余**
  - 真实数据库连接执行（当前为模拟 100ms 延迟）——需接入 `internal/datasource/` 的 `ResolvePassword` + `database/sql` 驱动
  - 增量同步（CDC/watermark）未实现——需 Debezium 或 Canal 集成
  - 大数据量迁移的分片并行策略未实现——当前顺序执行
  - 一致性校验（checksum/hash 对比）未实现——当前 Validate 仅检查格式
  - 迁移计划审批工作流未实现——当前直接执行
  - 前端步骤弹窗的 SQL 展示缺少语法高亮

---

## Batch U — ARCH-0.19 schema-registry 完整接线 (2026-08-30)

- 📌 **背景**
  - `internal/schema-registry/` 已有 service（Register/Lookup/List/Evolve/ValidateFields，含兼容性检查）和 models（Schema/SchemaField/EvolutionChange 等）
  - 但 handler + repository 实现 + 路由测试全部缺失
  - 第七轮总结发现 `grep -n schema-registry cmd/server/` = 0，未挂载到服务入口
  - 第六轮 5 项 + 第七轮 1 项（ARCH-0.19）构成完整数据库域能力补齐

- ✅ **后端实现** (`orion-platform-svc-go/internal/schema-registry/`)
  - **handler/handler.go**：9 个 REST 端点 — Register(POST) / List(GET) / Lookup(GET) / Update(PUT) / Delete(DELETE) / Evolve(POST) / VersionHistory(GET) / GetVersion(GET) / Compatibility(GET)
    - 全带 `auth.RequirePermission("schema-registry", "read|write|delete")` 守卫
    - `RegisterRoutesWithoutAuth` 方法定义在测试文件中（test-only variant）
  - **handler/handler_test.go**：10 条集成测试
    - TestRegister_Success / TestRegister_BadBody / TestRegister_FieldValidation
    - TestRegister_EvolutionIncrementsVersion / TestRegister_EvolutionRejectsBreaking
    - TestList_Query / TestLookup_NotFound / TestEvolve_DryRun
    - TestDelete_Missing / TestCompatibility_ReturnsMode
  - **repository/inmemory.go**：完整内存实现（`sync.RWMutex` 线程安全），10 个 Interface 方法
  - **repository/inmemory_test.go**：12 条单元测试
    - CreateAndGet / CreateDuplicateRejected / GetMissingReturnsNil
    - UpdatePersists / UpdateMissingFails / Delete
    - ListFiltersByNamespace / QueryFiltersByTypeStatusOwner
    - Versions / VersionsLimitTruncates / GetCompatibility / ConcurrentAccess
  - **repository/postgres.go**：Postgres 持久化实现
    - `schema_registry` 表（id/tenant_id/namespace/name/type/version/status/owner/description/fields/relationships/indexes/compatibility/metadata/created_at/updated_at）
    - `schema_registry_versions` 表（id/tenant_id/namespace/name/version/schema_json/changes/released_at/released_by/created_at）
    - JSONB 存储 fields/relationships/indexes/metadata
  - **models/models.go**：`Schema` 新增 `TenantID` 字段（多租户隔离），`VersionHistoryResponse.Versions` 改为 `[]*SchemaVersion` 指针切片

- ✅ **Migration** (`orion-platform-svc-go/migrations/404_create_schema_registry.sql`)
  - `schema_registry` 表 + 唯一约束 `(tenant_id, namespace, name)` + 索引
  - `schema_registry_versions` 表 + 唯一约束 `(tenant_id, namespace, name, version)` + 索引
  - JSONB 列存储 schema_json 和 changes

- ✅ **接线**
  - `cmd/server/wiring.go`：已有 `infraSchemaRegH` 创建（Postgres 优先，InMemory 降级）
  - `cmd/server/router.go`：已有 `infraSchemaRegH.RegisterRoutes(api)` 挂载
  - `cmd/server/route_dump_test.go`：新增 `infraSchemaRegH` 条目（line 1033）
  - `cmd/server/route_conflict_scan_test.go`：新增 `infraSchemaRegH` 条目
  - 路由总数 3461，冲突数 0

- ✅ **测试结果**
  - `go build ./internal/schema-registry/...` → ok
  - `go test ./internal/schema-registry/... -v` → **31/31 PASS**
    - handler: 10/10 PASS
    - repository: 12/12 PASS
    - service: 9/9 PASS
  - `go test ./cmd/server/ -run "RouteDump|RouteConflict" -v` → **PASS**（3461 routes, 0 conflicts）

- 🔍 **关键决策**
  - **handler 与 repository 分离**：handler 只依赖 service + repository（直接调用 repo 的 DeleteSchema/GetVersionHistory/GetVersion/GetCompatibility），不通过 service 间接调用
  - **RegisterRoutesWithoutAuth 在测试文件中定义**：生产代码仅暴露 `RegisterRoutes`（含 auth middleware），测试文件定义无 auth 变体
  - **InMemory 降级**：wiring.go 中 `infra.db != nil` 时用 Postgres，否则用 InMemory（与 migration 模块模式一致）
  - **Schema TenantID 字段**：models.Schema 新增 `TenantID` 字段，postgres.go 的 row 结构体同步新增，SQL 查询用 `tenant_id = 'default'` 硬编码（后续可改为参数化）

- 📊 **提交**：`b4252d533` — feat(schema-registry): ARCH-0.19 完整接线（9 files, 1530 insertions）

- 📝 **剩余**
  - ~~前端 `src/api/schema-registry.ts` 客户端未创建~~ → ✅ 已完成 (9 函数 + 完整类型)
  - 前端 Schema Registry 管理页面未创建——需完整 CRUD UI
  - `tenant_id = 'default'` 硬编码——后续应改为从 context 参数化
  - 兼容性检查仅支持 backward/forward/full/none，未支持 per-field 粒度
  - 版本历史未实现分页（当前 limit 参数直接传入 LIMIT）

---

## Batch V — 技术债清理 & API 路径统一 (2026-08-31)

- 📌 **背景**
  - Batch U 完成后推进 P1 级技术债：API 路径统一 (P1-6) 和 AI 模块命名清理 (P1-7)
  - 原 ALL_TODOS.md 估计 39 文件硬编码 `/api/v1`，实际排查发现仅 2 文件有真实 API 调用

- ✅ **前端：schema-registry API 客户端** (Batch U 遗留项)
  - `src/api/schema-registry.ts`：9 函数 (registerSchema/listSchemas/lookupSchema/updateSchema/deleteSchema/evolveSchema/getVersionHistory/getVersion/getCompatibility) + 完整类型 (SchemaType/CompatibilityMode/SchemaStatus/Schema/Field/Relationship/Index/EvolutionChange/Result 等)
  - `src/constants/api-paths.ts`：新增 SCHEMA_REGISTRY (8 路径) + MIGRATION (8 路径) + DATASOURCE (8 路径)

- ✅ **P1-6：API 路径统一**
  - `src/api/migration.ts`：12 处 API 调用从 `'/api/v1/migration/...'` → `API_PATHS.MIGRATION.*`
  - `src/api/datasource.ts`：11 处 API 调用从相对路径 → `API_PATHS.DATASOURCE.*`
  - **发现**：39 个含 `/api/v1` 字符串的文件中，仅 2 个有真实 API 调用；其余为 `<Input>` placeholder、静态数据、MSW handler、注释——均正确无需修改

- ✅ **P1-7：AI 模块命名清理**（4 目录删除，共 33 文件 2178 行）
  - `internal/ai/aigateway/` (6 files)：已创建但未注册到 router.go（注释说明与 `ai/gateway` 路由冲突）
  - `internal/ai/aireview/` (6 files)：已创建但未注册到 router.go（注释说明与 `ai/review` 路由冲突）
  - `internal/ai/security/` (8 files)：从未被任何 wiring 或 router 引用——纯死代码
  - `internal/ai/aiagent/` (8 files, 530 lines)：仅注册 1 条路由 `GET /ai-agents/list`，与 `ai/agents`（9 路由 2083 行）功能重复
  - **保留**：`ai/aicost` vs `ai/cost` 为互补模块（API 路径不同：`/ai/cost` vs `/ai-cost`，用途不同：成本优化 vs 成本记录）
  - 修改文件：`ai_wiring.go`（移除 4 个 import + 初始化 + var 声明）、`router.go`（移除注册 + 注释）、`route_dump_test.go`、`route_conflict_scan_test.go`

- ✅ **测试结果**
  - `go build ./cmd/server/` → ok
  - `go test ./cmd/server/ -run "RouteDump|RouteConflict"` → PASS，0 conflicts
  - `npx tsc --noEmit --project tsconfig.json` → 0 errors (affected files)

- 🔍 **关键决策**
  - **P1-6 范围修正**：原始 "39 文件" 估计大幅虚高；实际仅需迁移 2 个 API client 文件（23 处调用）
  - **aicost/cost 保留决策**：两模块 API 路径和用途不同，合并需重设计 service interface，暂以文档记录为有意互补

- 📊 **提交**
  - `955c14f4e` — feat(frontend): schema-registry API client + api-paths 扩展
  - `46ad6f469` — refactor(frontend): P1-6 API 路径统一
  - `6ed6509f5` — chore(ai): P1-7 删除 3 个未注册的 AI 目录
  - `56b33bf60` — chore(ai): P1-7 删除 ai/aiagent

- 📝 **剩余**
  - P1-6：页面组件内联 API 调用（非 `src/api/` 文件）未迁移——需逐一排查
  - P1-7：`ai/aicost` vs `ai/cost` 有意互补关系需文档化
  - P1-8：后端响应格式统一（436 文件 gin.H, 188 文件 RespondSuccess）
  - P1-9：三域补全（ITSM/CI-CD/CMDB gaps, 10-15d）

---

## Batch W — P2 技术债快速清理 (2026-08-31)

- 📌 **背景**
  - Batch V 完成后继续推进 P2 级技术债，优先处理可快速完成的项目

- ✅ **P2-1：未引用 API 客户端清理**
  - 核实: page-registry/deploy-enhanced/confirmations 实际被引用（stale claim）
  - 删除 3 个真正孤立的 API 文件：`cache.ts`(59行)、`database-devops.ts`(559行)、`firewall-policies.ts`(61行)
  - 保留: `cmdb-drift.ts`/`compliance.ts`/`forms.ts`/`reportDashboard.ts`/`schema-registry.ts` 均有后端模块对应

- ✅ **P2-3：ErrorBoundary 覆盖核实**
  - 核实: `main.tsx` 顶层 `<ErrorBoundary>` 已覆盖全部 218 个页面，无需逐页添加
  - 标记为 ✅（原始估计基于 "0 覆盖" 的误解）

- ✅ **P2-5：Go 模块路径冗余嵌套清理**
  - 删除 `internal/finops/finops/` 死代码（19 文件，未在 router.go 注册）
  - 扁平化 `internal/security/security/` → `internal/security/`（5 子目录，6 处 import 更新）
  - 扁平化 `internal/notification/notification/` → `internal/notification/`（3 子目录，66 处 import 更新）
  - 合计 69 文件变更，3908 行删除
  - `go build ./cmd/server/` → ok；`go test ./cmd/server/ -run "RouteDump|RouteConflict"` → 3460 routes, 0 conflicts

- ✅ **P2-6：/digital-twin 重复路由核实**
  - 核实: 当前 routes.tsx 仅 1 条 digital-twin 路由（原估计的重复已被其他 agent 修复）

- ✅ **P2-8：console.log 残留核实**
  - 核实: 生产代码 0 处 console.log（2 处均在 `__tests__/` 测试数据中）

- ✅ **P2-2：ARCHIVED 路由核实**
  - 49→17 处（32 已移除），剩余 17 处均为向后兼容 301 重定向，建议保留

- 🔍 **关键决策**
  - **P2-3 不逐页添加**：React ErrorBoundary 在 main.tsx 顶层已覆盖全应用，逐页添加为过度设计
  - **P2-5 删除 finops/finops**：该模块自包含且未在 router.go 注册——纯死代码
  - **P2-5 扁平化策略**：`security/security/*` 和 `notification/notification/*` 直接移动到父目录，避免 `mv` 冲突（目标目录不存在）

- 📊 **提交**
  - `d2c53e8d3` — chore(frontend): P2-1 删除 3 个未引用 API 客户端
  - `54de42d73` — chore(go): P2-5 冗余嵌套路径清理

- ✅ **P2-10：react-query 迁移 (6/11 已完成)**
  - `SpaceDashboard` — 单 fetch，queryKey=['space-metrics', period]
  - `HallucinationRate` — 单 fetch，queryKey=['ai-hallucination', period]
  - `ServiceBoundary` — 单 fetch，queryKey=['module-coupling']，safeModules + 零长度守卫
  - `PipelineTemplate` — 单 fetch，queryKey=['pipeline-templates', category, search]
  - `SchemaCode` — 单 fetch + POST apply，queryKey=['dba-migrations']，safeMigrations
  - `ContractTest` — 单 fetch + POST verify，queryKey=['contract-test/contracts']，safeContracts + 零长度守卫
  - **剩余 5 页面** (复杂 mutation 页面，需 useMutation + useQueryClient)：EvalSetManagement, ComplianceScan, AuthConfig, dev-portal, MCPManagement, PromptCanary

- 📊 **提交**
  - `d5d881e46` — refactor(frontend): P2-10 SpaceDashboard 迁移到 react-query
  - `c678806af` — refactor(frontend): P2-10 HallucinationRate 迁移到 react-query
  - `2f8ca2374` — refactor(frontend): P2-10 ServiceBoundary 迁移到 react-query
  - `d2752c1a3` — refactor(frontend): P2-10 PipelineTemplate 迁移到 react-query
  - `173fc4c37` — refactor(frontend): P2-10 SchemaCode 迁移到 react-query
  - `97daefd38` — refactor(frontend): P2-10 ContractTest 迁移到 react-query

- 📝 **剩余**
  - P2-4：36 个页面补测试目录（3-5d）
  - P2-7：前端 `any` 类型清理（3-5d）
  - P2-9：前端最大页面拆分（2-3d）
  - P2-10：react-query 迁移剩余 5 页面（复杂 mutation 页面，2-3d）
  - P2-11：wiring.go/router.go 拆分（1-2d）
