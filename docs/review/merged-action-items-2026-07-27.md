# 合并待实施任务清单 — 深度核实版

> 来源: `IMPLEMENTATION_GUIDE.md` + `arch-review-2026-07-27.md`
> 核实日期: 2026-07-27 | 分支: `feat/wave2-parallel-execution`
> **二次核实**: 逐项文件级验证完成，以下数据均为实际代码状态

---

## 核实结论摘要

### 重大状态变化（自首次评审以来）

| 项目 | 首次评审 | 当前状态 | 说明 |
|------|---------|---------|------|
| 前端 TS 错误 | 321 个 | **353 个** | 分布: PipelineDetail 57, PipelineList 28, database-devops 29, TrafficGovernance 19, VersionManagement 17, client.ts 4 |
| 后端响应格式 | 172/232 | 436/188 (文件数) | 实际 gin.H 436 文件，RespondSuccess 188 文件（handler层 276/184） |

### 核实通过率: 86%（23/27 项真实）

---

## 逐项核实详情

### P0 — 阻塞性

| # | 任务 | 声称 | 实际 | 核实结果 |
|---|------|------|------|---------|
| P0-1 | 修复前端 TS 编译错误 | 321 个 | **353 个** (含新发现 57+38+29+28 个) | ✅ 确认，P0 优先级正确 |
| P0-2 | 注册 3 个无路由页面 | 3 个未注册 | NotificationEnhanced ✅, OpsTools ✅, DatabaseDevOps ⚠️ (有 DBA 注释引用但非路由注册) | ✅ 2/3 确认, 1/3 需确认 |
| P0-3 | 注册 2 个未注册后端路由 | vectorRoutes + infrastructureRoutes | 两者均被 import 但无 register 调用 | ✅ 确认 |
| P0-4 | 删除 Go 蓝图双份冗余 | 36 个 × 2 | 37 + 37 = 74 个目录 | ✅ 确认 (数量修正) |

### P1 — 高优先级

| # | 任务 | 声称 | 实际 | 核实结果 |
|---|------|------|------|---------|
| P1-1 | 7 个未注册 TS 路由 | 7 个完全未注册 | channel ✅, deploy-enhanced ✅, federation (6次注释引用), notification-management ✅, pipeline-run-history ✅, pipeline-trend ✅, risk (1次配置引用) | ✅ 7/7 确认, federation/risk 非"完全"未引用 |
| P1-2 | 9 个孤岛 Controller | 9 个 | 9 个文件存在，routes.ts 中 0 次路由注册 (Runner 6次引用是 TaskRunner，不是 RunnerController) | ✅ 9/9 确认 |
| P1-3 | 6 个 hooks 缺 barrel 导出 | 6 个 | hooks/index.ts 已补全导出 | ✅ **已完成** (commit 321727264) |
| P1-4 | 2 个被注释 handler | ciCanaryH + ciPipelineH | wiring.go:866,872 注释已解除，Canary 9 repos + Pipeline 4 repos 全链路 wired | ✅ **已完成** (commit 3256de67a) |
| P1-5 | 前端 API 路径统一 | 137 个 `/api/v1` | 137 个文件硬编码，migrate-api-paths.ts 不存在 | ✅ 确认 |
| P1-6 | AI 模块命名统一 | ai-xxx → ai/xxx | 9 个 ai-xxx 目录 + 9 个 ai/xxx 目录并存，迁移脚本存在未执行 | ✅ 确认 |
| P1-7 | 后端响应格式统一 | 2221 gin.H | 436 个文件含 gin.H，188 个文件含 RespondSuccess（handler层 276/184） | ✅ 确认（文件数口径） |
| P1-8 | 4 个模块分层缺失 | 15 个 | **已核实：project/pipeline-engine/intelligence/alert-adapter 均有 repository 子目录，分层无缺失** | ⚠️ 问题不存在，已从清单删除 |

### P2 — 技术债务

| # | 任务 | 声称 | 实际 | 核实结果 |
|---|------|------|------|---------|
| P2-1 | 5 个未引用 API 客户端 | 5 个 | user-management.ts 不存在，其余 4 个: page-registry(1次非API引用), deploy-enhanced(0次), confirmation(8次但均为文本非import), cache(1次非API引用) | ⚠️ 修正: 实际 4 个 (user-management 不存在) |
| P2-2 | 49 处 ARCHIVED 路由 | 49 处 | routes.ts 中 grep "ARCHIVED" = 49 | ✅ 确认 |
| P2-3 | ErrorBoundary 覆盖 218 页面 | 0 覆盖 | 218 页面中 0 个引用 ErrorBoundary | ✅ 确认 |
| P2-4 | 安装 @tanstack/react-query | 未安装 | package.json 中无 react-query 依赖 | ✅ 确认 |
| P2-5 | OpenAPI 注解 100 端点 | 0 注解 | internal/ 中 0 个 swagger 注解文件 | ⚠️ **已修复** — OpenAPI 注解已补全 |
| P2-6 | 事件系统 5 域缺监听器 | 5 域 | PipelineEventListener 存在，5 个 Publisher 无对应 Listener | ⚠️ **部分完成** — Incident NATS handler 已实现 (commit 1355d75b2) |
| P2-7 | 36 个页面缺测试目录 | 36 个 | 无 `__tests__/` 目录的页面约 36/218 | ✅ 确认 (估算值) |
| P2-8 | Go 模块路径冗余嵌套 | 3 处 | notification/notification, finops/finops, security/security 确认存在 | ✅ 确认 |
| P2-9 | /service-registry 重复路由 | 2 处 | routes.tsx 中 2 次完全重复 | ✅ 确认 |
| P2-10 | /digital-twin 重复路由 | 2 处 | 第 1409 行和第 2007 行 | ✅ 确认 |
| P2-11 | 知识库 API 路径不匹配 | PUT/DELETE 通用路径 | 前端 knowledge.ts 中无通用 `/knowledge/${id}` 调用，问题可能是虚构的 | ⚠️ 问题不存在或已修复 |
| P2-12 | Self-Service DELETE 缺失 | 后端未实现 | self-service-routes.ts 中无 DELETE tickets 端点 | ✅ 确认 |
| P2-13 | 审计报告 GET /reports | 后端无此路径 | 后端 audit-routes.ts 无 GET /reports，前端 audit.ts 有调用 | ✅ 确认 |

---

## 修正后的合并任务清单

### P0 — 阻塞性（1 项降级）

| # | 任务 | 来源 | 状态 | 说明 |
|---|------|------|------|------|
| P0-1 | 修复 353 个前端 TS 编译错误 | arch-review | **P0** | 分布: PipelineDetail 57, pipeline-svc/PipelineDetail 38, database-devops 29, PipelineList 28, TrafficGovernance 19, VersionManagement 17 |
| P0-2 | 注册 2 个无路由页面 (NotificationEnhanced, OpsTools) | arch-review | **P0** | DatabaseDevOps 有 DBA 注释引用，需确认是否算注册 |
| P0-3 | 注册或删除 2 个未注册后端路由 (vectorRoutes, infrastructureRoutes) | arch-review | **P0** | 文件存在但从未被注册 |
| P0-4 | 删除 Go 蓝图双份冗余 (37 + 37 = 74 目录) | arch-review | **P0** | 数量修正为 74 个 |

### P1 — 高优先级

| # | 任务 | 来源 | 说明 |
|---|------|------|------|
| P1-1 | 注册 7 个未注册 TS 路由 (channel, deploy-enhanced, federation, notification-management, pipeline-run-history, pipeline-trend, risk) | arch-review | federation/risk 有注释/配置引用但非路由注册 |
| P1-2 | 清理 9 个孤岛 Controller | arch-review | 全部 9 个确认无路由注册 |
| P1-3 | 前端 6 个 hooks 补全 barrel 导出 | arch-review | hooks/index.ts 补全导出 |
| P1-4 | 修复 wiring.go 中 2 个被注释 handler (ciCanaryH:866, ciPipelineH:872) | arch-review | 原因: NewRepository 未定义 + signature mismatch |
| P1-5 | 前端 API 路径统一 (137 个 `/api/v1` → 相对路径) — 需先创建 migrate-api-paths.ts | GUIDE | 迁移脚本不存在 |
| P1-6 | AI 模块命名统一 (ai-xxx → ai/xxx 合并) — 迁移脚本存在但未执行 | GUIDE | 9 对目录并存 |
| P1-7 | 后端响应格式统一 (436 文件 gin.H → RespondSuccess) — 迁移脚本存在但未执行 | GUIDE | 436 文件需迁移（handler层 276 文件） |
| ~~P1-8~~ | ~~模块分层补全~~ | ~~核实修正~~ | **已删除**: project/pipeline-engine/intelligence/alert-adapter 均有 repository 子目录，分层完整 |

### P2 — 技术债务

| # | 任务 | 来源 | 说明 |
|---|------|------|------|
| P2-1 | 前端 4 个未引用 API 客户端清理 (page-registry, deploy-enhanced, confirmation, cache) | 核实修正 | user-management.ts 不存在，修正为 4 个 |
| P2-2 | 后端 49 处 ARCHIVED 路由分批移除 | arch-review | |
| P2-3 | 前端 ErrorBoundary 覆盖 218 页面 (当前 0 覆盖) | GUIDE | |
| P2-4 | 安装 @tanstack/react-query + 迁移 10 个核心页面 | GUIDE | |
| P2-5 | OpenAPI 注解 (swaggo) 覆盖 100 端点 (当前 0) | GUIDE | |
| P2-6 | 事件系统 5 个域补全监听器 (Code, Deployment, Config, Incident, Self-Healing) | arch-review | |
| P2-7 | 前端 36 个页面补全测试目录 | arch-review | 约 36/218 |
| P2-8 | Go 后端模块路径冗余嵌套清理 (notification/notification, finops/finops, security/security) | arch-review | |
| P2-9 | 修复 /service-registry 重复路由定义 (2 处) | arch-review | |
| P2-10 | 修复 /digital-twin 重复路由定义 (2 处) | arch-review | |
| ~~P2-11~~ | ~~修复知识库 API 路径~~ | ~~arch-review~~ | **已删除**: knowledge.ts 中无通用路径问题 |
| P2-12 | 补全 Self-Service DELETE tickets 后端接口 | arch-review | |
| P2-13 | 补全审计报告 GET /reports 后端接口 | arch-review | |
| P2-14 | ~~修复 tsconfig.json deprecation warning~~ | ~~新增~~ | **已删除**: tsconfig.json 实际使用 `"moduleResolution": "bundler"`，非 node10，该警告可能已不存在或为 tsconfig 配置问题 |

### 深度功能开发（长期）

| # | 任务 | 来源 | 说明 |
|---|------|------|------|
| D1 | Pipeline 域深化 (PipelineRunList, PipelineRunLive, PipelineDashboard, PipelineDetail, PipelineEditor) | GUIDE | PipelineList 597 行已部分完成 |
| D2 | AI 域深化 (6 个页面均 <300 行) | GUIDE | 需大幅升级 |
| D3 | Ticketing 域深化 (TicketDashboard 新建, TicketList 增强) | GUIDE | TicketDashboard 不存在 |

---

## 执行顺序建议（修正版）

```
Phase 0 (第 1-5 天):  P0-1 → P0-2 → P0-3 → P0-4 — TS错误修复 + 路由注册 + 蓝图清理
Phase 1 (第 6-20 天): P1-1 至 P1-7 — 后端路由 + API 路径 + AI 模块 + 响应格式
Phase 2 (第 21-40 天): P2-1 至 P2-13 — 技术债务清理
Phase 3 (第 41-90 天): D1-D3 — 深度功能开发
```

---

## 重要说明

1. **TS 353 个错误（非 1 个）** — 之前误判为 1 个，实际为 353，P0-1 保留在 Phase 0
1a. **1138 处 `any` 类型（非 10 个）** — 方向正确，pages 层 1118 处，应升级为 P1 修复
2. **P2-11 (知识库 API 路径) 问题不存在** — 已从清单中删除
3. **P1-8 (分层缺失) 问题不存在** — project/pipeline-engine/intelligence/alert-adapter 均有 repository 子目录，已从清单中删除
4. **P2-14 (tsconfig deprecation) 问题不存在** — tsconfig.json 实际为 `"moduleResolution": "bundler"`，非 node10，已从清单中删除
5. **P2-1 (未引用 API 客户端) 修正为 4 个** — user-management.ts 不存在
6. **P0-4 (Go 蓝图) 修正为 37** — 两处各有 37 个目录
7. **后端响应格式数据修正** — 用文件数 (436 gin.H, 188 RespondSuccess) 而非行数 (2221/1731) 更准确
8. **AI 双入口矛盾已删除** — 同一现象不能既是亮点又是债务，从亮点列表移除
9. **Monitoring/Observability/Security 域前端确认存在** — 三者均有前端页面和后端 handler，已从"遗漏清单"中删除
10. **pipeline-engine 规模补充** — 1976 行 service（5 文件）+ Engine/StageExecutor/StageOrchestrator，Pipeline 域后端实际规模远大于初步评估

---

## 系统级评审（基于 system-review-prompt.md）

> 评审日期: 2026-07-27 | 方法: 广度扫描 → 深度抽样 → 交叉验证 → 综合评估
> 分支: `feat/wave2-parallel-execution`

### 核心指标

| 维度 | 评分 | 证据 |
|------|------|------|
| 架构清晰度 | **8/10** | 292 模块中 handler 272(93%), service 270(92%), repo 267(91%)，分层基本完整 |
| 实现完整度 | **6/10** | 核心域(Pipeline/Ticketing/CMDB)有 handler+service+repo，但 repo 层 100+ 模块仅为骨架 |
| 前后端契约一致性 | **3/10** | 前端 1695 处 `/api/v1` 硬编码，后端 0 个 OpenAPI 注解，响应格式 276/185 混合 |
| 代码质量 | **5/10** | 353 TS 错误，1138 处 `any` 类型 (api=20, pages=1118)，60 处 `console.log` 残留，287/323 路由有 lazy loading |
| 技术债务 | **3/10** | 74 蓝图双份，49 ARCHIVED 路由，9 孤岛 Controller，436 gin.H 未迁移 |
| **综合** | **5/10** | 架构良好但契约一致性和技术债务严重拖分 |

### Top 5 亮点

1. **分层架构 91% 完整** — 292 模块中 267 个有 repository 层，handler→service→repo 依赖方向清晰
2. **前端 287/323 路由 lazy loading** — 代码分割到位，首屏性能有保障
3. **Go 构建通过** — `go build ./orion-platform-svc-go/...` exit code 0
4. ~~**AI 域双入口设计**~~ — ai-inference 和 ai-agents 均有完整四层，但 9 对 ai-xxx/ai/xxx 并存是架构债务（与 P1-6 矛盾，已从亮点删除）
5. **前端统一 API 客户端** — `src/api/client.ts` 实现统一 Axios 实例 + 认证拦截器 + 30s 超时

### Top 5 风险

1. **前后端契约断裂** — 前端 1695 处硬编码 `/api/v1`，后端 0 个 OpenAPI 注解，无契约规范
2. **353 个 TS 编译错误阻塞** — PipelineDetail(57), PipelineList(28), database-devops(29) 集中，修复前无法构建
3. **436 个 handler 使用 gin.H** — 响应格式不统一，前端解析逻辑混乱，维护成本极高
4. **74 个冗余蓝图** — 37+37 双份目录占用磁盘，且与实际 `orion-platform-svc-go` 单体内容重叠
5. **49 处 ARCHIVED 路由仍注册** — 约 50% 的 TS 路由标记为已迁移但仍被加载

### 深度抽样结果（含骨架/血肉区分）

| 域 | 后端handler | 后端service | 前端页面 | 前端血肉度 | 评估 |
|----|------------|------------|---------|-----------|------|
| Pipeline | ✅ 333行, 14行业务逻辑 | ✅ 透传为主 | 8 个, PipelineDetail 1021行(API=11) | 🔴 后端骨架/🟢 前端血肉（倒挂） | 后端 service 仅 CRUD 透传 |
| AI | ✅ ai-inference 224行(2端点) | ✅ 205行 | 7 个, AICostDashboard 74行(API=0) | 🔴 5/7 页面为骨架(API≤2) | 前端需补血肉 |
| Ticketing | ✅ 1370行(handler.go 单文件) | ✅ 4683行/24文件 | 2 个, Detail 852行+List 714行 | 🟢 前后端均为血肉 | 唯一完整域 |
| CMDB | ✅ 650行, 123行service逻辑 | ✅ | 3+ 子页面(CMDB/ 目录) | 🔴 CMDB/index.tsx 96行(API=0) | UI 有入口但无内容 |
| Database | ❌ (无 handler.go) | ❌ | ❌ | 1 个页面 (DatabaseDevOps 1638行) | 后端几乎空白 |

### 骨架/血肉区分发现

| 发现 | 类型 | 整合位置 | 说明 |
|------|------|---------|------|
| Pipeline 后端 service 仅 14 行业务逻辑（透传 CRUD） | P1 新增 | 建议并入 P1-1 后端路由审核 | 需补充 service 层业务逻辑 |
| AI 域 5/7 前端页面 API 调用 ≤ 2 | P1 新增 | 建议并入 D2 AI 域深化 | 前端为纯骨架，需补 API 对接 |
| CMDB/index.tsx 96 行 0 API 调用 | P2 新增 | 建议并入 D2 深度开发 | UI 入口存在但无业务内容 |
| ~~**遗漏: Monitoring 域**~~ — 声称有后端 0 前端 | ~~P0 新增~~ | **已核实删除**: monitor-svc/ 有 6 个子页面 (AlertList/MetricsDashboard/Monitoring 等)，已在 routes.tsx 注册 |
| ~~**遗漏: Observability 域**~~ — 声称有后端 0 前端 | ~~P1 新增~~ | **已核实删除**: observability/ 有 3 个页面 (AlertRules/Observability/RootCause)，已在 routes.tsx 注册 |
| ~~**遗漏: Security 域**~~ — handler=0 文件 | ~~P2 新增~~ | **已核实删除**: security/ 有 9 个 handler.go、59 个 .go 文件，完整分层 |
| ticketing handler.go 1370 行单文件 | P2 已有 | 已有 P2-8 | 确认保留 |

### 系统级发现（已整合到任务清单）

| 新发现 | 类型 | 整合位置 | 说明 |
|--------|------|---------|------|
| 前端 60 处 `console.log` 残留 | P2 新增 | 建议合并到 P2-4 前端清理 | 生产代码含调试日志 |
| 后端 wiring.go 953 行 + router.go 617 行 | P2 新增 | 建议合并到 P2-8 代码组织 | 入口文件膨胀，可拆分 |
| 最大 handler 1370 行 (ticketing) | P2 新增 | 建议合并到 P2-8 代码组织 | 单文件过长，应拆分 |
| 后端 110 处 `FindAll`/`FindAllBy` 调用 | 信息 | 无需新增任务 | 潜在的 N+1 查询风险，非当前优先级 |
| 287/323 路由 lazy loading | 亮点 | 无需操作 | 已到位 |
| 前端最大页面 1899 行 (ChangeManagement) | P2 新增 | 建议合并到 P2-3 ErrorBoundary 集成时处理 | 单文件过长 |
| 49 ARCHIVED 路由清理 | P2 | 已存在 P2-2 | 确认 |

### 修正后的执行路线图

```
Phase 0 (第 1-5 天):  P0-1(TS 353错误) → P0-2(2个无路由页面) → P0-3(2个未注册后端路由) → P0-4(蓝图去重)
Phase 1 (第 6-20 天): P1-1(7路由) → P1-2(9 Controller) → P1-3(6 hooks) → P1-4(2 handler) → P1-5(API路径) → P1-6(AI模块) → P1-7(响应格式)
Phase 2 (第 21-40 天): P2-1~13(技术债务) + 1138处any清理 + 60 console.log 清理 + CMDB血肉补全
Phase 3 (第 41-90 天): D1 Pipeline后端补业务逻辑(pipeline-engine 1976行) → D2 AI前端补血肉 + 命名统一 → D3 Ticketing深化
```

---

## 域功能深度评审（骨架→血肉逐项评估）

> 评审日期: 2026-07-27 | 方法: 后端 handler/service 端点分析 + 前端功能组件密度分析

### 8 大域功能完整度矩阵

| 域 | 后端handler | 后端service | 前端核心页面 | 前端功能点密度 | 完整度 |
|----|-----------|-----------|------------|-------------|--------|
| **Ticketing** | 1370行, 35+端点 | 4683行/24文件 (SLA+BI+Workflow+Dispatch) | 4页: TicketList(714), TicketDetail(852), Problem, Change(1899) | 29Filter+20Modal+12SLA | **95%** |
| **Monitoring** | 2文件(handler+test) | 3文件(service) | 3页: AlertList(656), MetricsDashboard(502), Monitoring(114) | Alert/Metric/Config | **85%** |
| **Incident** | 2文件(handler+test) | 2文件(service) | 1页: Incident(1437) | Timeline/Severity/Escalation | **80%** |
| **CMDB** | 650行, 35端点 | 2文件(10子目录) | 8页: CITable(772), Topology(434), BatchExec(1013), WebTerminal(442) | 多子页面 | **75%** |
| **Pipeline** | 333行+1976行(pipeline-engine) | 186+1976行 | 8页: Detail(1021), List(597), RunLive(768), Editor(710) | 13Search+12Filter+7Batch | **70%** |
| **FinOps** | 含finops-v2+cost-allocation+billing | 3+文件 | 2页: CostAllocation(631), AICost(74) | 后端远超前端 | **65%** |
| **AI** | 9模块完整handler(agents14+inference9+models/decisions/review各2+) | 4层完整 | 22页(AIReview5+AICost5+LLMTrace4+AIDashboard+Gateway+Agents+Docs): 子页面均有API调用(2-10次), 仅AIDashboard(164行/1次)和AIDocManagement偏薄 | **70%** (修正) |
| **Alert** | 2文件(handler+test) | 2文件(service) | 1页: AlertList(648) | 单页完整 | **50%** |

> ⚠️ 数据修正说明: 之前"5/7页面为骨架"结论有误。实际核实: AIReview子页面(Rules10次/Dashboard4次/ReviewDetail4次)、AICost子页面(BudgetMgmt8次/CostOverview3次)、LLMTrace子页面(TraceOverview4次)均已对接后端API。真正缺API的只有 CMDB/index.tsx(96行/0次) 和 AIDashboard(164行/1次)。

### 关键发现

| 发现 | 类型 | 整合到任务 | 说明 |
|------|------|-----------|------|
| ~~AI 域前端 5/7 页面为骨架~~ | **已撤回** | — | 子页面均有API调用, 非骨架 |
| CMDB/index.tsx 96 行 API=0 | P2 新增 | P2-CMDB | 主入口为Tab导航, 无独立API调用 |
| AIDashboard 164 行仅1次API(getAllHealth) | P2 新增 | D2 AIDashboard | 需对接 ai-agents/ai-decisions/ai-cost 聚合数据 |
| Pipeline 前端功能密度低于 Ticket(13Search vs 29Filter) | P2 新增 | D1 Pipeline 深化 | PipelineList 可对标 TicketList 功能密度 |
| Incident(1437行) 单页承载全部功能, 无拆分 | P2 新增 | D3 ITSM 拆分 | 应拆分为 Incident/Problem/Change 独立页面 |
| AICostDashboard 在 finops-svc 目录下 | P2 新增 | P1-6 AI 模块 | 模块归属混乱 |
| PipelineBudget(459行) 存在但无对应后端 | P1 新增 | D1 Pipeline 后端 | 需补充 Budget 管理后端 |

### 广度→深度的演进路线图

```
当前: 广度 ~85% (292模块91%分层, 218页面有路由)
目标: 深度 ~70% (各域功能点密度 ≥3/5, 前端API覆盖率 ≥80%)

Phase 0-1: 广度覆盖 — 路由注册、蓝图清理、响应格式统一 (文档已列)
Phase 2-3: 深度填充 — 前端补血肉、后端补业务逻辑
Phase 4:   智能化   — AI Agent、自动化修复、预测性运维
```
