# Orion 平台 — 所有待办汇总（单一权威来源）

> 最后更新: 2026-08-29 | 分支: `feat/wave2-parallel-execution`
> 数据来源: `architecture-review-2026-08-01.md` + `CROSS_VALIDATION_REPORT.md` + `merged-action-items-2026-07-27.md` + `structure-overlap-verification-2026-08-01.md` + `three-domain-depth-analysis-2026-08-01.md`
> 状态: ✅ **已通过专家评审核实** (2026-08-01)，以下为**当前有效清单**

---

## 一、完成状态速览

| 状态 | 数量 |
|------|------|
| ✅ 已完成 | 17 项 |
| 🔴 待处理 | 4 项 P0 |
| 🟡 待处理 | 7 项 P1 |
| 🔵 待处理 | 11 项 P2 |
| ⚠️ 已废弃/不适用 | 11 项 |
| **总计** | **49 项** |

---

## 二、已完成清单 (16 项)

| # | 任务 | 完成日期 | 证据 |
|---|------|---------|------|
| ✅ | P1-3: 6 个 hooks 补全 barrel 导出 | 2026-08-01 | commit `321727264` |
| ✅ | P1-4: Canary + Pipeline handler wiring | 2026-08-01 | commit `3256de67a` |
| ✅ | P2-036: 部分完成（page-registry/cache-strategy/confirmations 仍被使用） | 2026-08-01 | |
| ✅ | P2-037: OpenAPI/Swagger 注解 | 2026-08-01 | |
| ✅ | P2-038: ErrorBoundary 自动包裹 | 2026-08-01 | |
| ✅ | P2-039: 路由标记 17 处 ARCHIVED | 2026-08-01 | |
| ✅ | P2-040: @tanstack/react-query 已安装 | 2026-08-01 | |
| ✅ | P2-041: NATS Subscriber wiring + Incident NATS 真实 Handler | 2026-08-01 | commit `1355d75b2` |
| ✅ | P2-042: 重复路由全部删除 | 2026-08-01 | |
| ✅ | P2-043: Self-Service DELETE handler | 2026-08-01 | |
| ✅ | P2-044: audit /reports + /report/generate | 2026-08-01 | |
| ✅ | P2-045: __tests__ 目录 218 个 | 2026-08-01 | |
| ✅ | Notification import paths 修复 | 2026-08-01 | commit `d3de64c53` |
| ✅ | P2-041: Incident NATS EventHandler 接口重构 | 2026-08-01 | commit `1355d75b2` |
| ✅ | **P0-5: 前端 TS 编译错误** (核实仅 4 个，全在 `__tests__` 目录，非生产代码) | 核实 | `npx tsc --noEmit` 仅 4 个错误，0 个在生产代码中 |
| ✅ | **P2-7: Go build 阻塞错误** (核实已修复，`go build ./cmd/server/` 通过) | 核实 | `go build ./cmd/server/` exit code 0，0 错误 |
| ✅ | **P0-1: 前端敏感页面权限守卫** (15 个路由已添加 requiredPermission) | 2026-08-26 | `routes.tsx` awk 验证 0 个缺失 |
| ✅ | **P0-2: Log 支柱** (核实已存在，`internal/logging/` 完整) | 2026-08-26 | stale claim |
| ✅ | **P0-3: prompt-security Repo** (核实已存在) | 2026-08-26 | stale claim |
| ✅ | **P0-4: alert-deduplication Repo** (核实已存在) | 2026-08-26 | stale claim |
| ✅ | **P1-1: crossover Repository + HTTP endpoint 全链路** | 2026-08-26 | 15 endpoints + 18 tests + adapter + wiring |
| ✅ | **security-compliance handler ctx 未使用** (build 阻塞) | 2026-08-26 | `CreateBaseline` ctx→_ 修复，`go build` clean |
| ✅ | **P1-2: ticketing handler.go 核心拆分** | 2026-08-26 | 1370行/84方法 → 14文件(212行handler.go + 13个handler_*.go)，0行为变更，`go test`全部通过 |
| ✅ | **BOOT-1: 启动崩溃（Gin 路由重复注册 panic）** | 2026-08-29 | 冲突 52 → 0；`setupRouter` 装配 3446 条路由不 panic；`wireCoreDomains` 从未被调用 → 24 个 handler 永久 nil 一并修复 |
| ✅ | **ROUTE-1: 4 个测试文件固化路由注册合法性为 CI 断言** | 2026-08-29 | boot / route_conflict_scan（0 conflicts）/ route_dump（319 handlers）/ ticket_routes_conflict |
| ✅ | **PERM-1~5: 权限守卫与角色 fallback** | 2026-08-29 | 见下方「权限修复」表；新增 `permission_guard_audit_test.go` 5 条断言（765 守卫对 / 3640 调用点），两个反向验证均失败即报错 |
| ✅ | **ARCH-0.9 后端: datasource 模块接成 REST API** | 2026-08-29 | 从死代码 → 11 条带守卫路由 + repository + migration 551；路由 3414 → 3446 |
| ✅ | **7 个死声明清理** | 2026-08-29 | 5 个按前缀归属删除、2 个（skillH / ai_knowledgeH）真正挂载；撞出并修掉 Gin 第二类 panic（同节点通配符 token 名冲突，2 处） |

---

## 三、待处理 — P0 阻塞性 (4 项)

| # | 任务 | 来源 | 详细说明 | 工作量 |
|---|------|------|---------|--------|
| ~~**P0-1** | 前端敏感页面权限守卫 | 架构评审 | ~~已修复: routes.tsx 15 个敏感路由添加 requiredPermission 守卫 (backup/manage, alert-rule/config, approval, audit, capability-admin, config, cron-job, deploy/approval, incident, observability/config, plugin/config, secret, security, sla-policy, sso-config, ticketing/config)~~ | ✅ 2026-08-26 |
| ~~**P0-2** | Log 支柱缺失 | 交叉验证 | ~~核实为 stale claim: `internal/logging/` 模块完整 (handler.go 259行/10方法, wired in wiring.go+router.go, 6 REST endpoints)~~ | ✅ 2026-08-26 |
| ~~**P0-3** | prompt-security 补 Repo 层 | 交叉验证 | ~~核实为 stale claim: `internal/prompt-security/repository/` 已存在 (322行/10方法), 已 wired to service~~ | ✅ 2026-08-26 |
| ~~**P0-4** | alert-deduplication 补 Repo 层 | 交叉验证 | ~~核实为 stale claim: `internal/alert-deduplication/repository/` 已存在 (67行/2方法), 已 wired to service~~ | ✅ 2026-08-26 |

**P0 合计工作量**: 4.5-6 天

---

## 四、待处理 — P1 高优先级 (8 项)

| # | 任务 | 来源 | 详细说明 | 工作量 |
|---|------|------|---------|--------|
| ~~**P1-1** | crossover 补 Repository 实现 | 结构重叠 | ~~已修复: repository(316行), service(30+方法), handler(15 endpoints + 18 tests), adapter(CallRecord↔CrossoverCall), wiring.go/router.go 全部 wired, `go build ./cmd/server/` clean~~ | ✅ 2026-08-26 |
| ~~**P1-2** | ticketing handler.go 核心拆分 | 结构重叠 | ~~已修复: handler.go 1370行/84方法拆分→14文件(handler.go 212行 + 13个handler_*.go)，纯机械拆分，0行为变更，`go build`+`go test`全部通过~~ | ✅ 2026-08-26 |
| **P1-3** | chaos 三模块合并 | 结构重叠 | chaos(1384行)+chaos-enhanced(367行)+chaos-gateway(517行)，三模块 Model/Repo/CRUD 完全独立，合并为 chaos-engine | 3-5 天 |
| ~~**P1-4** | 7 个未注册 TS 路由 | merged-action-items | ~~核实为 stale claim: 仅 federation 和 RiskDashboard 两个 page 目录存在，且两者均已在 routes.tsx 注册；其余 5 个目录(channel, deploy-enhanced, notification-management, pipeline-run-history, pipeline-trend)根本不存在~~ | ✅ 2026-08-26 |
| ~~**P1-5** | 9 个孤岛 Controller | merged-action-items | ~~核实为 stale claim: `src/` 下 0 个 Controller 命名文件存在~~ | ✅ 2026-08-26 |
| **P1-6** | 前端 API 路径统一 | merged-action-items | 137 个文件硬编码 `/api/v1`，迁移脚本不存在 | 2-3 天 |
| **P1-7** | AI 模块命名统一 | merged-action-items | 9 个 ai-xxx 目录 + 9 个 ai/xxx 目录并存，迁移脚本存在未执行 | 2 天 |
| **P1-8** | 后端响应格式统一 | merged-action-items | 436 个文件含 gin.H，188 个文件含 RespondSuccess (handler层 276/184) | 5-8 天 |
| **P1-9** | 三域补全 (ITSM/CI-CD/CMDB) | 三域深度分析 | ITSM: sla-engine(0方法)/Release/ServiceCatalog; CI/CD: Trigger/pipeline-run-history; CMDB: Drift Detection | 合计 10-15 天 |

**P1 合计工作量**: 27-40 天

---

## 五、待处理 — P2 技术债务 (11 项)

| # | 任务 | 来源 | 详细说明 | 工作量 |
|---|------|------|---------|--------|
| **P2-1** | 4 个未引用 API 客户端清理 | merged-action-items | page-registry(1次非API引用), deploy-enhanced(0次), confirmation(文本引用), cache(1次非API引用) | 0.5 天 |
| **P2-2** | 49 处 ARCHIVED 路由分批移除 | merged-action-items | routes.ts 中 49 处 ARCHIVED 标记的路由 | 2-3 天 |
| **P2-3** | ErrorBoundary 覆盖 218 页面 | merged-action-items | 当前 0 覆盖 → 已部分完成(P2-038)，需验证 | 1 天 |
| **P2-4** | 36 个页面补测试目录 | merged-action-items | 约 36/218 页面无 `__tests__/` 目录 | 3-5 天 |
| **P2-5** | Go 模块路径冗余嵌套清理 | merged-action-items | notification/notification, finops/finops, security/security | 0.5 天 |
| **P2-6** | /digital-twin 重复路由 | merged-action-items | 第 1409 行和第 2007 行 | 0.5 天 |
| **P2-7** | 前端 `any` 类型清理 | 三域分析 | 1138 处 `any` 类型，pages 层 1118 处 | 3-5 天 |
| **P2-8** | 前端 `console.log` 残留 | 三域分析 | 60 处 `console.log` 残留 | 0.5 天 |
| **P2-9** | 前端最大页面拆分 | 三域分析 | ChangeManagement(1899行) 等超大单文件拆分 | 2-3 天 |
| **P2-10** | 安装 @tanstack/react-query | merged-action-items | 已安装(P2-040)，但 10 个核心页面未迁移 | 2-3 天 |
| **P2-11** | wired.go / router.go 拆分 | 三域分析 | wiring.go 953 行 + router.go 617 行，入口文件膨胀 | 1-2 天 |

**P2 合计工作量**: 14.5-24 天

---

## 六、已废弃 / 不适用 (9 项)

| # | 原任务 | 废弃理由 |
|---|--------|---------|
| ❌ | artifact-version 重构 (声称 Service 仅 6 方法) | 交叉验证: 实际 62 方法，无需重构 |
| ❌ | 21 模块补 Service | 交叉验证: 实际仅 2 个(global-search/visor)，统计方法缺陷 |
| ❌ | project 模块空壳 | 交叉验证: 有完整 Service+Repo |
| ❌ | statistics 分层重构 | 核实: 孤立工具库，全项目 0 引用，非 REST 模块 |
| ❌ | global-search 补 Service | 核实: IndexerRegistry 已是合理领域抽象，补 Service 过度设计 |
| ❌ | **P0-5: 前端 TS 353 编译错误** | **核实: npx tsc --noEmit 仅 4 个错误，且全在 `__tests__/` 目录，生产代码 0 错误** |
| ❌ | **P0-6: NotificationEnhanced/OpsTools 路由注册** | **核实: 两者均已注册 (`routes.tsx:241` 和 `:92`)，DatabaseDevOps 仍未注册** |
| ❌ | **P0-7: vectorRoutes/infrastructureRoutes 后端路由** | **核实: 全项目搜索 vectorRoutes 和 infrastructureRoutes 均 0 结果，文件不存在，任务过时** |
| ❌ | **P1-9: 删除 Go 蓝图双份冗余** | **核实: 当前活跃 Go 服务仅 2 个(`orion-go-common` + `orion-platform-svc-go`)，83 个 blueprints 已全部 `.archived`，88 个 docs/archives 已归档。无冗余问题** |
| ❌ | **P1-4: 7 个未注册 TS 路由** | **核实: 仅 federation 和 RiskDashboard 两个 page 目录存在，且均已注册；其余 5 个目录根本不存在，任务过时** |
| ❌ | **P1-5: 9 个孤岛 Controller** | **核实: `src/` 下 0 个 Controller 命名文件存在，任务过时** |

---

## 七、执行路线图

### Phase 0 — 阻塞修复 (1-2 天)

| # | 任务 | 工作量 |
|---|------|--------|
| P0-3 | prompt-security 补 Repo | 0.5 天 |
| P0-4 | alert-deduplication 补 Repo | 0.5 天 |

### Phase 1 — P0 核心 (2-5 天)

| # | 任务 | 工作量 |
|---|------|--------|
| P0-1 | 前端敏感页面权限守卫 | 1-2 天 |
| P0-2 | Log 支柱缺失 | 2-3 天 |

### Phase 2 — P1 功能完整度 (7-15 天)

| # | 任务 | 工作量 |
|---|------|--------|
| P1-1 | crossover Repository 补全 | 1-2 天 |
| P1-2 | ticketing handler 核心拆分 | 2-3 天 |
| P1-3 | chaos 三模块合并 | 3-5 天 |
| P1-4~9 | 路由/Controller/API路径/响应格式/AI命名/三域补全 | 10-15 天 |

### Phase 3 — P2 技术债务 (5-10 天)

| # | 任务 | 工作量 |
|---|------|--------|
| P2-1~11 | 全部 P2 项 | 14.5-24 天 |

### 总计: ~23-44 天

---

## 八、架构健康度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 后端架构分层 | **9.5/10** | 263/265 模块有 Service 层(99.2%) |
| 业务逻辑深度 | **8.5/10** | ITSM 188/118 最深，部分辅助模块薄 |
| 前端交互完整性 | **7/10** | 217 页面覆盖全，权限校验 2.8% 是最大缺口 |
| 事件驱动链路 | **8/10** | alert→dedup→correlate→silence→escalate 完整 |
| AI/智能覆盖 | **7.5/10** | chatops(84 Service) 深度好，AI 子模块偏薄 |
| FinOps 成本 | **9/10** | 成本追踪/预算/分摊/Chargeback 全覆盖 |
| 安全与合规 | **8.5/10** | SOC2/ISO27001 + SBOM + 漏洞扫描完整 |
| 数据治理 | **8/10** | 目录/质量/管道/血缘，Log 支柱缺失 |
| 可观测三大支柱 | **7.5/10** | Metrics✅ + Traces✅ + Logs❌ |
| 运维自愈 | **8/10** | self-healing + diagnostic + runbook + auto-recovery |
| **综合** | **8.3/10** | |

---

## 九、2026-08-29 DBA/数据/AI 智能化评审新增待办

> 来源: `dba-data-ai-agent-gap-analysis-2026-08-29.md` + `dba-data-deep-review-and-interaction-issues-2026-08-29.md` + `permission-system-review-and-dba-data-integration-2026-08-29.md`
> 现状评分: **整体 3/10**（DBA 基础 4/10、AI 能力 2/10、数据挖掘 3/10、前端工作台 2/10）
> 总工作量: Phase 0(13d) + 原 P0/P1(35d) + 前端工作台(19d) ≈ **67-68 人天**

### Phase 0 — 架构统一（前置，13 人天）

| ID | 任务 | 解决缺口 | 优先级 |
|----|------|---------|--------|
| ARCH-0.1 | DBA 移除自有 DataSource，复用 datasource 模块 | IX-1/IX-2/IX-8 | 🔴 高 |
| ARCH-0.2 | DBA ExecuteDirectQuery 改用 datasource.GetConnection | IX-2 + 多库支持 | 🔴 高 |
| ARCH-0.3 | datasource 扩展 Oracle/SQL Server 驱动 | 数据库类型缺口 | 🟡 中 |
| ARCH-0.4 | data-catalog introspector 扩展 ClickHouse/Oracle | 数据库类型缺口 | 🟡 中 |
| ARCH-0.5 | 数据模块间 Service 接口定义 + wiring 注入 | IX-3（6 模块孤立） | 🔴 高 |
| ARCH-0.6 | 数据模块发事件到 EventBus（4 类事件） | IX-5/IX-6 | 🟡 中 |
| ARCH-0.7 | 高风险 SQL 执行纳入 Saga | GAP-5/IX-7 | 🟡 中 |
| ARCH-0.8 | LLM 调用接入 tokenbucket + llm-trace | GAP-7（成本控制） | 🟡 中 |

### 第四轮追加（接线实况修正，2026-08-29，合计 7 人天）

> 来源: `dba-data-round4-deeper-issues-2026-08-29.md` — 服务入口反向审计接线实况，暴露前三轮未覆盖的工程真实性问题

| ID | 任务 | 解决缺口 | 优先级 | 工作量 |
|----|------|---------|--------|--------|
| ~~ARCH-0.9~~ | datasource 补 handler 层 + 路由接线 | R4-1 | 🟡 **部分完成 2026-08-29** — 后端已完成: 11 条带守卫路由 `/api/v1/data-sources` + repository 实现 + wiring + migration 551；**剩余: 前端 `datasource.ts` 客户端** | 2d |
| ~~ARCH-0.10~~ | database-devops 补权限守卫 + 补测试 | R4-4 + PERM-2 | 🟡 **部分完成 2026-08-29** — 10 条路由守卫已全部补齐（read/write/delete/execute）；**剩余: 备份/恢复测试** | 1.5d |
| ARCH-0.11 | **三套数据源统一 + 明文密码清理**（database-devops 复用 datasource 加密模型，删除 `/data-sources` 明文端点） | R4-3 + IX-8 | 🔴 高 | 2d |
| ARCH-0.12 | **datasource 补 ClickHouse/MongoDB 驱动**（宣称 5 → 实连 5） | R4-2 | 🟡 中 | 1.5d |

**数据库类型实况修正**：datasource **宣称 5 种（PG/MySQL/ClickHouse/ES/MongoDB）实连仅 2 种（PG+MySQL）**（service.go 仅 import mysql+pgx 驱动，ClickHouse/ES/MongoDB 调用直接返回错误）；data-catalog 实连 3 种（PG/MySQL/SQLite）；DBA 执行/测试仅 PG（硬编码 postgres）。缺失企业级类型：Oracle/SQL Server/OceanBase/openGauss/TiDB。

### P0 — 核心能力（17 项，原方案）

| ID | 任务 | 模块 | 优先级 |
|----|------|------|--------|
| DBA-01 | Text2SQL (NL→SQL) | dba/advisor | 🔴 |
| DBA-02 | SQLAdvisor（慢 SQL 优化建议） | dba/advisor | 🔴 |
| DBA-03 | IndexAdvisor（索引建议） | dba/advisor | 🔴 |
| DBA-04 | SQL EXPLAIN 解释 | dba/advisor | 🔴 |
| DBA-05 | 慢 SQL 采集 + 分析 | dba | 🔴 |
| DBA-06 | AuditEngine 审核规则执行引擎（GAP-1） | dba/advisor | 🔴 |
| DM-01 | Data Profiler（AI 数据探查） | data-catalog/profiler | 🔴 |
| DM-02 | 血缘自动采集（Parser） | data-lineage/parser | 🔴 |
| DM-03 | 数据质量异常检测 Agent | data-quality/agent | 🔴 |
| DM-04 | NL→BI 智能问数 | bi-dashboard/agent | 🔴 |
| AI-01 | assistant 接入 DBA/Catalog/Quality/Lineage Provider | assistant | 🔴 |
| AI-02 | ActionGenerateSQL / RunSQLAudit / GenerateBI / RunQualityScan | assistant | 🔴 |
| AI-03 | DBA Copilot 多轮对话 | assistant | 🟡 |
| AI-04 | 根因分析 Agent | dba | 🟡 |
| AI-05 | 容量规划预测 | dba | 🟡 |
| AI-06 | ETL DAG 生成 | data-pipeline | 🟡 |
| AI-07 | 脱敏联动 Agent | data-masking | 🟡 |

### 权限修复（PERM，6 项）

| ID | 任务 | 严重度 | 状态 |
|----|------|--------|------|
| ~~PERM-1~~ | datasource 模块补权限守卫 | 🔴 高 | ✅ 2026-08-29 — 11 条路由全带 `RequirePermission("datasource", …)`（超出原定的 7 条） |
| ~~PERM-2~~ | database-devops 模块补权限守卫 | 🔴 高 | ✅ 2026-08-29 — 10 条路由全带守卫（read/write/delete/execute） |
| ~~PERM-3~~ | 修复 DBA 角色 fallback（加 dba:* 权限） | 🔴 高 | ✅ 2026-08-29 — `dba:*` / `datasource:*` / `database-devops:*`；前端 fallback 已镜像 |
| ~~PERM-4~~ | 新增 4 个数据专业角色 fallback | 🟡 中 | ✅ 2026-08-29 — data_admin / data_steward / bi_analyst / data_engineer |
| ~~PERM-5~~ | 修拼写 data-mashing→data-masking + 命名统一 | 🟡 中 | ✅ 2026-08-29 — 第 30 行守卫修正；另加 `normResource()` 统一 4 组 `_`/`-` 拼写分叉 |
| PERM-6 | AI 端点权限定义（新增 `:ai` action） | 🟡 中 | ⬜ 待做 |
| PERM-7 | **后端补 `GET /roles/permissions-map`**（前端在调但无任何路由服务，导致前端权限永远走硬编码 fallback、后端改动不同步） | 🟡 中 | ⬜ 待做（2026-08-29 新发现；`models.PermissionsMap` 已定义但从未使用） |

### 前端工作台（UI，6 阶段 19 人天）

| ID | 任务 | 内容 |
|----|------|------|
| UI-1 | `/dba-workbench` 搭建（10 子页） | 工单/数据源/审核规则/慢SQL/Explain/索引/AI助手/备份/健康/容量 |
| UI-2 | `/data-workbench` 搭建（11 子页） | 目录/探查/质量/血缘/掩码/分类/元数据/BI/报表/管道/AI问数 |
| UI-3 | 7 个 API 客户端创建 | bi-dashboard/data-catalog/data-masking/data-classification/datasource/database-devops/report-designer |
| UI-4 | 路由 + 菜单 + requiredPermission 接入 | 对接权限矩阵 |
| UI-5 | 权限矩阵前端映射 | 新增角色 fallback + `:ai` action |
| UI-6 | 工作台与各模块页面互链 | 消除数据源双入口 |

---

> 所有详细分析报告:
> - `docs/architecture-review-2026-08-01.md` — 主统一报告 (1088 行, 9 章)
> - `docs/structure-overlap-verification-2026-08-01.md` — 5 项结构重叠核实
> - `docs/three-domain-depth-analysis-2026-08-01.md` — 三域专家深度分析
> - `docs/CROSS_VALIDATION_REPORT.md` — 9 项声明交叉验证
> - `docs/review/merged-action-items-2026-07-27.md` — 原始合并待办清单
> - `docs/dba-data-ai-agent-gap-analysis-2026-08-29.md` — DBA/数据/AI 缺口设计
> - `docs/dba-data-deep-review-and-interaction-issues-2026-08-29.md` — 深度评审（GAP/IX/数据库类型）
> - `docs/permission-system-review-and-dba-data-integration-2026-08-29.md` — 权限接入方案
