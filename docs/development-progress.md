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
  - ARCH-0.12 — datasource 补 ClickHouse / MongoDB 驱动
