# CI/CD 智能部署模块审计报告

> 审计日期：2026-04-18 | 审计范围：TASK-701 智能部署 | 审计人：Automated Audit

---

## 执行摘要

智能部署模块（TASK-701）实现了完整的**架构骨架**和**业务流程编排**，但所有关键操作均为**模拟（simulation）**，未与任何真实基础设施集成。后端有 9 个 API 路由、7 个服务类、完整的类型定义和工作流编排逻辑，但这些代码在实际部署环境中不会执行任何真实的 Kubernetes 操作、流量切换、健康检查或指标采集。前端有两个页面，列表页从 API 加载数据但存在端点不一致问题，详情页完全使用 mock 数据。整体完成度评估：**骨架 85% / 功能 20%**。

---

## 1. 后端路由审计（deploy-routes.ts）

**文件**: `/Users/heal/orion-design/orion-platform-service/src/api/deploy-routes.ts`

### 1.1 路由注册状态

| 路由 | 方法 | 路径 | 控制器方法 | 服务方法 | 状态 |
|------|------|------|-----------|---------|------|
| 创建部署 | POST | `/deploy` | `deploy()` | `SmartDeployService.deploy()` | 已注册，已挂载 |
| 获取状态 | GET | `/deploy/:id` | `getStatus()` | `SmartDeployService.getStatus()` | 已注册，已挂载 |
| 历史记录 | GET | `/deploy/history` | `getHistory()` | `SmartDeployService.getHistory()` | 已注册，已挂载 |
| 指标数据 | GET | `/deploy/metrics` | `getMetrics()` | `SmartDeployService.getMetrics()` | 已注册，已挂载 |
| 审计追踪 | GET | `/deploy/:id/audit` | `getAuditTrail()` | `SmartDeployService.getAuditTrail()` | 已注册，已挂载 |
| 回滚 | POST | `/deploy/:id/rollback` | `rollback()` | `SmartDeployService.rollback()` | 已注册，已挂载 |
| 回滚历史 | GET | `/deploy/:id/rollbacks` | `getRollbackHistory()` | `SmartDeployService.getRollbackHistory()` | 已注册，已挂载 |
| 取消部署 | POST | `/deploy/:id/cancel` | `cancel()` | `SmartDeployService.cancelDeployment()` | 已注册，已挂载 |
| 最新部署 | GET | `/deploy/latest/:appName/:environment` | `getLatestDeployment()` | `SmartDeployService.getLatestDeployment()` | 已注册，已挂载 |

**结论**: 所有 9 个路由均已正确注册到 Fastify，挂载在 `/deploy` 前缀下（routes.ts 第 211 行）。路由本身没有问题。

### 1.2 端点不一致问题

前端 API 客户端 `deployments.ts` 同时定义了两套端点：
- 旧端点：`/v1/deployments/*` （被 DeploymentList 页面实际使用）
- 新端点：`/v1/deploy/*` （Smart Deploy 端点，未被任何页面使用）

**严重**: `getDeployments()` 调用 `/v1/deployments`，但后端路由注册在 `/deploy`。这意味着前端列表页的 API 调用将返回 404。

---

## 2. SmartDeployService 审计

**文件**: `/Users/heal/orion-design/orion-platform-service/src/services/smart-deploy/SmartDeployService.ts`

### 2.1 职责分析

| 方法 | 预期行为 | 实际行为 | 评估 |
|------|---------|---------|------|
| `deploy()` | 启动智能部署，包含风险评估 | 调用 Workflow，但风险评估 `riskAssessmentFn` 为可选且未提供 | 骨架完整，风险评估缺失 |
| `getStatus()` | 返回部署状态 | 从 in-memory Map 查询 | 实现，但无持久化 |
| `getHistory()` | 带过滤的部署历史 | in-memory 数组过滤+排序 | 实现，但无持久化 |
| `getMetrics()` | 部署指标统计 | in-memory 计算 | 实现，但无持久化 |
| `rollback()` | 触发并执行回滚 | 调用 RollbackService（模拟） | 调用链完整，实际模拟 |
| `cancelDeployment()` | 取消进行中的部署 | 修改 in-memory 状态 | 实现 |
| `getLatestDeployment()` | 获取最新部署 | in-memory 查询 | 实现 |

### 2.2 风险评估（P0 缺失）

`enrichWithRiskAssessment()` 方法（第 266-289 行）中，`riskAssessmentFn` 是可选的，且构造时未传入：

```typescript
this.riskAssessmentFn = options?.riskAssessmentFn;  // always undefined
```

这意味着 `enrichWithRiskAssessment()` 总是直接返回原 config，**风险评估从未执行**。`riskAssessmentId` 在 `deploy()` 中也永远不会被设置。

`selectStrategy()`（第 300-326 行）的策略选择逻辑虽然存在且合理（production->blue-green, staging->canary, dev->recreate），但因为没有风险评估输入，它只基于 environment 做选择。

---

## 3. DeploymentStrategyEngine 审计

**文件**: `/Users/heal/orion-design/orion-platform-service/src/services/smart-deploy/DeploymentStrategyEngine.ts`

### 3.1 策略实现状态

| 策略 | 设计预期 | 实际实现 | 评估 |
|------|---------|---------|------|
| Blue-Green | 创建绿色环境，健康检查，切换流量，验证 | 4 个 stage，每个 stage 的步骤通过 `setTimeout` 模拟 | 结构完整，**完全模拟** |
| Canary | 逐步切换流量 (10%->50%->100%)，每步健康检查 | 3+ stage，trafficState 在内存中更新 | 结构完整，**完全模拟** |
| Rolling | 逐批替换实例，默认 3 replicas | 3 stage，batches 硬编码 `replicas = 3` | 结构完整，**完全模拟** |
| Recreate | 先停旧版本，再启新版本 | 3 stage，scale-down -> deploy -> health | 结构完整，**完全模拟** |

### 3.2 模拟执行核心

所有策略的步骤最终都调用 `simulateStepExecution()`（第 604-616 行）：

```typescript
private async simulateStepExecution(step: DeploymentStep): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, Math.floor(Math.random() * 50) + 10)
  );
  // In production, this would execute actual deployment logic
}
```

**无一例外**：没有任何步骤实际调用 Kubernetes API、Helm、ArgoCD 或任何基础设施组件。

### 3.3 流量管理模拟

`TrafficState`（第 26-33 行）存储在 `Map<string, TrafficState>` 中，是纯内存状态。`switchTraffic()`、`rollbackTraffic()` 方法只是修改 Map 中的百分比值，**没有实际的负载均衡器或 Ingress 配置变更**。

### 3.4 硬编码值

- 第 285 行：`const replicas = 3; // Default, would come from CMDB in production`
- CMDB 集成在设计文档中定义，但未在代码中实现。

---

## 4. RollbackService 审计

**文件**: `/Users/heal/orion-design/orion-platform-service/src/services/smart-deploy/RollbackService.ts`

### 4.1 实现分析

| 方法 | 预期行为 | 实际行为 | 评估 |
|------|---------|---------|------|
| `triggerRollback()` | 创建回滚记录，检查状态 | 检查 rollbackable 状态，创建 RollbackInfo | 逻辑完整 |
| `executeRollback()` | 执行实际回滚操作 | 调用 `performRollback()`（模拟） | **调用链完整，实际模拟** |
| `performRollback()` | 切换流量、缩容、扩容、验证 | `setTimeout` 模拟 50-150ms | **完全模拟** |
| `findPreviousVersion()` | 查询部署历史找上一个版本 | 对版本号字符串做 decrement 操作 | **模拟算法**，不查历史 |

### 4.2 `findPreviousVersion()` 的模拟问题

第 198-224 行：该方法通过字符串分割和 decrement 来"找到"前一个版本，而非查询实际的部署历史。当 patch 和 minor 都是 0 时，直接返回硬编码的 `'0.9.0'`。这在实际生产环境中会导致回滚到错误的版本。

---

## 5. DeploymentVerifier 审计

**文件**: `/Users/heal/orion-design/orion-platform-service/src/services/smart-deploy/DeploymentVerifier.ts`

### 5.1 健康检查（第 27-62 行）

预期检查 `/api/health`、`/api/ready`、`/api/live`。实际通过 `checkEndpoint()`（第 285-350 行）模拟：

```typescript
// Simulate health check request
await new Promise((resolve) =>
  setTimeout(resolve, Math.floor(Math.random() * 50) + 10)
);
return { passed: true, statusCode: expectedStatus, ... };
```

**所有健康检查永远返回 `passed: true`**。在模拟的 try 块中没有任何代码路径会导致失败。

### 5.2 指标验证（第 67-144 行）

所有指标（error_rate、latency_p50/p95/p99、throughput）都是 `Math.random()` 生成的模拟值，**不会查询 Prometheus/DataDog**。

### 5.3 部署对比（第 149-215 行）

`compareWithPrevious()` 中的指标对比也是 `Math.random()` 模拟值，不会获取真实的 Prometheus 指标。

---

## 6. DeploymentHistoryService 审计

**文件**: `/Users/heal/orion-design/orion-platform-service/src/services/smart-deploy/DeploymentHistoryService.ts`

### 6.1 存储机制

第 26-27 行：
```typescript
private deployments: Map<string, Deployment> = new Map();
private auditTrail: AuditTrailEntry[] = [];
```

**所有数据存储在进程内存中**。服务重启后所有数据丢失。无 PostgreSQL、ClickHouse 或任何持久化层。

注释中明确标注：`// In-memory storage (production should use database)`

---

## 7. DeploymentWorkflow 审计

**文件**: `/Users/heal/orion-design/orion-platform-service/src/services/smart-deploy/DeploymentWorkflow.ts`

### 7.1 工作流编排

工作流逻辑（第 57-238 行）是**完整的**，包括：
- Stage 1: Pre-deployment checks
- Stage 2: Execute deployment strategy
- Stage 3: Post-deployment verification
- Stage 4: Complete deployment
- 自动回滚逻辑（第 131-144 行，第 176-183 行）

编排逻辑本身是正确的，但因为所有底层服务（StrategyEngine、Verifier、RollbackService）都是模拟的，整个工作流也是一个**模拟编排**。

### 7.2 逻辑 Bug

**第 119 行 - `completedAt` 状态矛盾**：
当 pre-check 失败时，`completedAt` 被设置，但 `status` 已经是 `'preparing'`（第 94 行），然后改为 `'failed'`。然而 `cancelDeployment()` 的 `cancellableStatuses` 包含 `'preparing'`，意味着在 pre-check 运行期间部署仍然可以被取消。这不是严重 bug，但状态转换有歧义。

---

## 8. 前端 DeploymentList 审计

**文件**: `/Users/heal/orion-design/orion-frontend/src/pages/DeploymentList/index.tsx`

### 8.1 功能检查

| 功能 | 设计预期 | 实际状态 | 评估 |
|------|---------|---------|------|
| 数据表格 | 显示部署列表 | 使用自定义 Table 组件，有 8 列 | 实现 |
| 状态过滤 | 按状态筛选 | SearchFilterBar 有 status/environment 过滤 | 实现 |
| 搜索功能 | 关键词搜索 | 支持 appName/version/triggeredBy/commit | 实现 |
| 状态徽章 | 颜色标识状态 | 使用 StatusBadge 组件 | 实现 |
| 排序 | 按列排序 | duration/startTime 标记 sortable | 部分实现 |
| 操作按钮 | 详情/回滚 | 有"详情"和"回滚"按钮 | 实现 |
| 刷新 | 重新加载 | 有刷新按钮 | 实现 |
| 分页 | 分页显示 | **缺失** | 未实现 |

### 8.2 关键 Bug：API 端点不匹配

第 36 行：
```typescript
const response = await getDeployments();
```

`getDeployments()` 在 `deployments.ts` 中调用 `/v1/deployments`，但后端路由在 `/api/v1/deploy/`。**这是一个 404 bug**。

### 8.3 数据解析脆弱性

第 37-38 行：
```typescript
const apiData = response.data.data;
setDeployments(Array.isArray(apiData) ? apiData : (apiData as any).items || []);
```

前端期望 `response.data.data` 是数组或包含 `items`，但后端 `getHistory` 响应格式是 `{ data: [...], total, limit, offset }`。结构不一致。

### 8.4 状态标签不一致

前端列表页 filterDefs（第 83-105 行）中的状态选项是 `['success', 'running', 'failed', 'warning']`，但后端 `DeploymentStatus` 类型定义为 `['pending', 'preparing', 'deploying', 'verifying', 'completed', 'failed', 'rolled_back', 'cancelled']`。

`success` vs `completed`、`running` vs `deploying`/`preparing`/`verifying` 等**状态命名不一致**。

---

## 9. 前端 DeploymentDetail 审计

**文件**: `/Users/heal/orion-design/orion-frontend/src/pages/DeploymentDetail/index.tsx`

### 9.1 功能检查

| 功能 | 设计预期 | 实际状态 | 评估 |
|------|---------|---------|------|
| 部署信息 | 显示详细信息 | Descriptions 组件展示 | 实现 |
| 阶段进度 | 可视化阶段 | Card 列表展示阶段 | 实现 |
| 健康检查 | 健康状态展示 | 图标+延迟展示 | 实现 |
| 回滚按钮 | 触发回滚 | 有 Modal 确认 | 实现（模拟） |
| 部署时间线 | 时间线视图 | **缺失**，仅显示开始/结束时间 | 未实现 |
| Diff 视图 | 版本对比 | **缺失** | 未实现 |
| 审计追踪 | 审计日志 | **缺失** | 未实现 |
| 回滚历史 | 回滚记录 | **缺失** | 未实现 |

### 9.2 严重 Bug：使用 Mock 数据

第 73 行：
```typescript
const deployment = mockDeployments.find((d) => d.id === id) || mockDeployments[0];
```

**详情页完全不发 API 请求**，直接从 `mockDeployments` 数组中查找。找不到时 fallback 到 `mockDeployments[0]`，意味着任何无效的 deployment ID 都会展示第一条 mock 数据。

### 9.3 回滚是模拟的

第 94-101 行：
```typescript
const handleRollback = () => {
  setIsRollingBack(true);
  setTimeout(() => {
    setIsRollingBack(false);
    message.success('回滚操作已触发，正在执行中...');
  }, 2000);
};
```

**没有调用 `rollback_Deployment()` API**，只是 2 秒后显示 success 消息。

### 9.4 canRollback 逻辑问题

第 104 行：
```typescript
const canRollback = deployment.status === 'success';
```

使用 `'success'` 状态，但后端类型定义中的完成状态是 `'completed'`。在 mock 数据中 status 确实是 `'success'`，但这与后端 API 不一致。

### 9.5 缺少审计追踪页面

后端提供了 `/deploy/:id/audit` 端点，前端 DeploymentDetail 页面没有展示审计追踪数据。

---

## 10. 前端 API 客户端审计

**文件**: `/Users/heal/orion-design/orion-frontend/src/api/deployments.ts`

### 10.1 端点列表

| 函数 | 端点 | 方法 | 被页面使用 | 后端存在 |
|------|------|------|-----------|---------|
| `getDeployments()` | `/v1/deployments` | GET | 是 (DeploymentList) | **否** |
| `getDeployment()` | `/v1/deployments/:id` | GET | 否 | **否** |
| `createDeployment()` | `/v1/deployments` | POST | 否 | **否** |
| `cancelDeployment()` | `/v1/deployments/:id/cancel` | POST | 否 | **否** |
| `smartDeploy()` | `/v1/deploy/deploy` | POST | 否 | 是 |
| `getDeploymentStatus()` | `/v1/deploy/:id` | GET | 否 | 是 |
| `getDeploymentHistory()` | `/v1/deploy/history` | GET | 否 | 是 |
| `getDeploymentMetrics()` | `/v1/deploy/metrics` | GET | 否 | 是 |
| `rollback_Deployment()` | `/v1/deploy/:id/rollback` | POST | 否 | 是 |

**关键发现**：前端定义了正确的 Smart Deploy 端点（`/v1/deploy/*`），但 **DeploymentList 和 DeploymentDetail 页面均未使用这些端点**。DeploymentList 使用了不存在的旧端点，DeploymentDetail 使用了 mock 数据。

### 10.2 类型定义不一致

前端 `Deployment` 接口（第 7-20 行）与后端类型不匹配：
- 前端 `status` 类型：`'pending' | 'deploying' | 'success' | 'failed' | 'rolled_back'`
- 后端 `DeploymentStatus`：`'pending' | 'preparing' | 'deploying' | 'verifying' | 'completed' | 'failed' | 'rolled_back' | 'cancelled'`

缺失：`preparing`、`verifying`、`completed`、`cancelled`
错误：前端有 `success`，后端用 `completed`

---

## 11. 缺失的功能（相对于设计文档）

### 11.1 基础设施集成（全部缺失）

- Kubernetes API 集成：无 `@kubernetes/client-node` 或 `kubectl` 调用
- ArgoCD 集成：无 GitOps 工作流触发
- Helm Chart 管理：无 Chart 部署/升级逻辑
- Ingress/负载均衡器：无流量切换的实际实现
- Prometheus 指标查询：无 PromQL 查询
- CMDB 资源查询：无 CMDB API 调用

### 11.2 前端缺失功能

- 部署时间线可视化（仅显示时间点，无 Timeline 组件）
- 版本 Diff 视图（无法对比两个版本的配置差异）
- 审计追踪展示（后端有端点，前端无 UI）
- 回滚历史展示（后端有端点，前端无 UI）
- 部署指标可视化（metrics 端点存在但无前端页面）
- 实时部署状态推送（无 WebSocket/polling 更新）
- 分页控件（列表页无分页）

### 11.3 设计文档中提及但未实现的

- 风险等级驱动的策略选择（风险评估函数未实现）
- 自动回滚策略（rollbackPolicy 配置存在但未实际使用于基础设施）
- 金丝雀分析窗口（canary analysis period 无实际监控集成）

---

## 12. 逻辑 Bug 和类型错误汇总

| # | 文件 | 行号 | 问题 | 严重性 |
|---|------|------|------|--------|
| B1 | `deployments.ts` (frontend) | 51 | `getDeployments()` 调用 `/v1/deployments`，后端无此路由 | **P0** |
| B2 | `DeploymentDetail/index.tsx` | 73 | 使用 mock 数据，不发 API 请求 | **P0** |
| B3 | `DeploymentDetail/index.tsx` | 94-101 | 回滚是 `setTimeout` 模拟，不调用 API | **P0** |
| B4 | `DeploymentList/index.tsx` | 37-38 | 响应解析与后端格式不匹配 | P1 |
| B5 | `deployments.ts` (frontend) | 12 | `Deployment.status` 类型缺少 `preparing/verifying/completed/cancelled` | P1 |
| B6 | `DeploymentDetail/index.tsx` | 104 | `canRollback` 检查 `'success'`，后端使用 `'completed'` | P1 |
| B7 | `DeploymentList/index.tsx` | 86-92 | 过滤状态值 (`success/running/warning`) 与后端不匹配 | P1 |
| B8 | `SmartDeployService.ts` | 266-289 | `riskAssessmentFn` 始终为 undefined，风险评估从不执行 | P1 |
| B9 | `RollbackService.ts` | 198-224 | `findPreviousVersion()` 使用字符串 decrement 而非查历史 | P1 |
| B10 | `DeploymentStrategyEngine.ts` | 285 | `replicas = 3` 硬编码，未从 CMDB 获取 | P2 |
| B11 | `DeploymentVerifier.ts` | 298-322 | `checkEndpoint()` 永远返回 `passed: true` | P1 |
| B12 | `DeploymentHistoryService.ts` | 26-27 | 数据存储在内存 Map 中，无持久化 | P1 |

---

## 13. 优先级差距列表

### P0 - 阻塞发布

| # | 差距 | 影响 |
|---|------|------|
| P0-1 | 前端 API 端点不匹配 | DeploymentList 页面永远返回 404 |
| P0-2 | DeploymentDetail 使用 mock 数据 | 详情页展示静态假数据 |
| P0-3 | 回滚操作完全模拟 | 点击回滚只弹出 success 消息，不执行任何操作 |

### P1 - 功能缺失

| # | 差距 | 影响 |
|---|------|------|
| P1-1 | 前后端状态枚举不一致 | 状态过滤和显示可能错误 |
| P1-2 | 前端缺少审计追踪/回滚历史 UI | 用户无法查看审计和回滚记录 |
| P1-3 | 风险评估未接入 | 策略选择退化为简单的 environment-based |
| P1-4 | 无 K8s/ArgoCD/基础设施集成 | 部署不执行任何实际操作 |
| P1-5 | 健康检查永远返回通过 | 验证环节无效 |
| P1-6 | 指标数据为随机值 | 指标展示不可信 |
| P1-7 | 数据无持久化 | 服务重启丢失全部部署记录 |
| P1-8 | 列表页缺少分页 | 大数据量场景不可用 |

### P2 - 改进项

| # | 差距 | 影响 |
|---|------|------|
| P2-1 | 硬编码 replicas=3 | 无法适配不同规模的部署 |
| P2-2 | 缺少部署时间线可视化 | 用户体验不足 |
| P2-3 | 缺少版本 Diff 视图 | 无法直观对比变更 |
| P2-4 | 缺少实时部署状态推送 | 用户需要手动刷新 |
| P2-5 | `findPreviousVersion()` 算法粗糙 | 回滚可能选错版本 |

---

## 14. 总结

智能部署模块的代码质量在**架构层面**是值得肯定的：服务分层清晰、类型定义完整、工作流编排逻辑严谨、事件发布机制存在。但这是一个**精致的空壳** -- 所有底层操作（K8s 部署、流量切换、健康检查、指标采集、回滚执行）都是 `setTimeout` 模拟。

从设计文档到实际代码的差距主要体现在：
1. **基础设施集成**：0% -- 没有一行代码与 K8s、ArgoCD、Prometheus 或 CMDB 交互
2. **前端-后端对接**：20% -- 页面存在但 API 不通
3. **数据持久化**：0% -- 全部 in-memory
4. **真实执行能力**：0% -- 所有步骤模拟

建议按 P0 -> P1 -> P2 顺序逐步填补差距。
