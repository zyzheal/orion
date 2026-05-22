# 低评分模块设计优化文档（工单 ITSM / BuildEnv / AI 平台）

> **日期**: 2026-05-22
> **目的**: 为 3 个评分低于 5.5 的模块提供完整修复设计方案
> **评审依据**: 全模块深度扫描（6 Agent 并行，1671 行分报告）

---

## 一、工单 ITSM（4.5/10 → 7/10）

### 1.1 现状总览

| 维度 | 状态 |
|------|------|
| 前端页面 | 10 文件（TicketList/TicketDetail/CreateTicketModal/DispatchPanel/TicketComments ×2） |
| API 对接 | 4 页已调 API，4 处 Mock |
| 后端路由 | routes.ts:413 注释"已迁移到 orion-ticket-svc"，TS/Go 均未运行 |
| 对标 ITIL v4 | CRUD 4/10、SLA 4/10、关联 0/10、CSAT 0/10 |

### 1.2 问题清单（逐行号）

| # | 文件 | 行号 | 问题 | 优先级 |
|---|------|------|------|--------|
| 1 | CreateTicketModal.tsx | 124 | `setTimeout(resolve, 1000)` 模拟创建 | P0 |
| 2 | DispatchPanel.tsx | 265 | `handleSingleDispatch` setTimeout 模拟 | P0 |
| 3 | DispatchPanel.tsx | 273 | `handleAutoDispatchAll` setTimeout 模拟 | P0 |
| 4 | TicketDetail/index.tsx | 307 | `handleEscalate` 仅弹提示，未调 API | P1 |
| 5 | TicketList/index.tsx | 440-450 | `handleAssign` 仅 Modal 确认，未调 `assignTicket` | P1 |
| 6 | TicketList/index.tsx | 486 | 报表按钮弹"开发中" | P2 |
| 7 | TicketDetail/index.tsx | 233 | `history` 状态空数组，无数据源 | P2 |
| 8 | ticket-svc/ 目录 | 5 文件 | 与主目录完全相同的双份实现 | P2 |

### 1.3 修复设计方案

#### P0-1: CreateTicketModal 对接 API

```typescript
// 修复前（行119-134）
await new Promise((resolve) => setTimeout(resolve, 1000));

// 修复后
import { createTicket } from '@/api/ticketing';

const handleSubmit = useCallback(async () => {
  try {
    await form.validateFields();
    setSubmitting(true);
    const values = form.getFieldsValue();
    await createTicket({
      title: values.title,
      category: values.category,
      priority: values.priority,
      description: values.description,
      tags: values.tags || [],
      source: values.source,
      alertId: values.alertId,
      incidentId: values.incidentId,
    });
    message.success('工单创建成功');
    form.resetFields();
    setTitleValue('');
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

#### P0-2: DispatchPanel 对接 API

```typescript
// 后端新增端点
POST /api/v1/tickets/:id/dispatch     # 单个分派
POST /api/v1/tickets/dispatch/batch   # 批量分派

// 前端修复（DispatchPanel.tsx 行263-277）
import { autoDispatch } from '@/api/ticketing';

const handleSingleDispatch = async (ticket: TicketEntry) => {
  try {
    message.loading({ content: `正在为 ${ticket.id} 自动分派...`, key: 'dispatch' });
    await autoDispatch(ticket.id);
    message.success({ content: `${ticket.id} 分派成功`, key: 'dispatch', duration: 2 });
    loadData(); // 刷新队列
  } catch (error: unknown) {
    message.error({ content: `${ticket.id} 分派失败`, key: 'dispatch', duration: 2 });
  }
};

const handleAutoDispatchAll = async () => {
  setDispatching(true);
  try {
    message.loading({ content: '正在执行自动分派...', key: 'autoDispatch', duration: 0 });
    await batchAutoDispatch();
    message.success({ content: '自动分派完成', key: 'autoDispatch', duration: 2 });
    loadData();
  } catch (error: unknown) {
    message.error({ content: '自动分派失败', key: 'autoDispatch', duration: 2 });
  } finally {
    setDispatching(false);
  }
};
```

#### P1-1: TicketDetail handleEscalate 对接 API

```typescript
// TicketDetail/index.tsx 行304-319
import { escalateTicket } from '@/api/ticketing';

const handleEscalate = async () => {
  try {
    const values = await escalateForm.validateFields();
    await escalateTicket(ticket!.id, {
      reason: values.reason,
      escalatedBy: 'current-user',
    });
    message.success(`工单已升级: ${values.reason}`);
    setEscalateModalOpen(false);
    escalateForm.resetFields();
    loadTicket();
  } catch (error: unknown) {
    if (error instanceof Error && error.message !== 'Validation failed') {
      message.error(`升级失败：${error.message}`);
    }
  }
};
```

#### P1-2: TicketList handleAssign 对接 API

```typescript
// TicketList/index.tsx 行440-450
const handleAssign = (ticket: Ticket) => {
  Modal.confirm({
    title: '分配工单',
    content: (
      <Form.Item label="选择工程师">
        <Select
          placeholder="选择工程师"
          onChange={(value) => selectedEngineer = value}
        >
          {engineers.map((e) => (
            <Select.Option key={e.id} value={e.name}>{e.name}</Select.Option>
          ))}
        </Select>
      </Form.Item>
    ),
    onOk: async () => {
      try {
        await assignTicket(ticket.id, { assignee: selectedEngineer });
        message.success(`工单 ${ticket.id} 分配成功`);
        loadTickets();
      } catch (error: unknown) {
        message.error(`分配失败：${(error as Error).message}`);
      }
    },
  });
};
```

### 1.4 后端路由注册

```typescript
// orion-platform-service/src/api/ticketing-routes.ts（新文件）
import { FastifyInstance } from 'fastify';
import { authenticateUser, requirePermission } from '../middleware/auth';
import { TicketingController } from './controllers/ticketing/TicketingController';

export default async function ticketingRoutes(app: FastifyInstance) {
  // 工单 CRUD
  app.get('/api/v1/tickets', { onRequest: [authenticateUser] }, TicketingController.list);
  app.get('/api/v1/tickets/:id', { onRequest: [authenticateUser] }, TicketingController.detail);
  app.post('/api/v1/tickets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'create' })]
  }, TicketingController.create);
  app.patch('/api/v1/tickets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'update' })]
  }, TicketingController.update);
  app.delete('/api/v1/tickets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'delete' })]
  }, TicketingController.delete);

  // 工单操作
  app.post('/api/v1/tickets/:id/assign', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'assign' })]
  }, TicketingController.assign);
  app.post('/api/v1/tickets/:id/escalate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'escalate' })]
  }, TicketingController.escalate);
  app.post('/api/v1/tickets/:id/resolve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'resolve' })]
  }, TicketingController.resolve);
  app.post('/api/v1/tickets/:id/close', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'close' })]
  }, TicketingController.close);
  app.post('/api/v1/tickets/:id/dispatch', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'dispatch' })]
  }, TicketingController.dispatch);
  app.post('/api/v1/tickets/dispatch/batch', {
    onRequest: [authenticateUser, requirePermission({ resource: 'ticket', action: 'dispatch' })]
  }, TicketingController.batchDispatch);
  app.get('/api/v1/tickets/:id/relations', { onRequest: [authenticateUser] }, TicketingController.relations);
  app.get('/api/v1/tickets/:id/history', { onRequest: [authenticateUser] }, TicketingController.history);
  app.get('/api/v1/tickets/statistics', { onRequest: [authenticateUser] }, TicketingController.statistics);
}
```

注册到 routes.ts：
```typescript
import ticketingRoutes from './api/ticketing-routes';
await app.register(ticketingRoutes);
```

### 1.5 验收标准

- [ ] CreateTicketModal 创建成功数据持久化到 PostgreSQL
- [ ] DispatchPanel 分派操作调真实后端 API
- [ ] TicketDetail 升级/分配/解决/关闭全部调 API
- [ ] 工单列表页路由可达（非 404）
- [ ] 双份实现清理（删除 ticket-svc/ 副本）

---

## 二、BuildEnv（4.5/10 → 7.5/10）

### 2.1 现状总览

| 维度 | 状态 |
|------|------|
| 前端页面 | 8 文件（BuilderImageList/BuildCachePage/BuildLogList/BuildLogViewer/BuildPodList/BuildPodDetail/ArtifactList/index） |
| 后端服务 | 12 Service + 7 Controller |
| 路由注册 | 4 条路由全部未注册（build-images/build-cache/build-pods/build-logs） |
| 存储方式 | 3 个 Service 使用 Map 内存存储 |
| K8s 集成 | MockK8sClient（setTimeout 模拟） |
| 双份实现 | pages/code-svc/BuildEnv/ 8 文件完全相同 |

### 2.2 问题清单（逐行号）

| # | 文件 | 行号 | 问题 | 优先级 |
|---|------|------|------|--------|
| 1 | routes.ts | 未注册 | build-images/build-cache/build-pods/build-logs 全部 404 | P0 |
| 2 | BuilderImageService.ts | 132 | Map 内存存储，重启丢失 | P0 |
| 3 | BuildLogService.ts | 38 | Map 内存存储为主 | P0 |
| 4 | CertificateService.ts | 25 | Map 内存存储 + 硬编码加密密钥回退 | P0 |
| 5 | K8sBuildExecutor.ts | 100-213 | MockK8sClient setTimeout 模拟 | P0 |
| 6 | BuilderImageList.tsx | 89 | `.data.data` + `as any` | P1 |
| 7 | BuildCachePage.tsx | 89/114/128/142/157/169 | 5 个异步函数缺 loading | P1 |
| 8 | BuildPodList.tsx | 65 | handleCancel 缺 loading | P1 |
| 9 | BuildPodDetail.tsx | 60 | handleCancel 缺 loading | P1 |
| 10 | ArtifactList.tsx | 72/96/110 | 3 个异步函数缺 loading | P1 |
| 11 | BuildEnv/index.tsx | — | 菜单硬编码 | P2 |
| 12 | pages/code-svc/BuildEnv/ | 8 文件 | 与 pages/BuildEnv/ 完全相同 | P2 |

### 2.3 修复设计方案

#### P0-1: 路由注册

```typescript
// orion-platform-service/src/api/build-env-routes.ts（新文件）
import { FastifyInstance } from 'fastify';
import { authenticateUser, requirePermission } from '../middleware/auth';
import { BuilderImageController } from './controllers/build/BuilderImageController';
import { BuildCacheController } from './controllers/build/BuildCacheController';
import { K8sBuildController } from './controllers/build/K8sBuildController';
import { BuildLogController } from './controllers/build/BuildLogController';

export default async function buildEnvRoutes(app: FastifyInstance) {
  // Builder Images
  app.get('/api/v1/build-images', { onRequest: [authenticateUser] }, BuilderImageController.list);
  app.get('/api/v1/build-images/available', { onRequest: [authenticateUser] }, BuilderImageController.available);
  app.get('/api/v1/build-images/type/:type', { onRequest: [authenticateUser] }, BuilderImageController.byType);
  app.post('/api/v1/build-images', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'create' })]
  }, BuilderImageController.create);
  app.put('/api/v1/build-images/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'update' })]
  }, BuilderImageController.update);
  app.delete('/api/v1/build-images/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'delete' })]
  }, BuilderImageController.delete);

  // Build Cache
  app.get('/api/v1/build-cache/configs', { onRequest: [authenticateUser] }, BuildCacheController.listConfigs);
  app.post('/api/v1/build-cache/configs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'create' })]
  }, BuildCacheController.createConfig);
  app.get('/api/v1/build-cache/entries', { onRequest: [authenticateUser] }, BuildCacheController.listEntries);
  app.delete('/api/v1/build-cache/entries/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'delete' })]
  }, BuildCacheController.deleteEntry);
  app.post('/api/v1/build-cache/cleanup', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'cleanup' })]
  }, BuildCacheController.cleanup);

  // Build Pods
  app.get('/api/v1/build-pods', { onRequest: [authenticateUser] }, K8sBuildController.listPods);
  app.get('/api/v1/build-pods/:id', { onRequest: [authenticateUser] }, K8sBuildController.getPod);
  app.post('/api/v1/build-pods/:id/cancel', {
    onRequest: [authenticateUser, requirePermission({ resource: 'build-env', action: 'cancel' })]
  }, K8sBuildController.cancelPod);

  // Build Logs
  app.get('/api/v1/build-logs', { onRequest: [authenticateUser] }, BuildLogController.list);
  app.get('/api/v1/build-logs/:id', { onRequest: [authenticateUser] }, BuildLogController.get);
  app.get('/api/v1/build-logs/:id/stream', { onRequest: [authenticateUser] }, BuildLogController.streamSSE);
}
```

#### P0-2: PostgreSQL 迁移设计

**BuilderImageRepository**（新文件）：
```typescript
// orion-platform-service/src/repositories/BuilderImageRepository.ts
import { Pool } from 'pg';

export interface BuilderImageRecord {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  base_image: string;
  version: string;
  description?: string;
  status: 'active' | 'deprecated' | 'disabled';
  is_preset: boolean;
  created_at: Date;
  updated_at: Date;
}

export class BuilderImageRepository {
  constructor(private pool: Pool) {}

  async findAll(tenantId: string, type?: string): Promise<{ rows: BuilderImageRecord[]; total: number }> {
    const where = type ? 'WHERE tenant_id = $1 AND type = $2' : 'WHERE tenant_id = $1';
    const params = type ? [tenantId, type] : [tenantId];
    const [data, count] = await Promise.all([
      this.pool.query(`SELECT * FROM builder_images ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, 50, 0]),
      this.pool.query(`SELECT COUNT(*) FROM builder_images ${where}`, params),
    ]);
    return { rows: data.rows, total: parseInt(count.rows[0].count, 10) };
  }

  async create(data: Omit<BuilderImageRecord, 'id' | 'created_at' | 'updated_at'>): Promise<BuilderImageRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO builder_images (tenant_id, name, type, base_image, version, description, status, is_preset)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.tenant_id, data.name, data.type, data.base_image, data.version, data.description, data.status, data.is_preset]
    );
    return rows[0];
  }

  async update(id: string, data: Partial<BuilderImageRecord>): Promise<BuilderImageRecord | null> {
    const fields = Object.keys(data).filter(k => k !== 'id');
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = [id, ...fields.map(f => data[f as keyof typeof data])];
    const { rows } = await this.pool.query(
      `UPDATE builder_images SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`, values
    );
    return rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM builder_images WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }
}
```

**Migration SQL**：
```sql
-- 050-create-builder-images.sql
CREATE TABLE IF NOT EXISTS builder_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(50) NOT NULL,
  base_image  VARCHAR(255) NOT NULL,
  version     VARCHAR(50) NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  is_preset   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_builder_images_tenant ON builder_images(tenant_id);
CREATE INDEX idx_builder_images_type ON builder_images(type);
CREATE UNIQUE INDEX idx_builder_images_tenant_name ON builder_images(tenant_id, name);

-- 插入预置镜像
INSERT INTO builder_images (tenant_id, name, type, base_image, version, is_preset) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Node.js 18', 'nodejs', 'node:18-alpine', '18.0', true),
  ('00000000-0000-0000-0000-000000000000', 'Node.js 20', 'nodejs', 'node:20-alpine', '20.0', true),
  ('00000000-0000-0000-0000-000000000000', 'Python 3.11', 'python', 'python:3.11-slim', '3.11', true),
  ('00000000-0000-0000-0000-000000000000', 'Python 3.12', 'python', 'python:3.12-slim', '3.12', true),
  ('00000000-0000-0000-0000-000000000000', 'Go 1.21', 'go', 'golang:1.21-alpine', '1.21', true),
  ('00000000-0000-0000-0000-000000000000', 'Go 1.22', 'go', 'golang:1.22-alpine', '1.22', true),
  ('00000000-0000-0000-0000-000000000000', 'Java 17', 'java', 'eclipse-temurin:17-jre', '17', true),
  ('00000000-0000-0000-0000-000000000000', 'Java 21', 'java', 'eclipse-temurin:21-jre', '21', true),
  ('00000000-0000-0000-0000-000000000000', '.NET 8', 'dotnet', 'mcr.microsoft.com/dotnet/sdk:8.0', '8.0', true);
```

#### P0-3: K8s 真实集成设计

```typescript
// orion-platform-service/src/services/build/K8sBuildExecutor.ts（替换 MockK8sClient）
import * as k8s from '@kubernetes/client-node';

export class RealK8sClient {
  private coreV1Api: k8s.CoreV1Api;
  private batchV1Api: k8s.BatchV1Api;

  constructor() {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault(); // 集群内自动检测，本地 fallback ~/.kube/config
    this.coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
    this.batchV1Api = kc.makeApiClient(k8s.BatchV1Api);
  }

  async createBuildPod(buildId: string, image: string, env: Record<string, string>): Promise<string> {
    const pod: k8s.V1Pod = {
      metadata: {
        name: `build-${buildId}`,
        namespace: 'orion-build',
        labels: { app: 'orion-build', buildId },
      },
      spec: {
        containers: [{
          name: 'builder',
          image,
          env: Object.entries(env).map(([name, value]) => ({ name, value })),
          resources: {
            limits: { cpu: '2', memory: '4Gi' },
            requests: { cpu: '500m', memory: '1Gi' },
          },
        }],
        restartPolicy: 'Never',
      },
    };

    const response = await this.coreV1Api.createNamespacedPod('orion-build', pod);
    return response.metadata!.name!;
  }

  async getPodStatus(podName: string): Promise<string> {
    const response = await this.coreV1Api.readNamespacedPodStatus(podName, 'orion-build');
    return response.status?.phase || 'Unknown';
  }

  async cancelPod(podName: string): Promise<void> {
    await this.coreV1Api.deleteNamespacedPod(podName, 'orion-build', undefined, undefined, 0);
  }
}
```

### 2.4 验收标准

- [ ] 4 条路由注册成功，前端 API 不再返回 404
- [ ] BuilderImage 数据持久化到 PostgreSQL，重启不丢失
- [ ] BuildLog 数据持久化到 PostgreSQL
- [ ] K8sBuildExecutor 使用真实 K8s API（非 setTimeout）
- [ ] 删除 pages/code-svc/BuildEnv/ 双份实现
- [ ] 所有异步操作有 loading/disabled 状态

---

## 三、AI 平台（5.0/10 → 7/10）

### 3.1 现状总览

| 维度 | 状态 |
|------|------|
| 前端页面 | 14+ 页面（ChatOps 14 + AICostDashboard 6 + LLMTrace 5 + VectorStore 6） |
| 后端服务 | orion-ai-svc (3267 行) + Python 服务 |
| 路由注册 | 6 条路由未注册（AI Gateway/AI Cost/AI Review/AI Docs/AI Security） |
| Mock 问题 | AICostDashboard/AlertConfig 硬编码告警规则（双份实现） |
| 交互问题 | ChatOps/index.chat.tsx 空 catch 块 |

### 3.2 问题清单（逐行号）

| # | 文件 | 行号 | 问题 | 优先级 |
|---|------|------|------|--------|
| 1 | AICostDashboard/AlertConfig.tsx | 51-82 | 告警规则硬编码 Mock 数组 | P0 |
| 2 | finops-svc/AICostDashboard/AlertConfig.tsx | 51-82 | 双份完全相同 | P0 |
| 3 | ChatOps/index.chat.tsx | 57 | 空 catch 块 `.catch(() => {})` | P0 |
| 4 | ChatOps/ApprovalConfig.tsx | — | 缺 loading 状态 | P1 |
| 5 | ChatOps/ChatOpsSettings.tsx | — | 缺 loading + 删除操作缺确认弹窗 | P1 |
| 6 | ChatOps/index.tsx | — | 2 处硬编码颜色 `#3370E6` | P1 |
| 7 | ChatOps/ChatDashboard.tsx | — | 4 处硬编码颜色 `#999`/`#52c41a`/`#722ed1` | P1 |
| 8 | chatops-routes.ts | 98 | `serviceMap = new Map<string, any>()` 为空 | P1 |
| 9 | AICostDashboard/index.tsx | 198-224 | 工作台 tasks 数据硬编码（已修复） | 已完成 |

### 3.3 修复设计方案

#### P0-1: AlertConfig 对接 API

```typescript
// AICostDashboard/AlertConfig.tsx
// 修复前：硬编码 rules 数组（行51-82）
const [rules, setRules] = useState<AlertRule[]>([/* Mock data */]);

// 修复后
import { getAlertRules, createAlertRule, deleteAlertRule } from '@/api/ai-cost';

const [rules, setRules] = useState<AlertRule[]>([]);

const loadRules = async () => {
  setLoading(true);
  try {
    const res = await getAlertRules();
    setRules(res.data.data || []);
  } catch (error: unknown) {
    message.error(`加载告警规则失败: ${(error as Error).message}`);
  } finally {
    setLoading(false);
  }
};

useEffect(() => { loadRules(); }, []);

const handleCreate = async (values: any) => {
  setSubmitting(true);
  try {
    await createAlertRule(values);
    message.success('告警规则创建成功');
    setCreateModalVisible(false);
    createForm.resetFields();
    loadRules();
  } catch (error: unknown) {
    message.error(`创建失败: ${(error as Error).message}`);
  } finally {
    setSubmitting(false);
  }
};
```

#### P0-2: ChatOps 空 catch 块修复

```typescript
// ChatOps/index.chat.tsx 行57
// 修复前
.catch(() => {});

// 修复后
.catch((error: unknown) => {
  if (error instanceof Error) {
    message.error(`消息发送失败：${error.message}`);
  } else {
    message.error('消息发送失败，请稍后重试');
  }
});
```

#### P1-1: ChatOps serviceMap 补全

```typescript
// chatops-routes.ts 行98
// 修复前
const serviceMap = new Map<string, any>();
const commandRouter = new CommandRouter(serviceMap);

// 修复后
const serviceMap = new Map<string, any>([
  ['pipeline', new PipelineCommandService()],
  ['deploy', new DeployCommandService()],
  ['alert', new AlertCommandService()],
  ['cmdb', new CmdbCommandService()],
  ['ticket', new TicketCommandService()],
]);

// 各 CommandService 实现示例
class PipelineCommandService {
  async list(): Promise<CommandResult> { /* 调 PipelineService */ }
  async run(name: string): Promise<CommandResult> { /* 调 PipelineService.run */ }
  async status(id: string): Promise<CommandResult> { /* 调 PipelineService.status */ }
}
```

#### P1-2: 硬编码颜色替换

```typescript
// ChatOps/index.tsx
// 修复前
style={{ color: '#3370E6' }}

// 修复后
style={{ color: colors.primary[500] }}

// ChatOps/ChatDashboard.tsx
// 修复前
color: '#999'        → colors.neutral[500]
color: '#52c41a'     → colors.success[500]
color: '#722ed1'     → colors.purple[500]
```

#### P1-3: ChatOpsSettings loading + 删除确认

```typescript
// ChatOps/ChatOpsSettings.tsx
const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

const handleDelete = async (id: string) => {
  Modal.confirm({
    title: '确认删除',
    content: '此操作不可撤销，是否继续？',
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      setDeleteLoading(id);
      try {
        await deleteBotConfig(id);
        message.success('删除成功');
        loadConfigs();
      } catch (error: unknown) {
        message.error(`删除失败: ${(error as Error).message}`);
      } finally {
        setDeleteLoading(null);
      }
    },
  });
};
```

### 3.4 验收标准

- [ ] AlertConfig 告警规则从 API 加载（非硬编码）
- [ ] finops-svc/AICostDashboard/AlertConfig.tsx 副本删除
- [ ] ChatOps 空 catch 块有错误提示
- [ ] serviceMap 补全 5 个 CommandService
- [ ] 所有硬编码颜色替换为 Design Token
- [ ] ChatOpsSettings 删除操作有二次确认

---

## 四、实施路线图

### Week 1: P0 修复

| 天 | 内容 | 交付物 |
|----|------|--------|
| Day 1 | 工单路由注册 + CreateTicketModal API 对接 | ticketing-routes.ts + CreateTicketModal.tsx 修复 |
| Day 2 | DispatchPanel API 对接 + TicketDetail escalate API | DispatchPanel.tsx + TicketDetail/index.tsx 修复 |
| Day 3 | BuildEnv 4 条路由注册 | build-env-routes.ts |
| Day 4 | BuilderImageService/BuildLogService PostgreSQL 迁移 | BuilderImageRepository + Migration 050 |
| Day 5 | AlertConfig API 对接 + ChatOps 空 catch 修复 | AlertConfig.tsx + index.chat.tsx 修复 |

### Week 2: P1 修复

| 天 | 内容 | 交付物 |
|----|------|--------|
| Day 1 | TicketList handleAssign + handleAssign 后端 API | TicketList/index.tsx + 后端 assign 端点 |
| Day 2 | ChatOps serviceMap 补全 5 个 CommandService | chatops-routes.ts 修复 |
| Day 3 | BuildEnv 6 处 loading 补全 | BuildCachePage/BuildPodList/BuildPodDetail/ArtifactList |
| Day 4 | AI 平台硬编码颜色替换（7 处） | ChatOps/ChatDashboard + index.tsx |
| Day 5 | 双份实现清理 + 空状态补全 | 删除 ticket-svc/finops-svc/code-svc 副本 |

### Week 3: 验收 + 后续

| 天 | 内容 | 交付物 |
|----|------|--------|
| Day 1-2 | 全量回归测试 | 测试报告 |
| Day 3 | 路由可达性验证（14 个模块） | 验证脚本 |
| Day 4 | 文档更新 | CLAUDE.md + 本报告 |
| Day 5 | 交付评审 | 评审报告 |

---

*文档生成时间: 2026-05-22*
*基于深度扫描: 6 Agent 并行，1671 行分报告*
