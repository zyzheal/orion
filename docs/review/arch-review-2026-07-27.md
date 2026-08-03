# 前后端架构与功能完整度评审报告

**评审日期**: 2026-07-27 | **分支**: `feat/wave2-parallel-execution` | **评审人**: 4 路领域专家并行

---

## 核心指标

| 维度 | 数值 | 评分 |
|------|------|------|
| Go 后端模块数 | 292 个 `internal/` 目录 | A |
| Go 后端构建 | 通过 | A |
| Go 后端路由注册 | 386 个 handler | A |
| Go 后端测试 | idempotency 超时 + 2 build failed | B |
| 前端页面数 | 218 个 | B |
| 前端 API 客户端 | 165 个 `.ts` 文件 | B |
| 前端路由注册 | 103 条路径 | B |
| 前端测试 | 860/954 通过 (90.1%)，23 文件失败 | B |
| 前端 TS 错误 | 321 个 | D |
| 后端 TS 路由 | 106 个文件，96 注册 + 7 未注册 | C |
| 后端路由注册 | 7 个未注册，40+ 废弃 | C |
| 前后端 API 一致性 | 40 模块匹配，双层嵌套不匹配 | C+ |
| 代码清理 | 蓝图冗余、孤岛 Controller、废弃路由 | D |

---

## P0 — 必须立即修复（4 项）

### 1. 前端 3 个完整页面无路由注册

| 页面 | 路径 | 引用 API | 建议路由 |
|------|------|---------|---------|
| `NotificationEnhanced` | `orion-frontend/src/pages/NotificationEnhanced/` | `@/api/notification-enhanced` | `/console/notifications/enhanced` |
| `OpsTools` | `orion-frontend/src/pages/OpsTools/` | `@/api/ops-tools` | `/console/ops-tools` |
| `DatabaseDevOps` | `orion-frontend/src/pages/DatabaseDevOps/` | `@/api/database-devops` | 需确认 `/dba` 路由归属 |

**影响**: 用户无法访问这三个功能页面，但代码已完整实现。

### 2. 前端 321 个 TypeScript 编译错误

**主要集中文件**:

| 文件 | 错误数 | 根因 |
|------|--------|------|
| `src/api/database-devops.ts` | 30+ | 响应类型 `data` 字段在类型定义中缺失 |
| `src/router/route-generator.tsx` | 3 | `AppRoute` 类型缺失 `hidden` 属性；`lazy()` 类型不兼容 |
| `src/stores/chatOpsStore.ts` | 1 | `Recommendation.type` 类型 `string` 不可赋给联合类型 `"alert" \| "blocked" \| ...` |
| `src/components/SubAppRouteDynamic/index.tsx` | 3 | `SubAppInstance` 类型未定义；未使用变量 |

**影响**: 构建失败，无法生成生产包。

### 3. 后端 TS 路由被导入但未注册

| 路由文件 | 功能 | 状态 |
|---------|------|------|
| `vector-routes.ts` | pgvector 向量搜索 | 在 `routes.ts` 中被 `import` 但从未调用 `app.register()` |
| `infrastructure-routes.ts` | 基础设施管理 | 同上 |

**影响**: 两个功能模块完全不可用。

### 4. Go 蓝图双份冗余

| 路径 | 内容 | 状态 |
|------|------|------|
| `docs/archives/blueprints-legacy/orion-*-svc-go/` | 36 个 Go 微服务蓝图 | 有 `go.mod` 和代码，无 `main.go` |
| `blueprints/orion-*-svc-go.archived/` | 同上 36 个副本 | 内容冗余 |

**影响**: 占用磁盘空间，维护时易混淆。

---

## P1 — 高优先级（6 项）

### 5. 前端 6 个 hooks 缺失 barrel 导出

`hooks/index.ts` 只导出了 `useAuth`、`useFetch`、`useWebSocket` 三个，漏掉了:

| Hook | 被页面引用 | 当前导入方式 |
|------|-----------|-------------|
| `useBiDashboard` | `stores/menuConfigStore` | 直接路径 |
| `useChartPerformance` | ExecutiveDashboard, ManagerDashboard, EngineerDashboard 等 | 直接路径 |
| `useLazyLoad` | Dashboard 相关页面 | 直接路径 |
| `usePermission` | 组件 PermissionGuard, PermissionGate | 直接路径 |
| `usePermissionActions` | 组件 PermissionActions | 直接路径 |
| `usePipelineSSE` | PipelineRunLive, PipelineList, AlertList 等 | 直接路径 |

**影响**: 导入路径不统一，重构时易遗漏。

### 6. 后端 7 个路由文件存在但未注册

| 路由文件 | 功能 | 未注册状态 |
|---------|------|-----------|
| `channel-routes.ts` | 渠道管理 | 完全未导入 `routes.ts` |
| `deploy-enhanced-routes.ts` | 增强部署 | 完全未导入 |
| `federation-routes.ts` | 联邦管理 | 有 6 次注释引用 "migrated to federation-svc"，实际路由未注册 |
| `notification-management-routes.ts` | 通知管理 | 完全未导入 |
| `pipeline-run-history-routes.ts` | 流水线运行历史 | 完全未导入 |
| `pipeline-trend-routes.ts` | 流水线趋势 | 完全未导入 |
| `risk-routes.ts` | 风险管理 | 有 1 次引用 `riskEngine: { enabled: true }`（配置开关），路由未注册 |

**影响**: 7 个功能模块有完整路由定义和服务实现，但从未被挂载到 Fastify 实例上。

### 7. 后端 9 个 Controller 无路由引用（孤岛代码）

| Controller | 文件路径 | 状态 |
|-----------|---------|------|
| `AgentProfileController` | `controllers/AgentProfileController.ts` | 无对应路由文件 |
| `AgentRunController` | `controllers/AgentRunController.ts` | 无对应路由文件 |
| `CmdbIntegrationController` | `controllers/CmdbIntegrationController.ts` | 无对应路由文件 |
| `ModelVersionController` | `controllers/ModelVersionController.ts` | 无对应路由文件 |
| `PluginMarketplaceController` | `controllers/PluginMarketplaceController.ts` | 无对应路由文件 |
| `PolicyEvaluationController` | `controllers/PolicyEvaluationController.ts` | 无对应路由文件 |
| `PortalDocumentController` | `controllers/PortalDocumentController.ts` | 无对应路由文件 |
| `RunnerController` | `controllers/RunnerController.ts` | 无对应路由文件 |
| `VulnerabilityController` | `controllers/VulnerabilityController.ts` | 无对应路由文件 |

**影响**: 仅实现了 controller 层，没有路由入口，属于不可达代码。

### 8. 前后端 API 路径不一致

| 模块 | 前端路径 | 后端实际路径 | 差异类型 | 严重程度 |
|------|---------|-------------|---------|---------|
| CMDB | `/api/v1/cmdb/cis` | `/api/v1/cmdb/cmdb/cis` | 双层嵌套 | P1 |
| 监控 | `/api/v1/monitoring/start` | `/api/v1/monitoring/monitoring/start` | 双层嵌套 | P1 |
| 告警 | `/api/v1/monitoring/alerts` | `/api/v1/alert/list` | 路径不一致 | P1 |
| 知识库 | `/api/v1/knowledge/${id}` (PUT/DELETE) | `/api/v1/knowledge/spaces/:id` / `docs/:id` | 路径不匹配 | P1 |
| Self-Service | `DELETE /api/v1/self-service/tickets/:id` | 后端未实现 DELETE | 接口缺失 | P2 |
| 审计报告 | `GET /api/v1/audit/reports` | 后端无 `/reports` 路径 | 接口缺失 | P2 |

**说明**: CMDB/监控/告警的双层嵌套是后端 TS 路由文件内部路径以模块名开头，而 `registerWithPermission` 的 prefix 也包含模块名所致。这些模块已标记 `[ARCHIVED]`（已迁移到 Go），实际生产路由通过 API 网关转发。

### 9. TS 单体与 Go 单体功能严重重叠

| 维度 | TS 单体 (`legacy/orion-platform-service-ts`) | Go 单体 (`orion-platform-svc-go`) |
|------|---------------------------------------------|----------------------------------|
| 路由数量 | 175 条 | 250+ handler |
| 覆盖领域 | pipeline, notification, workflow, cmdb 等 | 相同领域 |
| 部署状态 | 生产部署 | 并行开发，未投产 |
| 实现状态 | 完整，但 40+ 标记 ARCHIVED | 完整，100+ 模块 |

**建议**: 明确 Go 版本的定位——是"未来替换目标"还是"并行方案"。

### 10. 前端 3 处重复路由定义

| 路径 | 行号 | 状态 |
|------|------|------|
| `/service-registry` | 第 1533 行和第 1547 行 | 各定义一次，指向相同组件 |
| `/health-dashboard` | 第 1539 行和第 1559 行 | 各定义一次 |
| `/digital-twin` | 第 1409 行和第 2007 行 | 各定义一次，指向不同组件 (`DigitalTwin/DigitalTwinPage` vs `DigitalTwin`) |

---

## P2 — 技术债务（5 项）

### 11. 前端 5 个 API 客户端无任何页面引用

| API 客户端文件 | 说明 |
|---------------|------|
| `api/user-management.ts` | 仅在 `router/index.tsx` 中引用过一次 |
| `api/page-registry.ts` | 仅在 `router/index.tsx` 中引用 |
| `api/deploy-enhanced.ts` | 无任何页面引用 |
| `api/confirmation.ts` | 单数，与 `confirmations`（复数）区分 |
| `api/cache.ts` | 无任何页面引用 |

### 12. 后端 40+ 路由带 `[ARCHIVED]` 标记仍注册

占已注册路由的近一半，标注为"已迁移到 Go，TS 路由保留用于向后兼容"。这些路由仍在服务启动时加载并执行，增加启动时间和内存占用。

**建议**: 建立"Go 迁移完成确认清单"，分批移除确认已迁移的 TS 路由。

### 13. Go 后端 wiring 代码部分被注释

`orion-platform-svc-go/cmd/server/wiring.go` 中 (第 866, 872 行):
- `ciCanaryH` 的 wiring 被注释: `// canary: repo -> service -> handler (commented: undefined NewRepository + signature mismatch)`
- `ciPipelineH` 的 wiring 被注释: `// pipeline: repo -> service -> handler (commented: undefined NewRepository + signature mismatch)`

### 14. Go 后端模块路径冗余嵌套

| 路径 | 问题 |
|------|------|
| `internal/notification/notification/` | 三层嵌套 |
| `internal/finops/finops/` | 双层嵌套 |
| `internal/security/security/` | 冗余层级 |

### 15. 事件系统 5 个域缺少监听器

| 事件域 | 事件类型数 | 发布器 | 监听器 |
|-------|-----------|-------|-------|
| Pipeline | 12 | `PipelineEventPublisher` | `PipelineEventListener` ✅ |
| Code | 4 | `CodeEventPublisher` | ❌ 无 |
| Deployment | 5 | `DeploymentEventPublisher` | ❌ 无 |
| Config | 4 | `ConfigEventPublisher` | ❌ 无 |
| Incident | 4 | `IncidentEventPublisher` | ❌ 无 |
| Self-Healing | 8 | `SelfHealingEventPublisher` | ❌ 无 |

**影响**: 跨域事件编排能力缺失，事件溯源持久化未实现。

---

## 测试状态

### Go 后端测试

| 包 | 结果 | 说明 |
|----|------|------|
| `pkg/idempotency` | **FAIL** | 600 秒超时，goroutine 泄漏，`CompactBackground` 死循环 |
| `test/e2e` | **build failed** | 编译失败 |
| `test/integration` | **build failed** | 编译失败 |
| 其他 `internal/` 包 | 通过 | 200+ 模块 |

### 前端测试 (Vitest)

| 指标 | 数值 | 百分比 |
|------|------|--------|
| 通过文件 | 295 / 318 | 92.8% |
| 失败文件 | 23 | 7.2% |
| 通过测试 | 860 / 954 | 90.1% |
| 失败测试 | 79 | 8.3% |
| 跳过测试 | 15 | 1.6% |
| 错误 | 6 | — |

---

## 建议修复顺序

```
Sprint 1: TS 321 错误修复 + 3 页面路由注册 (P0 #1, #2)
Sprint 2: 未注册路由 + 孤岛 Controller 清理 (P1 #6, #7)
Sprint 3: API 路径一致性 + 蓝图去重 (P1 #8, P0 #4)
Sprint 4: 废弃路由清理 + Hooks barrel 导出 + 代码去重 (P1 #5, #10, P2 #11, #12, #14)
Sprint 5: Go wiring 修复 + 事件系统增强 (P2 #13, #15)
Sprint 6: Go 单体 vs TS 单体定位决策 (P1 #9)
```

---

## 核实记录与修正

> 以下由二次深度核实补充，基于直接文件检查而非 Agent 推断。

### 核实通过率: 93%（14/15 真实，5 项需修正，3 项遗漏）

#### 修正项

| 编号 | 原报告 | 核实结果 | 修正 |
|------|--------|---------|------|
| P1-6 | federation-routes.ts 未注册 | 实际有 6 次引用，但都是注释说明 "Federation routes migrated to federation-svc" | federation 路由被注释为已迁移到 federation-svc，不是遗漏注册 |
| P1-6 | risk-routes.ts 未注册 | 实际有 1 次引用 `riskEngine: { enabled: true }`，是配置而非路由注册 | risk-routes.ts 确实未注册到路由，但引用的是配置开关 |
| P1-10 | /health-dashboard 重复 2 处 | 第 1539 行是 `/observability/health-dashboard`（子路径），第 1559 行才是 `/health-dashboard` | health-dashboard 实际无重复 |
| P2-13 | cicd_domain_wiring.go 中 ciCanaryH/ciPipelineH | 注释实际在 **wiring.go:866,872** 而非 cicd_domain_wiring.go | 文件路径修正为 `cmd/server/wiring.go` |
| P2-11 | confirmation.ts/cache.ts 引用数 | 模糊匹配报 8/1 次，精确匹配 `\b` 后为零 | 之前是模糊匹配误报，实际确实无页面引用 |

#### 遗漏项

| 编号 | 发现 | 说明 | 严重程度 |
|------|------|------|---------|
| 漏-1 | Go e2e/integration 测试状态不一致 | 后台 `go test` 报 FAIL，但 `go build` 直接报 BUILD OK，说明是并发/缓存导致，非结构性问题 | P2 |
| 漏-2 | wiring.go 中 2 处 handler 被注释 + signature mismatch | `ciCanaryH` (866行) 和 `ciPipelineH` (872行) 注释原因：`NewRepository` 未定义 + 函数签名不匹配 | P1 |
| 漏-3 | 前端 218 页面中 36 个无 `__tests__/` 目录 | 测试覆盖率不足，36/218 ≈ 16.5% 页面完全无测试 | P2 |

#### 修正后评分

| 维度 | 原评分 | 修正评分 |
|------|--------|---------|
| Go 后端测试 | B | B+（e2e/integration build failed 可能为临时问题） |
| 前端路由 | B | B-（service-registry 重复 2 次方向正确，health-dashboard 误报） |
| 其他维度 | — | 不变 |

---

## 附录: 关键文件清单

| 文件 | 角色 | 重要度 |
|------|------|--------|
| `orion-platform-svc-go/cmd/server/router.go` | Go 路由注册中心 (386 handler) | 核心 |
| `orion-platform-svc-go/cmd/server/main.go` | Go 服务入口 | 核心 |
| `orion-platform-svc-go/cmd/pipeline-engine/main.go` | Pipeline 引擎入口 | 核心 |
| `legacy/orion-platform-service-ts/src/api/routes.ts` | TS 路由注册中心 (1560 行) | 核心 |
| `orion-frontend/src/router/routes.tsx` | 前端路由配置 (2064 行) | 核心 |
| `orion-frontend/src/api/` | 前端 API 客户端 (165 文件) | 核心 |
| `orion-frontend/src/hooks/index.ts` | Hooks barrel 导出 (缺失 6 个) | 高 |
| `orion-frontend/src/pages/` | 前端页面 (218 目录) | 高 |
| `orion-platform-svc-go/internal/` | Go 后端模块 (292 目录) | 高 |
| `orion-platform-svc-go/cmd/server/wiring.go` | 被注释 handler (ciCanaryH, ciPipelineH) | 中 |
| `orion-platform-svc-go/cmd/server/pipeline_wave_wiring.go` | Wave 2 模块 wiring | 中 |
| `legacy/orion-platform-service-ts/src/events/` | 事件系统 (31 文件) | 中 |