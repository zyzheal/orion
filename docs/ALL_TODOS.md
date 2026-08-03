# Orion 平台 — 所有待办汇总（单一权威来源）

> 最后更新: 2026-08-01 | 分支: `feat/wave2-parallel-execution`
> 数据来源: `architecture-review-2026-08-01.md` + `CROSS_VALIDATION_REPORT.md` + `merged-action-items-2026-07-27.md` + `structure-overlap-verification-2026-08-01.md` + `three-domain-depth-analysis-2026-08-01.md`
> 状态: ✅ **已通过专家评审核实** (2026-08-01)，以下为**当前有效清单**

---

## 一、完成状态速览

| 状态 | 数量 |
|------|------|
| ✅ 已完成 | 16 项 |
| 🔴 待处理 | 4 项 P0 |
| 🟡 待处理 | 9 项 P1 |
| 🔵 待处理 | 11 项 P2 |
| ⚠️ 已废弃/不适用 | 9 项 |
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

---

## 三、待处理 — P0 阻塞性 (4 项)

| # | 任务 | 来源 | 详细说明 | 工作量 |
|---|------|------|---------|--------|
| **P0-1** | 前端敏感页面权限守卫 | 架构评审 | 部署/配置/Secret/审批/管理员页面无权限守卫；前端 `usePermission` 仅 4 个引用(AlertList/PipelineList)，敏感页面(ChangeManagement/Secret/Approval/Admin) 0 个 | 1-2 天 |
| **P0-2** | Log 支柱缺失 | 交叉验证 | 可观测性仅有 Metrics(56 files)+Traces(7 files)，无独立日志管理模块，`grep LogManagement/LogQuery/LogSearch` 返回 0 | 2-3 天 |
| **P0-3** | prompt-security 补 Repo 层 | 交叉验证 | handler+service 完整，缺 repository(纯内存策略，重启丢失) | 0.5 天 |
| **P0-4** | alert-deduplication 补 Repo 层 | 交叉验证 | handler+service+models 完整，缺 repository(纯内存去重，重启丢失) | 0.5 天 |

**P0 合计工作量**: 4.5-6 天

---

## 四、待处理 — P1 高优先级 (9 项)

| # | 任务 | 来源 | 详细说明 | 工作量 |
|---|------|------|---------|--------|
| **P1-1** | crossover 补 Repository 实现 | 结构重叠 | RepositoryInterface 已定义(6方法)，无 repository 包，未 wired，23 个 Service 方法无 HTTP 端点 | 1-2 天 |
| **P1-2** | ticketing handler.go 核心拆分 | 结构重叠 | handler.go 仍 1370行/84方法，17 个辅助文件(109方法)全是新增，核心未拆分 | 2-3 天 |
| **P1-3** | chaos 三模块合并 | 结构重叠 | chaos(1384行)+chaos-enhanced(367行)+chaos-gateway(517行)，三模块 Model/Repo/CRUD 完全独立，合并为 chaos-engine | 3-5 天 |
| **P1-4** | 7 个未注册 TS 路由 | merged-action-items | channel, deploy-enhanced, federation, notification-management, pipeline-run-history, pipeline-trend, risk | 1 天 |
| **P1-5** | 9 个孤岛 Controller | merged-action-items | 9 个 Controller 文件存在但 routes.ts 中 0 次路由注册 | 1 天 |
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

> 所有详细分析报告:
> - `docs/architecture-review-2026-08-01.md` — 主统一报告 (1088 行, 9 章)
> - `docs/structure-overlap-verification-2026-08-01.md` — 5 项结构重叠核实
> - `docs/three-domain-depth-analysis-2026-08-01.md` — 三域专家深度分析
> - `docs/CROSS_VALIDATION_REPORT.md` — 9 项声明交叉验证
> - `docs/review/merged-action-items-2026-07-27.md` — 原始合并待办清单
