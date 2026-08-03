# 🏗️ Orion Design Phase 2-3 深度填充实施指南

> 基于 2026-07-27 三次全量精准扫描修正。
> ⚠️ 前两版扫描有大量假阳性，本版经人工验证修正。

---

## 目录

1. [全量扫描结果](#1-全量扫描结果)
2. [Phase 2: 前端补血肉](#2-phase-2-前端补血肉)
3. [Phase 3: 后端补业务逻辑](#3-phase-3-后端补业务逻辑)
4. [执行状态](#4-执行状态)

---

## 1. 全量扫描结果

### 1.1 扫描方法论

三次扫描逐层递进：
- **扫描1**（自动 grep）：标记"NOAPI"页面 + "缺 service" handler
- **扫描2**（人工验证 Layout 壳）：发现 20+ "NOAPI" 全是 Tab/Outlet 壳
- **扫描3**（精确 AST 分析）：发现 "54 缺 service" 全是 service 在上级目录被正确 import

**本版数据全部经人工验证。**

---

### 1.2 前端扫描结果

| 指标 | 值 |
|------|------|
| 页面总数 | 202 |
| 有 API 调用的独立页面 | ~190 |
| Layout 壳（子页面有 API） | ~35 |
| **真正缺 API 的独立页面** | **0** |

**逐页验证结论**：

| 初始标记 | 实际结构 | 子页面/API 状态 | 判定 |
|---------|---------|---------------|------|
| Diagnostic | Layout + 5子页 | Sessions/Reports/Knowledge/Trigger/SessionDetail 全有API | ✅ 完成 |
| Capability | Tab + 3子页 | CapabilityList/RoleCapabilityMapping/UserCapabilityMapping 全有API | ✅ 完成 |
| WorkflowDesigner | Tab + 3子页 | WorkflowList/WorkflowCanvas/ExecutionHistory 全有API | ✅ 完成 |
| CodeMgmt | Layout + 5子页 | RepoList/RepoDetail/BranchPolicyList/CodeOwnersPage/WebhookLog 全有API | ✅ 完成 |
| Monitoring | Layout + 5子页 | Dashboard/Rules/Channels/Alerts/Metrics 全有API | ✅ 完成 |
| ChatOps | Tab + 13子页 | ChatDashboard/AdminSettings/SmartRecommend等 全有API | ✅ 完成 |
| SelfHealing | Layout + 6子页 | ApprovalQueue/StrategyList/IncidentList/IncidentDetail/History/EffectivenessDashboard 全有API | ✅ 完成 |
| IacManagement | Layout + 4子页 | WorkspaceList/PlanViewer/StateBrowser/ModuleRegistry 全有API | ✅ 完成 |
| SkillManagement | Layout + 7子页 | Marketplace/MySkills/SkillSubmission/PendingReviews等 全有API | ✅ 完成 |
| BuildEnv | Layout + 7子页 | BuilderImageList/BuildCachePage/BuildPodList等 全有API | ✅ 完成 |
| ConfirmationWorkbench | Layout + 4子页 | PendingList/BatchConfirmation/NotificationSettings/ConfirmationDetail 全有API | ✅ 完成 |
| NotificationEnhanced | Tab + 6子页 | StrategyTab/IntegrationTab/SubscriptionTab等 全有API | ✅ 完成 |
| ScriptRunner | 独立页 | 操作驱动(handleScan/handleExecute) | ✅ 完成 |
| ScriptVersions | 独立页 | 按钮触发(loadVersions) | ✅ 完成 |
| KnowledgeBase | 微前端入口 | SubAppRoute(加载orion-knowledge) | ✅ 设计如此 |
| Engineer/Manager/ExecutiveDashboard | 独立页 | useBiDashboard hook → @/api/bi | ✅ 完成 |
| SubApps | 独立页(176行) | 纯导航页，硬编码3子系统入口，非业务缺口 | 设计如此 |
| ServerError/NotFound | 错误页 | 静态页面 | 合理 |
| Login | 登录页 | useAuth().login() | ✅ 完成 |

**前端 Phase 2: 无工作待做。所有页面已完成 API 对接。**

---

### 1.3 后端扫描结果

| 指标 | 值 |
|------|------|
| handler.go 总数 | 395 |
| service.go 总数 | 338 |
| repository.go 总数 | 333 |
| handler 已正确 import service | **395 (100%)** |
| handler 使用统一响应(RespondSuccess等) | 185 |
| handler 用 `errors.WriteSuccess+gin.H` | 65 |
| handler 直接用 `gin.H{...}/c.JSON()` | **101** |
| wiring.go 已注册 handler | 221 |
| 有 handler 但未在 wiring 注册 | **174** |
| service.go 含 `make(map)` 内存存储 | **174** |
| service.go 是 stub(TODO/panic) | **6** |

**后端 4 层结构已齐全，真实缺口在 3 个维度：**

| 缺口 | 数量 | 优先级 | 影响 |
|------|------|--------|------|
| **A: 未注册路由** | 174 个 handler | P0 | 代码写了但永远不工作 |
| **B: 响应格式不统一** | 101 个 handler | P1 | 前端解析不一致 |
| **C: 内存存储未持久化** | 174 个 service | P1 | 数据重启丢失 |

---

## 2. Phase 2: 前端补血肉

> 状态：✅ **无需工作。**

所有 202 个页面经逐条验证，API 对接完成度 100%。

---

## 3. Phase 3: 后端补业务逻辑

### 3.1 P0: 注册 174 个未注册 handler

**问题**：174 个 handler 在 `internal/` 下有完整代码，但未在 `cmd/server/wiring.go` 中 import 和 RegisterRoutes，导致这些路由永远不工作。

**策略**：按模块分组启动 Agent，每组 15-20 个相关模块，分批注册。

**分组**：

| 组 | 模块 | 数量 |
|----|------|------|
| A1 | ai(顶层)/ai-degradation/ai-security/ai/子模块 | ~15 |
| A2 | alert(子模块)/api-key/api-consumption/apm/approval/auto | ~15 |
| A3 | cache/build-env/channel/chaos/circuit-breaker/ci-cd | ~15 |
| A4 | cmdb(子模块)/code(子模块)/compliance/config(子模块) | ~15 |
| A5 | eventbus(子模块)/execution/extension/file-handler/finops(子模块) | ~15 |
| A6 | governance(子模块)/identity(子模块)/import-export/inspection | ~15 |
| A7 | job/actions/monitoring(子模块)/notification(子模块)/observability | ~15 |
| A8 | pandawiki/param-types/pipeline(子模块)/security(子模块) | ~15 |
| A9 | skill/sla/smart-deploy/sso/storage/subapp/task/user/vector | ~15 |
| A10 | test-selector/ticketing(子模块)/tool/topology/visor/workflow(子模块) | ~15 |

### 3.2 P1: 统一 101 个 handler 响应格式

**问题**：101 个 handler 直接用 `gin.H{...}` 或 `c.JSON()`，跳过 `middleware.RespondSuccess/Error/Created`。

**目标**：
```go
// 之前
c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
// 之后
middleware.RespondSuccess(c, result)
```

**分组**（按目录）：

| 组 | 模块 | 数量 |
|----|------|------|
| B1 | ai/ (15个) | 15 |
| B2 | infrastructure/ (13个) | 13 |
| B3 | notification/ (8个) + ci-cd/ (8个) | 16 |
| B4 | finops/ (7个) + config/ (7个) | 14 |
| B5 | workflow/ (6个) + identity/ (6个) | 12 |
| B6 | ticketing/ (5个) + security/ (4个) + code/ (4个) | 13 |
| B7 | 其余散点 | 23 |

### 3.3 P1: 迁移 174 个 service 从内存到 PostgreSQL

**问题**：174 个 service 使用 `make(map[string]...)` 做业务数据存储，数据重启即丢失。

**策略**：
1. 有 repository 但 service 没用 → 改 service import repo
2. 无 repository → 先建 repository（建表+CRUD），再改 service

### 3.4 P2: 补全 6 个 stub service

| # | 模块 | 状态 |
|---|------|------|
| 1 | `crossover/service/service.go` | ✅ 已修复(ModuleInfo+RegisterHandler) |
| 2 | `data-catalog/service/service.go` | ✅ 已修复(getDiscoveryConfigs) |
| 3 | `code-repo/service/service.go` | ✅ 已验证：本来无 stub |
| 4 | `pipeline-version/service/service.go` | ⏳ Agent 执行中 |
| 5 | `security-compliance/service/service.go` | ⏳ Agent 执行中 |
| 6 | `tool/service/service.go` | ⏳ Agent 执行中 |

---

## 4. 执行状态

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | AIDashboard/CMDB/PipelineBudget 等首批深度 | ✅ 完成 |
| Phase 2 | 前端补血肉 | ✅ 无需工作 |
| Phase 3-A | 174 个 handler 注册路由 | 🔴 待开始 |
| Phase 3-B | 101 个 handler 统一响应 | 🔴 待开始 |
| Phase 3-C | 174 个 service 迁库 | 🔴 待开始 |
| Phase 3-D | 6 个 stub service | 🟡 3/6 完成 |

---

### 交付标准

```
Phase 3-A: 174 个 handler 全部在 wiring.go 中注册
Phase 3-B: 0 个 handler 直接用 gin.H{...}/c.JSON()
Phase 3-C: 0 个 service.go 含 make(map) 做业务存储
Phase 3-D: 0 个 service 含 TODO/panic/NotImplemented
go build ./... 通过
go test ./internal/... 通过
```
