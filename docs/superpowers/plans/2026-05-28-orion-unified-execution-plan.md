# Orion 系统统一执行计划

> **创建日期**: 2026-05-28
> **基于**: 代码自主探索报告 + 设计方案深度交叉分析 + Go/Python/Rust 迁移状态审计
> **目标**: 修复所有 P0/P1 问题，完成架构治理，推进语言迁移，为新功能开发奠定坚实基础

**Goal:** 在 6 个月内完成 Orion 系统从 P0 安全修复到 Go/Python/Rust 全面迁移的系统性改造。

**Architecture:** 采用"绞杀者模式"（Strangler Fig Pattern）渐进式迁移。先修复当前 Node.js 生产代码的架构问题（Phase 1-3），再逐模块替换为 Go/Rust/Python（Phase 4-6）。每个 Phase 独立可交付、可测试。

**Tech Stack:** TypeScript/Fastify (现有) → Go/Gin (主力迁移) + Python/FastAPI (AI 层) + Rust/Axum (安全层) + PostgreSQL + Redis

---

## 执行摘要

### 问题全景

| 维度 | P0 | P1 | P2 | 来源 |
|------|----|----|-----|------|
| 后端架构（上帝对象/Map存储/Saga Mock） | 5 | 4 | — | 代码分析 |
| 后端代码质量（错误码/日志/空catch） | — | 4 | — | 代码分析 |
| 前端安全（auth-guard/SQL注入/危险操作） | 67 | — | — | AST 扫描 |
| 前端代码质量（Token违规/类型/懒加载） | — | 117 | 631 | AST 扫描 |
| 路由/集成断裂 | 2 | — | — | 交叉分析 |
| Go 迁移（35/42 空壳） | — | — | — | 迁移审计 |
| Rust 迁移（零实现） | — | — | — | 迁移审计 |
| **合计** | **74** | **125** | **631** | — |

### Phase 总览与依赖关系

```
Phase 1: P0 安全与断裂修复 (1-2 周)
    ↓
Phase 2: 后端架构治理 (2-3 周)
    ↓
Phase 3: 前端质量 + 后端测试补全 (2-3 周)  ← 可与 Phase 2 并行
    ↓
Phase 4: SSO 统一认证改造 (3.5 周)
    ↓
Phase 5: Go/Python/Rust 迁移 (6 个月)
    ↓
Phase 6: 新功能模块开发 (持续)
```

---

## Phase 1: P0 安全与断裂修复（1-2 周）

> **目标**: 修复所有阻塞生产运行的 P0 问题。不改架构，只修 bug。

### Task 1.1: 路由注册断裂修复

**Files:**
- Create: `orion-platform-service/src/api/ticketing-routes.ts`
- Create: `orion-platform-service/src/api/cmdb-routes.ts`
- Create: `orion-platform-service/src/api/monitoring-routes.ts`
- Modify: `orion-platform-service/src/api/routes.ts`

- [ ] **Step 1: 创建 ticketing-routes.ts**

```typescript
// orion-platform-service/src/api/ticketing-routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser, requirePermission } from '../middleware/auth';
import { TicketService } from '../services/ticketing/TicketService';
import { TicketingService } from '../services/ticketing/TicketingService';
import { TicketingController } from './controllers/ticketing/TicketingController';

export default async function ticketingRoutes(app: FastifyInstance) {
  const ticketService = new TicketService();
  const ticketingService = new TicketingService();
  const controller = new TicketingController(ticketService, ticketingService);

  // CRUD
  app.post('/api/v1/tickets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'create' })]
  }, controller.createTicket.bind(controller));

  app.get('/api/v1/tickets', {
    onRequest: [authenticateUser]
  }, controller.listTickets.bind(controller));

  app.get('/api/v1/tickets/:id', {
    onRequest: [authenticateUser]
  }, controller.getTicket.bind(controller));

  app.patch('/api/v1/tickets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'update' })]
  }, controller.updateTicket.bind(controller));

  // Workflow
  app.post('/api/v1/tickets/:id/assign', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'assign' })]
  }, controller.assignTicket.bind(controller));

  app.post('/api/v1/tickets/:id/escalate', {
    onRequest: [authenticateUser]
  }, controller.escalateTicket.bind(controller));

  app.post('/api/v1/tickets/:id/resolve', {
    onRequest: [authenticateUser]
  }, controller.resolveTicket.bind(controller));

  app.post('/api/v1/tickets/:id/close', {
    onRequest: [authenticateUser]
  }, controller.closeTicket.bind(controller));

  app.post('/api/v1/tickets/:id/transition', {
    onRequest: [authenticateUser]
  }, controller.transitionStatus.bind(controller));

  // Relations & History
  app.get('/api/v1/tickets/:id/relations', {
    onRequest: [authenticateUser]
  }, controller.getRelations.bind(controller));

  app.get('/api/v1/tickets/:id/history', {
    onRequest: [authenticateUser]
  }, controller.getWorkflowHistory.bind(controller));

  // Analytics
  app.get('/api/v1/tickets/statistics', {
    onRequest: [authenticateUser]
  }, controller.getResolutionStats.bind(controller));

  app.get('/api/v1/tickets/reports/sla', {
    onRequest: [authenticateUser]
  }, controller.getSLACompliance.bind(controller));
}
```

- [ ] **Step 2: 创建 cmdb-routes.ts**

```typescript
// orion-platform-service/src/api/cmdb-routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser, requirePermission } from '../middleware/auth';
import { CmdbService } from '../services/cmdb/CmdbService';
import { TopologyService } from '../services/cmdb/TopologyService';
import { CmdbController } from './controllers/cmdb/CmdbController';

export default async function cmdbRoutes(app: FastifyInstance) {
  const cmdbService = new CmdbService();
  const topologyService = new TopologyService(cmdbService);
  const controller = new CmdbController(cmdbService, topologyService);

  app.get('/api/v1/cmdb/cis', { onRequest: [authenticateUser] }, controller.listCIs.bind(controller));
  app.get('/api/v1/cmdb/cis/:id', { onRequest: [authenticateUser] }, controller.getCI.bind(controller));
  app.post('/api/v1/cmdb/cis', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'create' })]
  }, controller.createCI.bind(controller));
  app.patch('/api/v1/cmdb/cis/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'update' })]
  }, controller.updateCI.bind(controller));
  app.delete('/api/v1/cmdb/cis/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'delete' })]
  }, controller.deleteCI.bind(controller));
  app.get('/api/v1/cmdb/cis/:id/relations', { onRequest: [authenticateUser] }, controller.getRelations.bind(controller));
  app.get('/api/v1/cmdb/topology/:ciId', { onRequest: [authenticateUser] }, controller.getTopology.bind(controller));
  app.get('/api/v1/cmdb/impact-analysis/:ciId', { onRequest: [authenticateUser] }, controller.impactAnalysis.bind(controller));
}
```

- [ ] **Step 3: 创建 monitoring-routes.ts**

```typescript
// orion-platform-service/src/api/monitoring-routes.ts
import { FastifyInstance } from 'fastify';
import { authenticateUser, requirePermission } from '../middleware/auth';
import { MonitoringService } from '../services/monitoring/MonitoringService';
import { MetricCollector } from '../services/monitoring/MetricCollector';
import { AlertRuleEngine } from '../services/monitoring/AlertRuleEngine';
import { AlertNotificationService } from '../services/monitoring/AlertNotificationService';

export default async function monitoringRoutes(app: FastifyInstance) {
  const metricCollector = new MetricCollector({ retentionMs: 24 * 60 * 60 * 1000 });
  const alertRuleEngine = new AlertRuleEngine();
  const notificationService = new AlertNotificationService();
  const monitoringService = new MonitoringService(metricCollector, alertRuleEngine, notificationService);

  app.post('/api/v1/metrics', { onRequest: [authenticateUser] }, monitoringService.recordMetric.bind(monitoringService));
  app.get('/api/v1/metrics/:name', { onRequest: [authenticateUser] }, monitoringService.queryMetrics.bind(monitoringService));
  app.get('/api/v1/metrics', { onRequest: [authenticateUser] }, monitoringService.listMetrics.bind(monitoringService));
  app.post('/api/v1/alert-rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'monitoring', action: 'create' })]
  }, monitoringService.createAlertRule.bind(monitoringService));
  app.get('/api/v1/alert-rules', { onRequest: [authenticateUser] }, monitoringService.listAlertRules.bind(monitoringService));
  app.get('/api/v1/alerts', { onRequest: [authenticateUser] }, monitoringService.listActiveAlerts.bind(monitoringService));
  app.post('/api/v1/alerts/:id/acknowledge', { onRequest: [authenticateUser] }, monitoringService.acknowledgeAlert.bind(monitoringService));
}
```

- [ ] **Step 4: 在 routes.ts 中注册新路由**

```typescript
// orion-platform-service/src/api/routes.ts — 添加 import 和 register
import ticketingRoutes from './ticketing-routes';
import cmdbRoutes from './cmdb-routes';
import monitoringRoutes from './monitoring-routes';

// 在路由注册区域添加：
await app.register(ticketingRoutes);
await app.register(cmdbRoutes);
await app.register(monitoringRoutes);
```

- [ ] **Step 5: 验证路由可访问**

```bash
cd orion-platform-service && npm run dev
# 测试工单
curl -s http://localhost:3001/api/v1/tickets | head -1
# 测试 CMDB
curl -s http://localhost:3001/api/v1/cmdb/cis | head -1
# 测试监控
curl -s http://localhost:3001/api/v1/metrics | head -1
```

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/api/ticketing-routes.ts \
        orion-platform-service/src/api/cmdb-routes.ts \
        orion-platform-service/src/api/monitoring-routes.ts \
        orion-platform-service/src/api/routes.ts
git commit -m "fix(backend): register ticketing/cmdb/monitoring routes (P0 route disconnection)"
```

---

### Task 1.2: Saga Mock 替换为真实实现

**Files:**
- Modify: `orion-platform-service/src/saga/DeploySaga.ts:255-275`
- Modify: `orion-platform-service/src/saga/PipelineSaga.ts:215-230`
- Test: `orion-platform-service/src/saga/__tests__/DeploySaga.test.ts`

- [ ] **Step 1: 修复 DeploySaga Canary Mock**

```typescript
// orion-platform-service/src/saga/DeploySaga.ts — 替换 line 261-275
// 修复前:
// const mockResult = { passed: true, metrics: { latency: 50, ... } };

// 修复后:
try {
  const canaryResult = await this.canaryAnalysisService.analyze({
    deploymentId,
    baselineMetrics: input.baselineMetrics,
    canaryMetrics: input.canaryMetrics,
    durationSeconds: input.canaryConfig?.durationSeconds ?? 60,
    thresholds: input.canaryConfig?.thresholds,
  });

  deployment.status = canaryResult.passed ? DeploySagaStatus.RUNNING : DeploySagaStatus.FAILED;
  deployments.set(deploymentId, deployment);

  return {
    passed: canaryResult.passed,
    metrics: canaryResult.metrics,
    durationSeconds: canaryResult.durationSeconds,
  };
} catch (error) {
  deployment.status = DeploySagaStatus.FAILED;
  deployments.set(deploymentId, deployment);
  throw error;
}
```

- [ ] **Step 2: 修复 PipelineSaga 资源预留 Mock**

```typescript
// orion-platform-service/src/saga/PipelineSaga.ts — 替换 line 218-228
// 修复前:
// const reserved = true;
// 释放资源（模拟）

// 修复后:
const reserved = await this.resourceService.reserveResources({
  runId: context.metadata.runId,
  stages: stages.map(s => ({ id: s.id, resourceRequirements: s.resourceRequirements })),
  tenantId: context.metadata.tenantId,
});

// compensate 中:
await this.resourceService.releaseResources({
  runId: context.metadata.runId,
  stageIds: typedOutput.stages.map(s => s.id),
});
```

- [ ] **Step 3: 运行测试验证**

```bash
cd orion-platform-service && npx jest saga/__tests__/DeploySaga.test.ts --verbose
```

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/saga/DeploySaga.ts \
        orion-platform-service/src/saga/PipelineSaga.ts
git commit -m "fix(backend): replace Saga mock implementations with real service calls (P0 production safety)"
```

---

### Task 1.3: Pipeline 删除权限修复

**Files:**
- Modify: `orion-platform-service/src/api/routes.ts` (L813 附近)

- [ ] **Step 1: 添加权限中间件**

```typescript
// 修复前:
instance.delete('/pipelines/:id', async (request, reply) => {
  return pipelineController.delete(request, reply);
});

// 修复后:
instance.delete('/pipelines/:id', {
  onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'delete' })]
}, async (request: FastifyRequest, reply: FastifyReply) => {
  return pipelineController.delete(request, reply);
});
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/api/routes.ts
git commit -m "fix(security): add permission guard to pipeline delete endpoint (P0)"
```

---

### Task 1.4: 前端 auth-guard 补全（56 处 P0）

**Files:**
- Modify: `orion-frontend/src/router/routes.tsx` — 检查所有路由配置

- [ ] **Step 1: 运行 AST 扫描获取完整清单**

```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts \
  --scan orion-frontend/src/pages/ --max-files 200 --min-confidence 50 \
  2>/dev/null | jq '.issues[] | select(.type == "missing-auth-guard") | .file'
```

- [ ] **Step 2: 在路由配置中添加权限守卫**

对每个缺失 auth-guard 的路由，添加 `meta: { auth: true, permission: 'xxx' }` 配置。

- [ ] **Step 3: 验证**

```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts \
  --scan orion-frontend/src/pages/ --max-files 200 --min-confidence 50 \
  2>/dev/null | jq '.issues[] | select(.type == "missing-auth-guard") | .file' | wc -l
# 预期: 0
```

- [ ] **Step 4: Commit**

```bash
git add orion-frontend/src/router/routes.tsx
git commit -m "fix(security): add auth-guard to 56 unprotected routes (P0)"
```

---

### Task 1.5: 工单模块前端 Mock 替换（7 处）

**Files:**
- Modify: `orion-frontend/src/pages/Ticketing/components/CreateTicketModal.tsx`
- Modify: `orion-frontend/src/pages/Ticketing/TicketList/index.tsx`
- Modify: `orion-frontend/src/pages/Ticketing/TicketDetail/index.tsx`
- Modify: `orion-frontend/src/pages/Ticketing/components/DispatchPanel.tsx`
- Modify: `orion-frontend/src/pages/Ticketing/components/TicketComments.tsx`

- [ ] **Step 1: 替换 CreateTicketModal 的 setTimeout Mock**

```typescript
// CreateTicketModal.tsx — 替换 setTimeout 为真实 API
const handleSubmit = useCallback(async () => {
  try {
    await form.validateFields();
    setSubmitting(true);
    const values = form.getFieldsValue();
    await createTicket(values);  // 替换 setTimeout(resolve, 1000)
    message.success('工单创建成功');
    form.resetFields();
    onSuccess();
  } catch (error: unknown) {
    if (error instanceof Error && error.message !== 'Validation failed') {
      message.error(`创建失败：${error.message}`);
    }
  } finally {
    setSubmitting(false);
  }
}, [form, onSuccess]);
```

- [ ] **Step 2: 替换 DispatchPanel 的 setTimeout Mock**

```typescript
// DispatchPanel.tsx — 替换 setTimeout 为 autoDispatch API
const handleAutoDispatch = async (ticketId: string) => {
  try {
    setDispatching(prev => ({ ...prev, [ticketId]: true }));
    await autoDispatch(ticketId);
    message.success('自动派单成功');
    await refreshList();
  } catch (error: unknown) {
    message.error(`派单失败：${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    setDispatching(prev => ({ ...prev, [ticketId]: false }));
  }
};
```

- [ ] **Step 3: 替换其余 5 处 Mock（TicketDetail/TicketList/TicketComments）**

按同样模式替换所有 `setTimeout` 和 `message.success` 占位为真实 API 调用。

- [ ] **Step 4: Commit**

```bash
git add orion-frontend/src/pages/Ticketing/
git commit -m "fix(frontend): replace 7 ticket mock implementations with real API calls (P0)"
```

---

## Phase 2: 后端架构治理（2-3 周）

> **目标**: 修复代码分析发现的后端架构问题。为 Go 迁移打好基础。

### Task 2.1: PipelineEngine 上帝对象拆分

**Files:**
- Modify: `orion-platform-service/src/engine/PipelineEngine.ts` (2,322行 → 5 个文件)
- Create: `orion-platform-service/src/engine/PipelineParser.ts`
- Create: `orion-platform-service/src/engine/PipelineOrchestrator.ts`
- Create: `orion-platform-service/src/engine/DeploymentStrategyExecutor.ts`
- Create: `orion-platform-service/src/engine/PipelineNotifier.ts`
- Create: `orion-platform-service/src/engine/ApprovalGateManager.ts`

- [ ] **Step 1: 创建 PipelineParser（~300行）**

```typescript
// orion-platform-service/src/engine/PipelineParser.ts
/**
 * 职责：解析 Pipeline YAML、变量展开、预处理
 * 从 PipelineEngine.extracted:
 * - parsePipelineYaml 调用
 * - YamlPreprocessor 集成
 * - ExpressionEvaluator 变量解析
 * - MatrixExpander 矩阵展开
 */
import { Pipeline, parsePipelineYaml } from '../models/Pipeline';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import { MatrixExpander } from './MatrixExpander';
import { YamlPreprocessor } from './YamlPreprocessor';
import { VariableContext } from './VariableContext';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class PipelineParser {
  private expressionEvaluator: ExpressionEvaluator;
  private yamlPreprocessor: YamlPreprocessor | null;
  private matrixExpander: MatrixExpander;

  constructor(
    expressionEvaluator: ExpressionEvaluator,
    yamlPreprocessor: YamlPreprocessor | null,
    matrixExpander: MatrixExpander,
  ) {
    this.expressionEvaluator = expressionEvaluator;
    this.yamlPreprocessor = yamlPreprocessor;
    this.matrixExpander = matrixExpander;
  }

  async parse(yamlContent: string, context: VariableContext): Promise<Pipeline> {
    let processedYaml = yamlContent;
    if (this.yamlPreprocessor) {
      processedYaml = await this.yamlPreprocessor.process(yamlContent, context);
    }
    const pipeline = parsePipelineYaml(processedYaml);
    return pipeline;
  }

  expandMatrix(pipeline: Pipeline): Pipeline {
    return this.matrixExpander.expand(pipeline);
  }
}
```

- [ ] **Step 2: 创建 PipelineOrchestrator（~500行）**

```typescript
// orion-platform-service/src/engine/PipelineOrchestrator.ts
/**
 * 职责：Stage 调度、依赖检查、执行顺序编排
 * 从 PipelineEngine.extracted:
 * - checkNextStages 逻辑
 * - pendingStages/runningStages/completedStages 管理
 * - StageExecutor 调用
 */
import { PipelineRun } from '../models/PipelineRun';
import { Stage } from '../models/Stage';
import { StageExecutor } from './StageExecutor';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface PipelineExecution {
  run: PipelineRun;
  stages: Map<string, Stage>;
  pendingStages: Set<string>;
  runningStages: Set<string>;
  completedStages: Set<string>;
}

export class PipelineOrchestrator {
  private stageExecutor: StageExecutor;
  private executions = new Map<string, PipelineExecution>();
  private nextStageCheckLocks = new Map<string, Promise<void>>();

  constructor(stageExecutor: StageExecutor) {
    this.stageExecutor = stageExecutor;
  }

  async checkNextStages(runId: string): Promise<void> {
    const lock = this.nextStageCheckLocks.get(runId);
    if (lock) {
      await lock;
      return;
    }

    const promise = this._doCheckNextStages(runId);
    this.nextStageCheckLocks.set(runId, promise);
    try {
      await promise;
    } finally {
      this.nextStageCheckLocks.delete(runId);
    }
  }

  private async _doCheckNextStages(runId: string): Promise<void> {
    const execution = this.executions.get(runId);
    if (!execution) return;

    const { stages, pendingStages, runningStages, completedStages } = execution;

    for (const stageId of pendingStages) {
      const stage = stages.get(stageId);
      if (!stage) continue;

      const depsMet = stage.dependencies?.every(dep => completedStages.has(dep)) ?? true;
      if (depsMet && runningStages.size < 3) { // 并发限制
        pendingStages.delete(stageId);
        runningStages.add(stageId);
        this.executeStage(runId, stage);
      }
    }
  }

  private async executeStage(runId: string, stage: Stage): Promise<void> {
    // StageExecutor 调用逻辑
  }
}
```

- [ ] **Step 3: 创建其余 3 个拆分类**

按同样模式创建 `DeploymentStrategyExecutor`、`PipelineNotifier`、`ApprovalGateManager`。

- [ ] **Step 4: 重构 PipelineEngine 为 Facade**

```typescript
// orion-platform-service/src/engine/PipelineEngine.ts — 重构为 Facade
export class PipelineEngine {
  private parser: PipelineParser;
  private orchestrator: PipelineOrchestrator;
  private strategyExecutor: DeploymentStrategyExecutor;
  private notifier: PipelineNotifier;
  private approvalManager: ApprovalGateManager;

  constructor(/* 依赖注入 */) {
    this.parser = new PipelineParser(...);
    this.orchestrator = new PipelineOrchestrator(...);
    this.strategyExecutor = new DeploymentStrategyExecutor(...);
    this.notifier = new PipelineNotifier(...);
    this.approvalManager = new ApprovalGateManager(...);
  }

  // 委托方法 — 保持原有 API 不变
  async runPipeline(pipelineId: string, ...): Promise<PipelineRun> {
    const pipeline = await this.parser.parse(yaml, context);
    return this.orchestrator.execute(pipeline, ...);
  }
}
```

- [ ] **Step 5: 运行现有测试确保不破坏**

```bash
cd orion-platform-service && npx jest engine/ --verbose
```

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/engine/
git commit -m "refactor(engine): split PipelineEngine god object into 5 focused classes (P0 architecture)"
```

---

### Task 2.2: Map 内存存储迁移（5 个 P0 服务）

**Files:**
- Modify: `orion-platform-service/src/services/tenant/TenantQuotaService.ts`
- Modify: `orion-platform-service/src/services/pipeline/PipelineTriggerService.ts`
- Modify: `orion-platform-service/src/services/pipeline/DependencyCoordinationService.ts`
- Modify: `orion-platform-service/src/services/pipeline/PipelineRBACService.ts`
- Create: `orion-platform-service/src/repositories/TenantQuotaRepository.ts`
- Create: `orion-platform-service/src/repositories/PipelineTriggerRepository.ts`
- Create: `orion-platform-service/src/db/migrations/050-map-storage-migration.sql`

- [ ] **Step 1: 创建 Migration**

```sql
-- orion-platform-service/src/db/migrations/050-map-storage-migration.sql
CREATE TABLE IF NOT EXISTS tenant_quotas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  quota_type VARCHAR(50) NOT NULL,
  max_value BIGINT NOT NULL,
  current_usage BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, quota_type)
);

CREATE TABLE IF NOT EXISTS pipeline_triggers (
  id SERIAL PRIMARY KEY,
  trigger_id VARCHAR(100) UNIQUE NOT NULL,
  pipeline_id VARCHAR(100) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  tenant_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_dependencies (
  id SERIAL PRIMARY KEY,
  pipeline_id VARCHAR(100) NOT NULL,
  depends_on VARCHAR(100) NOT NULL,
  dependency_type VARCHAR(50) NOT NULL DEFAULT 'sequential',
  tenant_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pipeline_id, depends_on)
);

CREATE INDEX idx_tenant_quotas_tenant ON tenant_quotas(tenant_id);
CREATE INDEX idx_pipeline_triggers_pipeline ON pipeline_triggers(pipeline_id);
CREATE INDEX idx_pipeline_triggers_tenant ON pipeline_triggers(tenant_id);
CREATE INDEX idx_pipeline_dependencies_pipeline ON pipeline_dependencies(pipeline_id);
```

- [ ] **Step 2: 创建 TenantQuotaRepository**

```typescript
// orion-platform-service/src/repositories/TenantQuotaRepository.ts
import { BaseRepository } from './BaseRepository';

export interface TenantQuotaEntity {
  id: number;
  tenantId: number;
  quotaType: string;
  maxValue: number;
  currentUsage: number;
}

export class TenantQuotaRepository extends BaseRepository<TenantQuotaEntity> {
  constructor() {
    super('tenant_quotas');
  }

  async findByTenantAndType(tenantId: number, quotaType: string): Promise<TenantQuotaEntity | null> {
    const result = await this.query(
      'SELECT * FROM tenant_quotas WHERE tenant_id = $1 AND quota_type = $2',
      [tenantId, quotaType]
    );
    return result.rows[0] || null;
  }

  async incrementUsage(tenantId: number, quotaType: string, amount: number): Promise<void> {
    await this.query(
      'UPDATE tenant_quotas SET current_usage = current_usage + $1, updated_at = NOW() WHERE tenant_id = $2 AND quota_type = $3',
      [amount, tenantId, quotaType]
    );
  }
}
```

- [ ] **Step 3: 重构 TenantQuotaService 使用 Repository**

```typescript
// orion-platform-service/src/services/tenant/TenantQuotaService.ts
// 修复前:
// private quotas: Map<number, TenantQuota> = new Map();
// private usage: Map<string, TenantUsage> = new Map();

// 修复后:
import { TenantQuotaRepository } from '../../repositories/TenantQuotaRepository';

export class TenantQuotaService {
  private quotaRepo: TenantQuotaRepository;

  constructor(quotaRepo: TenantQuotaRepository) {
    this.quotaRepo = quotaRepo;
  }

  async getQuota(tenantId: number, quotaType: string): Promise<TenantQuota | null> {
    return this.quotaRepo.findByTenantAndType(tenantId, quotaType);
  }

  async checkAndIncrement(tenantId: number, quotaType: string, amount: number): Promise<boolean> {
    const quota = await this.quotaRepo.findByTenantAndType(tenantId, quotaType);
    if (!quota) return true; // 无配额限制
    if (quota.currentUsage + amount > quota.maxValue) return false;
    await this.quotaRepo.incrementUsage(tenantId, quotaType, amount);
    return true;
  }
}
```

- [ ] **Step 4: 同样重构其余 3 个服务**

PipelineTriggerService、DependencyCoordinationService、PipelineRBACService 按同样模式迁移。

- [ ] **Step 5: 运行测试**

```bash
cd orion-platform-service && npx jest services/tenant/TenantQuotaService.test.ts --verbose
```

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/services/tenant/TenantQuotaService.ts \
        orion-platform-service/src/services/pipeline/PipelineTriggerService.ts \
        orion-platform-service/src/services/pipeline/DependencyCoordinationService.ts \
        orion-platform-service/src/services/pipeline/PipelineRBACService.ts \
        orion-platform-service/src/repositories/ \
        orion-platform-service/src/db/migrations/050-map-storage-migration.sql
git commit -m "fix(backend): migrate 4 P0 services from Map memory to PostgreSQL (P0 data persistence)"
```

---

### Task 2.3: 错误码统一（24 处 throw new Error → OrionError）

**Files:**
- Modify: `orion-platform-service/src/engine/PipelineEngine.ts` (14 处)
- Modify: `orion-platform-service/src/engine/TaskRunner.ts` (33 处)
- Modify: `orion-platform-service/src/services/pipeline/apk-uploaders.ts` (40 处)

- [ ] **Step 1: 确认 OrionError 导入路径**

```typescript
import { OrionError } from '../errors/OrionError';
// 或
import { OrionError } from '../utils/errors';
```

- [ ] **Step 2: 批量替换 PipelineEngine 中的 throw new Error**

```typescript
// 替换规则:
// throw new Error(`Pipeline '${id}' not found`)
// → throw new OrionError('CLIENT.404.PIPELINE_NOT_FOUND', `Pipeline '${id}' not found`)

// throw new Error('Pipeline has no YAML definition')
// → throw new OrionError('CLIENT.400.NO_YAML_DEFINITION', 'Pipeline has no YAML definition')

// throw new Error(`Task '${name}' failed`)
// → throw new OrionError('BIZ.PIPELINE.TASK_FAILED', `Task '${name}' failed`, { taskName: name })

// throw new Error('Approval gate service not configured')
// → throw new OrionError('SYS.500.SERVICE_NOT_CONFIGURED', 'Approval gate service not configured')
```

- [ ] **Step 3: 运行测试确保不破坏**

```bash
cd orion-platform-service && npx jest engine/ --verbose
```

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/engine/ \
        orion-platform-service/src/services/pipeline/apk-uploaders.ts
git commit -m "fix(backend): unify error codes to OrionError format (24 throw new Error → OrionError)"
```

---

### Task 2.4: 结构化日志替换（496 处 console.log → pino）

**Files:**
- Modify: 散布在 `orion-platform-service/src/` 下的 496 个文件

- [ ] **Step 1: 运行扫描获取 Top 20 文件**

```bash
grep -rn "console\.\(log\|error\|warn\)" orion-platform-service/src/ \
  --include="*.ts" | grep -v test | grep -v __mocks__ | \
  cut -d: -f1 | sort | uniq -c | sort -rn | head -20
```

- [ ] **Step 2: 逐文件替换（Top 20 优先）**

替换规则：
```typescript
// 修复前:
console.log('Pipeline started', runId);
console.error('Failed to execute', error);

// 修复后:
logger.info({ runId }, 'Pipeline started');
logger.error({ runId, error }, 'Failed to execute');
```

- [ ] **Step 3: 验证无 console 残留**

```bash
grep -rn "console\.\(log\|error\|warn\)" orion-platform-service/src/ \
  --include="*.ts" | grep -v test | grep -v __mocks__ | wc -l
# 预期: 0
```

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/
git commit -m "fix(backend): replace 496 console.log with pino structured logging"
```

---

## Phase 3: 前端质量 + 后端测试补全（2-3 周）

> **目标**: 修复前端 P1 代码质量问题，补全后端 20+ 无测试服务的基础测试。可与 Phase 2 并行。

### Task 3.1: Design Token 违规修复（397 处）

**Files:**
- Modify: `orion-frontend/src/pages/` 下 397 个违规文件

- [ ] **Step 1: 运行 AST 扫描获取 Token 违规清单**

```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts \
  --scan orion-frontend/src/pages/ --max-files 200 --min-confidence 50 \
  2>/dev/null | jq '[.issues[] | select(.type == "token-violation")] | length'
```

- [ ] **Step 2: 批量替换硬编码颜色**

```bash
# 使用 AST 引擎自动修复（如果支持）
npx tsx docs/design-constraints/framework/core/cli-check.ts \
  --fix orion-frontend/src/pages/ --type token-violation
```

手动替换规则：
```typescript
// 色值映射
'#3370E6' → colors.primary[500]
'#1890ff' → colors.primary[500]
'#EBF0FB' → colors.primary[50]
'#52c41a' → colors.success[500]
'#faad14' → colors.warning[500]
'#f5222d' → colors.error[500]
'#8c8c8c' → colors.neutral[500]
'#1f1f1f' → colors.neutral[900]

// 圆角映射
'borderRadius: 4px' → borderRadius: radius.xs
'borderRadius: 6px' → borderRadius: componentRadius.button.md
'borderRadius: 12px' → borderRadius: componentRadius.card

// 间距映射
'marginBottom: 16px' → marginBottom: spacing.md
'marginRight: 12px' → marginRight: spacing.sm
'padding: 24px' → padding: componentSpacing.cardPadding.lg
```

- [ ] **Step 3: 验证**

```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts \
  --scan orion-frontend/src/pages/ --max-files 200 --min-confidence 50 \
  2>/dev/null | jq '[.issues[] | select(.type == "token-violation")] | length'
# 预期: < 50
```

- [ ] **Step 4: Commit**

```bash
git add orion-frontend/src/pages/
git commit -m "fix(frontend): replace hardcoded colors/spacing with Design Tokens (397 violations)"
```

---

### Task 3.2: as any 类型修复（前端 56 处）

**Files:**
- Modify: 前端 56 个 `missing-props-type` 文件

- [ ] **Step 1: 获取清单**

```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts \
  --scan orion-frontend/src/pages/ --max-files 200 --min-confidence 50 \
  2>/dev/null | jq '.issues[] | select(.type == "missing-props-type") | .file'
```

- [ ] **Step 2: 逐文件定义 Props 接口并替换 as any**

```typescript
// 修复前:
const { data } = useRequest(() => fetchXxx()) as any;

// 修复后:
interface XxxData {
  id: string;
  name: string;
  // ...
}
const { data } = useRequest<XxxData>(() => fetchXxx());
```

- [ ] **Step 3: Commit**

```bash
git add orion-frontend/src/pages/
git commit -m "fix(frontend): replace 56 'as any' with typed interfaces (P1 type safety)"
```

---

### Task 3.3: 后端测试补全（20+ 无测试服务）

**Files:**
- Create: `orion-platform-service/src/services/lowcode/__tests__/WorkflowEngine.test.ts`
- Create: `orion-platform-service/src/services/dba/__tests__/DbaService.test.ts`
- Create: `orion-platform-service/src/services/mlops/__tests__/MlopsService.test.ts`
- Create: `orion-platform-service/src/services/ai-agents/__tests__/AiAgentsService.test.ts`
- Create: `orion-platform-service/src/services/permission/__tests__/PermissionService.test.ts`
- ... (其余 15 个服务)

- [ ] **Step 1: 获取无测试服务清单**

```bash
find orion-platform-service/src/services -maxdepth 1 -type d | tail -n +2 | while read dir; do
  name=$(basename "$dir")
  if ! find "$dir" -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | grep -q .; then
    echo "NO TEST: $name"
  fi
done
```

- [ ] **Step 2: 为每个服务创建基础测试骨架**

```typescript
// 示例: orion-platform-service/src/services/lowcode/__tests__/WorkflowEngine.test.ts
import { WorkflowEngine } from '../WorkflowEngine';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('createWorkflow', () => {
    it('should create workflow with valid definition', async () => {
      const result = await engine.createWorkflow({
        name: 'test-workflow',
        steps: [{ id: 'step1', type: 'http', config: { url: 'http://test.com' } }],
      });
      expect(result).toBeDefined();
      expect(result.name).toBe('test-workflow');
    });

    it('should reject invalid workflow definition', async () => {
      await expect(engine.createWorkflow({ name: '', steps: [] }))
        .rejects.toThrow();
    });
  });

  describe('executeWorkflow', () => {
    it('should execute single-step workflow', async () => {
      // 基础执行测试
    });
  });
});
```

- [ ] **Step 3: 运行测试**

```bash
cd orion-platform-service && npx jest services/ --verbose --passWithNoTests
```

- [ ] **Step 4: Commit**

```bash
git add orion-platform-service/src/services/
git commit -m "test(backend): add base test suites for 20+ untested services"
```

---

## Phase 4: SSO 统一认证改造（3.5 周）

> **目标**: 统一认证体系，JWT 密钥统一，支持单点登出。详见设计方案 Phase 3.8。

### Task 4.1: JWT 密钥统一（0.5 周）

- [ ] **Step 1: 创建 K8s Secret 统一管理 JWT 密钥**
- [ ] **Step 2: 修改各服务从统一 Secret 读取 JWT_SECRET**
- [ ] **Step 3: 验证 Gateway 能验证子应用 Token**

### Task 4.2: Token 黑名单机制（0.5 周）

- [ ] **Step 1: 创建 Redis Token 黑名单存储**
- [ ] **Step 2: 在认证中间件中检查黑名单**
- [ ] **Step 3: 登出时将 Token 加入黑名单**

### Task 4.3: SSO 认证中心完善（1.5 周）

- [x] **Step 1: 统一登录入口** — sso-unified-routes.ts + sso-routes.ts (legacy auth guards removed)
- [x] **Step 2: OIDC/OAuth2 集成** — SsoService.ts with openid-client v6, Redis state store
- [x] **Step 3: 多租户认证隔离** — X-Tenant-ID injected via subAppAuthAdapter, tenant middleware extracts from JWT/header/subdomain

### Task 4.4: 单点登出（0.5 周）

- [x] **Step 1: 实现全局 Session 失效** — TokenBlacklistService (Redis+DB+memory) + Gateway cache invalidation on logout
- [x] **Step 2: 子应用 Session 联动清除** — OrionBus event broadcast on logout

### Task 4.5: 子应用认证适配（1 周）

- [x] **Step 1: 各子应用后端从 header 获取用户信息** — subAppAuthAdapter.ts injects X-User-* headers
- [x] **Step 2: 移除子应用独立登录逻辑** — verifySubAppUser/requireSubAppAuth helpers provided

---

## Phase 5: Go/Python/Rust 迁移（6 个月）

> **目标**: 按"绞杀者模式"逐模块替换 Node.js 为 Go/Rust/Python。当前完成度 ~8%。

### 5.1 迁移状态总览

| 语言 | 已实现 | 空壳 | 总计 | 完成率 | 目标行数 |
|------|--------|------|------|--------|---------|
| Go | 7 服务 (6,662行) | 35 服务 | 42 服务 | 17% | ~50,000 |
| Python | 4 服务 (4,182行) | — | 4 服务 | 100% (已有) | ~8,000 |
| Rust | 0 | — | 0 | 0% | ~5,000 |
| **合计** | 11 服务 (10,844行) | 35 | 46 | **~8%** | ~63,000 |

### 5.2 Phase A: 基础设施层（3 个月）

| Task | 内容 | 当前状态 | 工作量 |
|------|------|---------|--------|
| A1 | API Gateway → Go | 513行骨架 | 1 人月 |
| A2 | Auth/Tenant/User → Go | 空壳 | 3.5 人月 |
| A3 | 数据库迁移 + Repository 统一 | — | 0.5 人月 |

### 5.3 Phase B: CI/CD 核心（4 个月）

| Task | 内容 | 当前状态 | 工作量 |
|------|------|---------|--------|
| B1 | Pipeline 引擎 → Go | 871行骨架 | 2 人月 |
| B2 | Deploy/Build/Artifact → Go | 699+644行骨架 | 2.5 人月 |
| B3 | Approval/Canary/Scheduler → Go | 空壳 | 1.5 人月 |

### 5.4 Phase C: 可观测性 + 治理（3 个月）

| Task | 内容 | 当前状态 | 工作量 |
|------|------|---------|--------|
| C1 | APM/Alert/Self-Healing → Go | 1,956行 | 3 人月 |
| C2 | Security/Risk/Policy → Rust | 空壳 | 2 人月 |
| C3 | FinOps/Efficiency → Go | 空壳 | 1 人月 |

### 5.5 Phase D: AI 平台（2 个月）

| Task | 内容 | 当前状态 | 工作量 |
|------|------|---------|--------|
| D1 | LLM Trace/AI Agents → Python | 已有 4 服务 | 增强 2 人月 |
| D2 | Knowledge/Vector → Python | 部分已有 | 1 人月 |

### 5.6 Phase E: 业务应用（4 个月）

| Task | 内容 | 当前状态 | 工作量 |
|------|------|---------|--------|
| E1 | Ticketing → Go | 936行骨架 | 1 人月 |
| E2 | CMDB → Go | 1,043行 | 增强 1 人月 |
| E3 | 其余业务模块 → Go | 空壳 | 6 人月 |

### 5.7 Phase F: 全面收尾（2 个月）

| Task | 内容 | 工作量 |
|------|------|--------|
| F1 | 剩余模块迁移 | 3 人月 |
| F2 | Node.js 服务下线 | 1 人月 |
| F3 | 全链路测试 + 性能基线 | 1 人月 |

---

## Phase 6: 新功能模块开发（持续）

> **目标**: 基于 Phase 1-5 建立的坚实基础，开发新功能模块。
> **前提**: Phase 1-4 完成后即可启动，Phase 5 迁移可并行进行。

### 6.1 真正缺失的模块（仅 3 个）

| 优先级 | 模块 | 预估工作量 | 说明 |
|--------|------|-----------|------|
| P1-3 | 智能巡检 | 2 人月 | 无后端服务 + 无前端页面 |
| P1-4 | 容量规划 | 2 人月 | 无后端服务 + 无前端页面 |
| P1-7 | 中间件运维 | 3 人月 | 无后端服务 + 无前端页面 |

### 6.2 已有模块能力增强（17 个，共 12.5 人月）

详见设计方案 Phase 4.2 中的"已有模块能力增强"表。

---

## 附录 A: 执行优先级 DAG

```
                    ┌─────────────────┐
                    │ Phase 1: P0 修复 │ (1-2 周)
                    │ 路由断裂/Saga Mock│
                    │ 权限/auth-guard  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ↓                              ↓
    ┌─────────────────┐            ┌─────────────────┐
    │ Phase 2: 架构治理 │            │ Phase 3: 质量修复 │ (2-3 周，可并行)
    │ PipelineEngine拆分│            │ Token/类型/测试   │
    │ Map→DB/错误码/日志│            │                  │
    └────────┬────────┘            └────────┬────────┘
             │                              │
             └──────────────┬───────────────┘
                            ↓
                  ┌─────────────────┐
                  │ Phase 4: SSO 改造 │ (3.5 周)
                  │ JWT/黑名单/单点登出│
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              ↓                         ↓
    ┌─────────────────┐       ┌─────────────────┐
    │ Phase 5: 语言迁移 │       │ Phase 6: 新功能  │ (持续)
    │ Go/Python/Rust   │       │ 智能巡检/容量规划 │
    │ (6 个月)         │       │ 中间件运维       │
    └─────────────────┘       └─────────────────┘
```

## 附录 B: 工作量汇总

| Phase | 工作量 | 优先级 | 依赖 |
|-------|--------|--------|------|
| Phase 1: P0 安全修复 | 1-2 周 | P0 | 无 |
| Phase 2: 后端架构治理 | 2-3 周 | P0 | Phase 1 |
| Phase 3: 前端质量 + 测试 | 2-3 周 | P1 | 无（可与 Phase 2 并行） |
| Phase 4: SSO 统一认证 | 3.5 周 | P0 | Phase 1 |
| Phase 5: Go/Python/Rust 迁移 | 6 个月 | P1 | Phase 1-2 |
| Phase 6: 新功能开发 | 持续 | P2 | Phase 1-4 |
| **总计** | **~9 个月** | — | — |

## 附录 C: 验收标准

### Phase 1 验收
- [ ] 工单/CMDB/Monitoring API 返回 200（非 404）
- [ ] Saga Canary 分析调用真实服务（非 Mock）
- [ ] Pipeline 删除有权限守卫
- [ ] 56 个前端路由有 auth-guard
- [ ] 工单 7 处前端 Mock 替换为真实 API

### Phase 2 验收
- [ ] PipelineEngine < 500 行
- [ ] 零 `new Map()` 用于业务数据存储
- [ ] 零 `throw new Error`（全部 OrionError）
- [ ] 零 `console.log/error`（全部 pino logger）

### Phase 3 验收
- [ ] Token 违规 < 50 处
- [ ] `as any` < 10 处
- [ ] 后端测试覆盖率 >= 80%

### Phase 4 验收
- [ ] 所有服务使用统一 JWT_SECRET
- [ ] 登出后 Token 立即失效
- [ ] 子应用无独立登录逻辑

### Phase 5 验收
- [ ] 零 Node.js 生产服务
- [ ] Go 服务 QPS >= Node.js 服务
- [ ] 全链路 E2E 测试通过
