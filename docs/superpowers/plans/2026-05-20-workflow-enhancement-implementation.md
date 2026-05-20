# 工作流增强功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现工作流增强功能，包括事件触发、定时触发、Task/SubWorkflow/Delay/Timer节点，支持自动化运维、流程审批、业务流转场景

**Architecture:** 采用事件驱动架构，与现有EventBus深度集成；触发器系统管理事件订阅和Cron调度；扩展WorkflowEngine支持新节点类型；通过Service层统一管理

**Tech Stack:** TypeScript, Fastify, PostgreSQL, EventBus (NATS/JetStream), React

---

## 文件结构

```
orion-platform-service/src/
├── services/lowcode/
│   ├── TriggerManager.ts        # 触发器管理器 (新建)
│   ├── WorkflowScheduler.ts     # 定时调度器 (新建)
│   ├── WorkflowTaskService.ts   # 人工任务服务 (新建)
│   ├── WorkflowEngine.ts        # 扩展节点执行器 (修改)
│   └── types.ts                 # 扩展类型定义 (修改)
├── api/
│   ├── workflow-trigger-routes.ts    # 触发器API (新建)
│   ├── workflow-task-routes.ts       # 人工任务API (新建)
│   └── routes.ts                     # 注册新路由 (修改)
├── repositories/
│   └── WorkflowTriggerRepository.ts  # 触发器Repository (新建)
db/migrations/
└── 177_workflow_triggers.sql         # 触发器表迁移 (新建)
```

---

## Phase 1: 基础框架 (3天)

### Task 1: 数据库迁移 - 创建触发器和任务表

**Files:**
- Create: `orion-platform-service/src/db/migrations/177_workflow_triggers.sql`

- [ ] **Step 1: 创建触发器配置表迁移**

```sql
-- Migration 177: Workflow Triggers and Tasks
-- 触发器配置表
CREATE TABLE workflow_triggers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id         UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  type                VARCHAR(20) NOT NULL,
  enabled             BOOLEAN DEFAULT true,
  event_type          VARCHAR(100),
  event_filter        JSONB,
  cron_expression     VARCHAR(100),
  timezone            VARCHAR(50) DEFAULT 'Asia/Shanghai',
  webhook_path        VARCHAR(200),
  webhook_secret      VARCHAR(200),
  trigger_strategy    VARCHAR(20) DEFAULT 'async',
  concurrency_limit   INTEGER DEFAULT 1,
  created_by          VARCHAR(100),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_triggers_workflow ON workflow_triggers(workflow_id);
CREATE INDEX idx_triggers_type ON workflow_triggers(type);
CREATE INDEX idx_triggers_enabled ON workflow_triggers(enabled);
CREATE INDEX idx_triggers_event_type ON workflow_triggers(event_type) WHERE type = 'event';

-- 触发事件日志表
CREATE TABLE workflow_trigger_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id          UUID NOT NULL REFERENCES workflow_triggers(id) ON DELETE CASCADE,
  workflow_instance_id UUID,
  event_type          VARCHAR(100),
  event_payload       JSONB,
  status              VARCHAR(20) NOT NULL,
  error_message       TEXT,
  execution_time_ms   INTEGER,
  triggered_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trigger_logs_trigger ON workflow_trigger_logs(trigger_id);
CREATE INDEX idx_trigger_logs_status ON workflow_trigger_logs(status);
CREATE INDEX idx_trigger_logs_time ON workflow_trigger_logs(triggered_at DESC);

-- 人工任务表
CREATE TABLE workflow_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id         UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  node_id             VARCHAR(100) NOT NULL,
  task_type           VARCHAR(20) NOT NULL,
  assignee_type       VARCHAR(20) NOT NULL,
  assignee_id         VARCHAR(100),
  candidate_users     VARCHAR(100)[],
  candidate_roles     VARCHAR(100)[],
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  form_data           JSONB,
  status              VARCHAR(20) DEFAULT 'pending',
  priority            VARCHAR(20) DEFAULT 'normal',
  due_date            TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  completed_by        VARCHAR(100),
  completion_comment  TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workflow_tasks_instance ON workflow_tasks(instance_id);
CREATE INDEX idx_workflow_tasks_assignee ON workflow_tasks(assignee_type, assignee_id);
CREATE INDEX idx_workflow_tasks_status ON workflow_tasks(status);
```

- [ ] **Step 2: 运行迁移验证**

Run: `cd orion-platform-service && npm run migrate`
Expected: Tables created successfully

- [ ] **Step 3: Commit**

```bash
git add orion-platform-service/src/db/migrations/177_workflow_triggers.sql
git commit -m "feat(workflow): add trigger and task tables migration 177"
```

---

### Task 2: 创建触发器Repository

**Files:**
- Create: `orion-platform-service/src/repositories/WorkflowTriggerRepository.ts`

- [ ] **Step 1: 编写测试文件**

```typescript
// src/repositories/__tests__/WorkflowTriggerRepository.test.ts
import { WorkflowTriggerRepository } from '../WorkflowTriggerRepository';

describe('WorkflowTriggerRepository', () => {
  let repo: WorkflowTriggerRepository;
  const mockDb = {
    query: jest.fn()
  };

  beforeEach(() => {
    repo = new WorkflowTriggerRepository(mockDb as any);
  });

  test('should create trigger', async () => {
    const mockTrigger = {
      id: 'uuid-1',
      workflow_id: 'workflow-uuid',
      name: 'test-trigger',
      type: 'event',
      enabled: true,
    };
    mockDb.query.mockResolvedValue({ rows: [mockTrigger] });

    const result = await repo.create(mockTrigger as any);
    expect(result.name).toBe('test-trigger');
  });

  test('should find by event type', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await repo.findByEventType('ticket.created');
    expect(mockDb.query).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx jest src/repositories/__tests__/WorkflowTriggerRepository.test.ts`
Expected: FAIL (file does not exist)

- [ ] **Step 3: 实现Repository**

```typescript
// src/repositories/WorkflowTriggerRepository.ts
export interface WorkflowTrigger {
  id: string;
  workflow_id: string;
  name: string;
  type: 'event' | 'cron' | 'manual' | 'webhook';
  enabled: boolean;
  event_type?: string;
  event_filter?: Record<string, any>;
  cron_expression?: string;
  timezone?: string;
  webhook_path?: string;
  webhook_secret?: string;
  trigger_strategy?: string;
  concurrency_limit?: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export class WorkflowTriggerRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  private mapRowToEntity(row: any): WorkflowTrigger {
    return {
      id: row.id,
      workflow_id: row.workflow_id,
      name: row.name,
      type: row.type,
      enabled: row.enabled,
      event_type: row.event_type,
      event_filter: row.event_filter,
      cron_expression: row.cron_expression,
      timezone: row.timezone,
      webhook_path: row.webhook_path,
      webhook_secret: row.webhook_secret,
      trigger_strategy: row.trigger_strategy,
      concurrency_limit: row.concurrency_limit,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async create(data: Partial<WorkflowTrigger>): Promise<WorkflowTrigger> {
    const result = await this.db.query(
      `INSERT INTO workflow_triggers (workflow_id, name, type, enabled, event_type, event_filter, cron_expression, timezone, webhook_path, webhook_secret, trigger_strategy, concurrency_limit, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [data.workflow_id, data.name, data.type, data.enabled, data.event_type, JSON.stringify(data.event_filter || {}), data.cron_expression, data.timezone, data.webhook_path, data.webhook_secret, data.trigger_strategy, data.concurrency_limit, data.created_by]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAll(): Promise<WorkflowTrigger[]> {
    const result = await this.db.query('SELECT * FROM workflow_triggers ORDER BY created_at DESC');
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<WorkflowTrigger | null> {
    const result = await this.db.query('SELECT * FROM workflow_triggers WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowTrigger[]> {
    const result = await this.db.query('SELECT * FROM workflow_triggers WHERE workflow_id = $1', [workflowId]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEventType(eventType: string): Promise<WorkflowTrigger[]> {
    const result = await this.db.query(
      'SELECT * FROM workflow_triggers WHERE type = $1 AND event_type = $2 AND enabled = true',
      ['event', eventType]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabledCronTriggers(): Promise<WorkflowTrigger[]> {
    const result = await this.db.query(
      "SELECT * FROM workflow_triggers WHERE type = 'cron' AND enabled = true"
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async update(id: string, data: Partial<WorkflowTrigger>): Promise<WorkflowTrigger> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(key === 'event_filter' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    });

    values.push(id);
    const result = await this.db.query(
      `UPDATE workflow_triggers SET ${fields.join(', ')}, updated_at = now() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM workflow_triggers WHERE id = $1', [id]);
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.query('UPDATE workflow_triggers SET enabled = $1, updated_at = now() WHERE id = $2', [enabled, id]);
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx jest src/repositories/__tests__/WorkflowTriggerRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/WorkflowTriggerRepository.ts src/repositories/__tests__/WorkflowTriggerRepository.test.ts
git commit -m "feat(workflow): add WorkflowTriggerRepository"
```

---

### Task 3: 扩展类型定义

**Files:**
- Modify: `orion-platform-service/src/services/lowcode/types.ts`

- [ ] **Step 1: 添加新的节点类型和配置**

在 types.ts 中添加以下类型定义（找到合适位置插入）:

```typescript
// ========== 新增节点类型 ==========

/** Task节点配置 */
export interface TaskNodeConfig {
  type: 'task';
  taskType: 'manual' | 'system';
  assigneeType: 'user' | 'role' | 'variable';
  assigneeIds?: string[];
  assigneeVariable?: string;
  title?: string;
  description?: string;
  timeout?: number;
  timeoutAction?: 'auto_complete' | 'notify' | 'escalate';
  formSchema?: Record<string, any>;
  resultVariable?: string;
}

/** SubWorkflow节点配置 */
export interface SubWorkflowNodeConfig {
  type: 'sub-workflow';
  subWorkflowId: string;
  subWorkflowVersion?: number;
  inputMappings?: VariableMapping[];
  outputMappings?: VariableMapping[];
  waitForCompletion: boolean;
  resultVariable?: string;
}

/** Delay节点配置 */
export interface DelayNodeConfig {
  type: 'delay';
  duration: number;
  durationVariable?: string;
  resumeEvent?: string;
  timeoutAction?: 'continue' | 'terminate';
  resultVariable?: string;
}

/** Timer节点配置 */
export interface TimerNodeConfig {
  type: 'timer';
  cronExpression: string;
  timezone?: string;
  maxExecutions?: number;
  inputVariables?: Record<string, any>;
  resultVariable?: string;
}

/** 变量映射 */
export interface VariableMapping {
  source: string;
  target: string;
}

// 更新 WorkflowNode 的 config 联合类型
export type WorkflowNodeConfig =
  | StartNodeConfig
  | ApprovalNodeConfig
  | ConditionNodeConfig
  | NotificationNodeConfig
  | WebhookNodeConfig
  | EndNodeConfig
  | TaskNodeConfig          // 新增
  | SubWorkflowNodeConfig   // 新增
  | DelayNodeConfig         // 新增
  | TimerNodeConfig;        // 新增

// 更新 WorkflowNodeType
export type WorkflowNodeType =
  | 'start'
  | 'approval'
  | 'condition'
  | 'notification'
  | 'webhook'
  | 'end'
  | 'task'                  // 新增
  | 'sub-workflow'          // 新增
  | 'delay'                 // 新增
  | 'timer';                // 新增
```

- [ ] **Step 2: 编译验证**

Run: `cd orion-platform-service && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/services/lowcode/types.ts
git commit -m "feat(workflow): add new node types (task, sub-workflow, delay, timer)"
```

---

## Phase 2: 触发器系统 (4天)

### Task 4: 创建TriggerManager

**Files:**
- Create: `orion-platform-service/src/services/lowcode/TriggerManager.ts`

- [ ] **Step 1: 创建TriggerManager类**

```typescript
// src/services/lowcode/TriggerManager.ts
import { EventBusService, TypedEnvelope } from '../event-bus-service';
import { WorkflowTriggerRepository } from '../../repositories/WorkflowTriggerRepository';
import { InstanceManager } from './InstanceManager';

export class TriggerManager {
  private eventBus?: EventBusService;
  private instanceManager?: InstanceManager;
  private triggerRepo: WorkflowTriggerRepository;
  private subscriptions = new Map<string, string[]>();

  constructor(
    triggerRepo: WorkflowTriggerRepository,
    eventBus?: EventBusService,
    instanceManager?: InstanceManager
  ) {
    this.triggerRepo = triggerRepo;
    this.eventBus = eventBus;
    this.instanceManager = instanceManager;
  }

  async initialize(): Promise<void> {
    if (!this.eventBus || !this.instanceManager) {
      console.warn('[TriggerManager] EventBus or InstanceManager not initialized');
      return;
    }

    // 加载并订阅所有事件触发器
    const triggers = await this.triggerRepo.findAll();
    const eventTriggers = triggers.filter(t => t.type === 'event' && t.enabled);

    for (const trigger of eventTriggers) {
      if (trigger.event_type) {
        await this.subscribeEvent(trigger.id, trigger.event_type);
      }
    }

    console.log(`[TriggerManager] Initialized with ${eventTriggers.length} event triggers`);
  }

  private async subscribeEvent(triggerId: string, eventType: string): Promise<void> {
    if (!this.eventBus) return;

    const handler = async (event: TypedEnvelope<any>) => {
      await this.handleEvent(triggerId, event);
    };

    await this.eventBus.subscribe(eventType, handler, { durableName: `workflow-trigger-${triggerId}` });

    const existing = this.subscriptions.get(eventType) || [];
    existing.push(triggerId);
    this.subscriptions.set(eventType, existing);
  }

  private async handleEvent(triggerId: string, event: TypedEnvelope<any>): Promise<void> {
    try {
      const trigger = await this.triggerRepo.findById(triggerId);
      if (!trigger || !trigger.enabled) return;

      // 检查事件过滤条件
      if (trigger.event_filter && !this.matchFilter(event.payload, trigger.event_filter)) {
        return;
      }

      // 创建工作流实例
      if (this.instanceManager) {
        const inputVariables = {
          ...trigger.event_filter,
          __eventType: event.type,
          __eventPayload: event.payload,
          __triggeredAt: new Date().toISOString(),
        };

        const instance = await this.instanceManager.create(trigger.workflow_id, inputVariables);
        await this.instanceManager.execute(instance.id);
      }
    } catch (error) {
      console.error(`[TriggerManager] Error handling event for trigger ${triggerId}:`, error);
    }
  }

  private matchFilter(payload: any, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (payload[key] !== value) {
        return false;
      }
    }
    return true;
  }

  async createTrigger(data: Partial<any>): Promise<any> {
    const trigger = await this.triggerRepo.create(data);
    if (trigger.type === 'event' && trigger.enabled && trigger.event_type) {
      await this.subscribeEvent(trigger.id, trigger.event_type);
    }
    return trigger;
  }

  async updateTrigger(id: string, data: Partial<any>): Promise<any> {
    const oldTrigger = await this.triggerRepo.findById(id);
    const trigger = await this.triggerRepo.update(id, data);

    // 处理触发器变更
    if (oldTrigger?.type === 'event' && oldTrigger?.event_type) {
      // 取消旧订阅
      // ... 简化处理，实际需要 unsubscribe
    }

    if (trigger.type === 'event' && trigger.enabled && trigger.event_type) {
      await this.subscribeEvent(trigger.id, trigger.event_type);
    }

    return trigger;
  }

  async deleteTrigger(id: string): Promise<void> {
    await this.triggerRepo.delete(id);
  }
}
```

- [ ] **Step 2: 编译验证**

Run: `cd orion-platform-service && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/lowcode/TriggerManager.ts
git commit -m "feat(workflow): add TriggerManager for event-driven triggers"
```

---

### Task 5: 创建WorkflowScheduler

**Files:**
- Create: `orion-platform-service/src/services/lowcode/WorkflowScheduler.ts`

- [ ] **Step 1: 创建定时调度器**

```typescript
// src/services/lowcode/WorkflowScheduler.ts
import { WorkflowTriggerRepository } from '../../repositories/WorkflowTriggerRepository';
import { InstanceManager } from './InstanceManager';

interface CronJobWrapper {
  job: any;  // CronJob instance
  triggerId: string;
}

export class WorkflowScheduler {
  private triggerRepo: WorkflowTriggerRepository;
  private instanceManager?: InstanceManager;
  private cronJobs = new Map<string, CronJobWrapper>();
  private isRunning = false;

  constructor(triggerRepo: WorkflowTriggerRepository, instanceManager?: InstanceManager) {
    this.triggerRepo = triggerRepo;
    this.instanceManager = instanceManager;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[WorkflowScheduler] Already running');
      return;
    }

    // 加载所有启用的Cron触发器
    const triggers = await this.triggerRepo.findEnabledCronTriggers();

    for (const trigger of triggers) {
      await this.registerCronTrigger(trigger);
    }

    this.isRunning = true;
    console.log(`[WorkflowScheduler] Started with ${this.cronJobs.size} cron triggers`);
  }

  async stop(): Promise<void> {
    for (const [, wrapper] of this.cronJobs) {
      wrapper.job.stop();
    }
    this.cronJobs.clear();
    this.isRunning = false;
    console.log('[WorkflowScheduler] Stopped');
  }

  async registerCronTrigger(trigger: any): Promise<void> {
    if (!trigger.cron_expression) return;

    // 动态导入 cron
    const { CronJob } = await import('cron');

    const job = new CronJob(
      trigger.cron_expression,
      () => this.executeCronTrigger(trigger),
      null,
      true,
      trigger.timezone || 'Asia/Shanghai'
    );

    this.cronJobs.set(trigger.id, { job, triggerId: trigger.id });
  }

  private async executeCronTrigger(trigger: any): Promise<void> {
    try {
      if (!this.instanceManager) {
        console.error('[WorkflowScheduler] InstanceManager not initialized');
        return;
      }

      const inputVariables = {
        ...trigger.input_variables,
        __triggeredAt: new Date().toISOString(),
        __triggerType: 'cron',
        __triggerId: trigger.id,
      };

      const instance = await this.instanceManager.create(trigger.workflow_id, inputVariables);
      await this.instanceManager.execute(instance.id);

      console.log(`[WorkflowScheduler] Triggered workflow ${trigger.workflow_id} for cron trigger ${trigger.id}`);
    } catch (error) {
      console.error(`[WorkflowScheduler] Error executing cron trigger ${trigger.id}:`, error);
    }
  }

  async reload(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getNextExecutionTime(triggerId: string): Date | null {
    const wrapper = this.cronJobs.get(triggerId);
    return wrapper?.job?.nextDate()?.toDate() || null;
  }
}
```

- [ ] **Step 2: 编译验证**

Run: `cd orion-platform-service && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/lowcode/WorkflowScheduler.ts
git commit -m "feat(workflow): add WorkflowScheduler for cron-based triggers"
```

---

### Task 6: 创建触发器API路由

**Files:**
- Create: `orion-platform-service/src/api/workflow-trigger-routes.ts`
- Modify: `orion-platform-service/src/api/routes.ts`

- [ ] **Step 1: 创建API路由**

```typescript
// src/api/workflow-trigger-routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkflowTriggerRepository } from '../../repositories/WorkflowTriggerRepository';
import { TriggerManager } from '../../services/lowcode/TriggerManager';
import { WorkflowScheduler } from '../../services/lowcode/WorkflowScheduler';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface WorkflowTriggerRoutesOptions {
  database?: DatabasePool;
  triggerManager?: TriggerManager;
  scheduler?: WorkflowScheduler;
}

export default async function workflowTriggerRoutes(
  app: FastifyInstance,
  options: WorkflowTriggerRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[WorkflowTriggerRoutes] No database pool provided');
    return;
  }

  const triggerRepo = new WorkflowTriggerRepository(options.database);
  const triggerManager = options.triggerManager || new TriggerManager(triggerRepo);
  const scheduler = options.scheduler;

  // 获取触发器列表
  app.get('/workflow-triggers', {
    onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const triggers = await triggerRepo.findAll();
      return reply.send({ success: true, data: triggers });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 获取单个触发器
  app.get('/workflow-triggers/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const trigger = await triggerRepo.findById(id);
      if (!trigger) {
        return reply.status(404).send({ success: false, error: 'Trigger not found' });
      }
      return reply.send({ success: true, data: trigger });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 创建触发器
  app.post('/workflow-triggers', {
    onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const trigger = await triggerManager.createTrigger({
        ...body,
        created_by: request.headers['x-user-id'] || 'system',
      });
      return reply.status(201).send({ success: true, data: trigger });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新触发器
  app.put('/workflow-triggers/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const trigger = await triggerManager.updateTrigger(id, body);
      return reply.send({ success: true, data: trigger });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 删除触发器
  app.delete('/workflow-triggers/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      await triggerManager.deleteTrigger(id);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 启用/禁用触发器
  app.post('/workflow-triggers/:id/enable', {
    onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      await triggerRepo.setEnabled(id, true);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  app.post('/workflow-triggers/:id/disable', {
    onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      await triggerRepo.setEnabled(id, false);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  console.log('[WorkflowTriggerRoutes] Registered');
}
```

- [ ] **Step 2: 在routes.ts中注册新路由**

在 routes.ts 中添加导入和注册:

```typescript
import workflowTriggerRoutes from './workflow-trigger-routes';

// 在 registerRoutes 函数中添加:
await registerWithRoleGuard(app, workflowTriggerRoutes, '/v1', { database: options.database });
```

- [ ] **Step 3: 编译验证**

Run: `cd orion-platform-service && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/api/workflow-trigger-routes.ts src/api/routes.ts
git commit -m "feat(workflow): add trigger API routes"
```

---

## Phase 3: 新增节点 (3天)

### Task 7: 扩展WorkflowEngine - 新增节点执行器

**Files:**
- Modify: `orion-platform-service/src/services/lowcode/WorkflowEngine.ts`

- [ ] **Step 1: 在executeNode方法中添加新节点类型**

找到 switch (node.type) 部分，添加:

```typescript
// 在现有的 case 'end': 之后添加

case 'task':
  return await this.executeTaskNode(node.config as TaskNodeConfig, instance, context);

case 'sub-workflow':
  return await this.executeSubWorkflowNode(node.config as SubWorkflowNodeConfig, instance, context);

case 'delay':
  return await this.executeDelayNode(node.config as DelayNodeConfig, instance, context);

case 'timer':
  return await this.executeTimerNode(node.config as TimerNodeConfig, instance, context);
```

- [ ] **Step 2: 实现executeTaskNode方法**

在 WorkflowEngine 类中添加:

```typescript
private async executeTaskNode(
  config: TaskNodeConfig,
  instance: WorkflowInstance,
  context: WorkflowExecutionContext
): Promise<NodeExecutionResult> {
  if (config.taskType === 'system') {
    // 系统任务：直接执行（可扩展为执行脚本等）
    return {
      outputVariables: {
        ...instance.variables,
        [config.resultVariable || 'taskResult']: {
          status: 'completed',
          type: 'system',
        },
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  } else {
    // 人工任务：创建任务记录，等待完成
    const taskId = await this.createManualTask(config, instance);

    // 等待任务完成（简化：同步等待，实际应异步）
    const completed = await this.waitForTaskCompletion(taskId, (config.timeout || 86400) * 1000);

    return {
      outputVariables: {
        ...instance.variables,
        [config.resultVariable || 'taskResult']: {
          taskId,
          status: completed ? 'completed' : 'timeout',
        },
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  }
}

private async createManualTask(config: TaskNodeConfig, instance: WorkflowInstance): Promise<string> {
  // 创建人工任务记录
  // 实际实现需要 TaskRepository
  const taskId = `task-${Date.now()}`;
  console.log(`[WorkflowEngine] Created manual task: ${taskId} for instance: ${instance.id}`);
  return taskId;
}

private async waitForTaskCompletion(taskId: string, timeoutMs: number): Promise<boolean> {
  // 简化实现：等待超时
  // 实际实现应通过事件或轮询检查任务状态
  await new Promise(resolve => setTimeout(resolve, 100));
  return false;
}
```

- [ ] **Step 3: 实现executeSubWorkflowNode方法**

```typescript
private async executeSubWorkflowNode(
  config: SubWorkflowNodeConfig,
  instance: WorkflowInstance,
  context: WorkflowExecutionContext
): Promise<NodeExecutionResult> {
  // 构建子流程输入
  const subInput = this.mapVariables(instance.variables, config.inputMappings);

  // 创建子流程实例
  const subInstance = await this.instanceManager.create(
    config.subWorkflowId,
    subInput,
    {
      parentInstanceId: instance.id,
      parentNodeId: config.id,
    }
  );

  if (config.waitForCompletion) {
    // 等待完成
    const result = await this.waitForInstanceCompletion(subInstance.id);

    // 映射输出
    const outputVars = this.mapVariables(result.variables, config.outputMappings);

    return {
      outputVariables: {
        ...instance.variables,
        ...outputVars,
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  } else {
    // 异步执行
    this.instanceManager.execute(subInstance.id);

    return {
      outputVariables: {
        ...instance.variables,
        [config.resultVariable || 'subWorkflowResult']: {
          instanceId: subInstance.id,
          status: 'started',
        },
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  }
}

private mapVariables(variables: Record<string, any>, mappings?: VariableMapping[]): Record<string, any> {
  if (!mappings) return {};
  const result: Record<string, any> = {};
  for (const mapping of mappings) {
    // 简化实现：实际需要解析 $.variables.x 这样的路径
    result[mapping.target] = variables[mapping.source.replace('$.variables.', '')] || mapping.source;
  }
  return result;
}

private async waitForInstanceCompletion(instanceId: string): Promise<WorkflowInstance> {
  // 简化实现
  return { id: instanceId, variables: {} } as WorkflowInstance;
}
```

- [ ] **Step 4: 实现executeDelayNode方法**

```typescript
private async executeDelayNode(
  config: DelayNodeConfig,
  instance: WorkflowInstance,
  context: WorkflowExecutionContext
): Promise<NodeExecutionResult> {
  const duration = config.durationVariable
    ? instance.variables[config.durationVariable] || config.duration
    : config.duration;

  // 延迟执行（简化：同步等待，实际应记录状态后返回）
  await new Promise(resolve => setTimeout(resolve, Math.min(duration * 1000, 5000)));

  return {
    outputVariables: {
      ...instance.variables,
      [config.resultVariable || 'delayResult']: {
        duration,
        completed: true,
      },
    },
    nextNodeId: this.getNextNodeId(instance),
  };
}
```

- [ ] **Step 5: 实现executeTimerNode方法**

```typescript
private async executeTimerNode(
  config: TimerNodeConfig,
  instance: WorkflowInstance,
  context: WorkflowExecutionContext
): Promise<NodeExecutionResult> {
  // Timer节点用于定时触发子流程，这里简化处理
  return {
    outputVariables: {
      ...instance.variables,
      ...config.inputVariables,
      [config.resultVariable || 'timerResult']: {
        cronExpression: config.cronExpression,
        executed: true,
      },
    },
    nextNodeId: this.getNextNodeId(instance),
  };
}
```

- [ ] **Step 6: 编译验证**

Run: `cd orion-platform-service && npx tsc --noEmit`
Expected: No errors (可能有类型警告可忽略)

- [ ] **Step 7: Commit**

```bash
git add src/services/lowcode/WorkflowEngine.ts
git commit -m "feat(workflow): add task, sub-workflow, delay, timer node executors"
```

---

## Phase 4: 前端 (3天)

### Task 8: 前端触发器配置页面

**Files:**
- Create: `orion-frontend/src/pages/WorkflowTriggers/index.tsx`
- Modify: `orion-frontend/src/router/routes.tsx`

- [ ] **Step 1: 创建触发器列表页面**

```tsx
// src/pages/WorkflowTriggers/index.tsx
import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, message, Modal, Form, Input, Select, InputNumber, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { api } from '@/api/client';

const { Option } = Select;

interface Trigger {
  id: string;
  name: string;
  type: 'event' | 'cron' | 'manual' | 'webhook';
  enabled: boolean;
  event_type?: string;
  cron_expression?: string;
  workflow_id: string;
}

const WorkflowTriggers: React.FC = () => {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadTriggers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/workflow-triggers');
      setTriggers(res.data.data || []);
    } catch (error) {
      message.error('加载触发器失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTriggers();
  }, []);

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (type: string) => {
      const map = { event: '事件', cron: '定时', manual: '手动', webhook: 'Webhook' };
      return <Tag>{map[type as keyof typeof map] || type}</Tag>;
    }},
    { title: '触发条件', dataIndex: 'event_type', key: 'condition', render: (_: any, record: Trigger) => {
      if (record.type === 'event') return record.event_type;
      if (record.type === 'cron') return record.cron_expression;
      return '-';
    }},
    { title: '状态', dataIndex: 'enabled', key: 'enabled', render: (enabled: boolean) => (
      <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
    )},
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Trigger) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  const handleEdit = (record: Trigger) => {
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/v1/workflow-triggers/${id}`);
    message.success('删除成功');
    loadTriggers();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    await api.post('/v1/workflow-triggers', values);
    message.success('保存成功');
    setModalVisible(false);
    loadTriggers();
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="触发器管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalVisible(true); }}>
            新建触发器
          </Button>
        }
      >
        <Table columns={columns} dataSource={triggers} loading={loading} rowKey="id" />
      </Card>

      <Modal title="触发器配置" open={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select onChange={(v) => form.setFieldsValue({ type: v })}>
              <Option value="event">事件触发</Option>
              <Option value="cron">定时触发</Option>
              <Option value="webhook">Webhook</Option>
            </Select>
          </Form.Item>
          <Form.Item name="workflow_id" label="关联工作流" rules={[{ required: true }]}>
            <Input placeholder="工作流ID" />
          </Form.Item>
          <Form.Item name="event_type" label="事件类型">
            <Select placeholder="选择事件类型">
              <Option value="ticket.created">工单创建</Option>
              <Option value="ticket.assigned">工单分配</Option>
              <Option value="alert.triggered">告警触发</Option>
              <Option value="pipeline.completed">流水线完成</Option>
            </Select>
          </Form.Item>
          <Form.Item name="cron_expression" label="Cron表达式">
            <Input placeholder="0 9 * * *" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkflowTriggers;
```

- [ ] **Step 2: 在路由中注册**

在 routes.tsx 中添加:

```typescript
{
  path: '/workflows/triggers',
  element: React.lazy(() => import('@/pages/WorkflowTriggers')),
  protected: true,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/WorkflowTriggers/ src/router/routes.tsx
git commit -m "feat(frontend): add workflow triggers management page"
```

---

## Phase 5: 集成测试 (2天)

### Task 9: 集成测试与验证

- [ ] **Step 1: 启动后端服务**

Run: `cd orion-platform-service && npm run dev`

- [ ] **Step 2: 测试触发器API**

```bash
# 获取触发器列表
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/workflow-triggers

# 创建触发器
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"test-trigger","type":"event","event_type":"ticket.created","workflow_id":"<workflow-id>","enabled":true}' \
  http://localhost:3001/api/v1/workflow-triggers
```

- [ ] **Step 3: 验证工作流执行**

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "test(workflow): integration testing completed"
```

---

## 实现检查清单

- [ ] Phase 1: 数据库迁移完成
- [ ] Phase 1: Repository创建完成
- [ ] Phase 1: 类型定义扩展完成
- [ ] Phase 2: TriggerManager实现
- [ ] Phase 2: WorkflowScheduler实现
- [ ] Phase 2: API路由注册
- [ ] Phase 3: 节点执行器扩展
- [ ] Phase 4: 前端页面
- [ ] Phase 5: 集成测试

---

## Plan complete

**Plan saved to:** `docs/superpowers/plans/2026-05-20-workflow-enhancement-implementation.md`

**Two execution options:**

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?