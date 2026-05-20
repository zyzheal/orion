# 工作流增强设计方案

**版本**: 1.0
**日期**: 2026-05-20
**状态**: 设计完成
**目标**: 增强低代码工作流系统，覆盖自动化运维、流程审批、业务流转场景

---

## 1. 设计目标

### 1.1 背景

当前系统已具备基础的6种工作流节点（start/approval/condition/notification/webhook/end），但存在以下不足：

| 问题 | 影响 |
|------|------|
| 无事件触发机制 | 无法响应工单、告警等系统事件 |
| 无定时触发 | 无法支持定期巡检等场景 |
| 缺少人工任务节点 | 无法处理需要人工介入的非审批任务 |
| 无子流程复用 | 相同流程无法复用 |
| 与工单系统弱集成 | 工单状态变更无法触发工作流 |

### 1.2 目标

设计并实现一个增强的工作流系统，支持：

1. **事件驱动** - 响应工单、告警、发布等系统事件
2. **定时执行** - 支持Cron定时触发工作流
3. **任务节点** - 支持人工任务和系统任务
4. **子流程** - 支持流程复用
5. **深度集成** - 与工单、监控、CI/CD系统深度集成

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              前端 (orion-frontend)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  WorkflowDesigner (已存在)  │  工作流列表  │  执行历史  │  触发器配置        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Layer (orion-platform-service)                │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/v1/workflows          │  /api/v1/workflow-triggers                  │
│  /api/v1/workflow-instances │  /api/v1/workflow-executions                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           工作流引擎层 (Enhanced)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Trigger    │  │  Executor   │  │  Instance   │  │  Scheduler  │        │
│  │  Manager    │  │  (增强版)   │  │  Manager    │  │  (定时任务)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                │                                            │
│                    ┌───────────┴───────────┐                               │
│                    │   Node Executor       │                               │
│                    │  • start (已存在)      │                               │
│                    │  • approval (已存在)   │                               │
│                    │  • condition (已存在)  │                               │
│                    │  • notification (已存) │                               │
│                    │  • webhook (已存在)    │                               │
│                    │  • end (已存在)        │                               │
│                    │  • task (新增)         │                               │
│                    │  • sub-workflow (新增) │                               │
│                    │  • delay (新增)        │                               │
│                    │  • timer (新增)        │                               │
│                    └───────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           集成层 (Integrations)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  EventBusService  │  TicketingService  │  AlertService  │  PipelineService │
│  ApprovalService  │  NotificationSvc   │  CmdbService   │  CronService     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 | 位置 |
|------|------|------|
| TriggerManager | 管理触发器配置，处理事件订阅 | `services/lowcode/TriggerManager.ts` |
| WorkflowExecutor (增强) | 执行工作流实例，支持新节点类型 | `services/lowcode/WorkflowEngine.ts` (扩展) |
| InstanceManager | 管理工作流实例生命周期 | `services/lowcode/InstanceManager.ts` |
| WorkflowScheduler | 定时任务调度 | `services/lowcode/WorkflowScheduler.ts` |

---

## 3. 数据模型

### 3.1 现有表结构 (参考)

```sql
-- 现有表 (已在系统中)
workflow_definitions     -- 工作流定义
workflow_instances       -- 工作流实例
workflow_nodes           -- 节点定义
workflow_edges           -- 节点连接
```

### 3.2 新增表结构

#### 3.2.1 触发器配置表

```sql
CREATE TABLE workflow_triggers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id         UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  name                VARCHAR(100) NOT NULL,
  type                VARCHAR(20) NOT NULL,  -- 'event' | 'cron' | 'manual' | 'webhook'
  enabled             BOOLEAN DEFAULT true,

  -- 事件触发配置
  event_type          VARCHAR(100),           -- 'ticket.created' | 'alert.triggered' | etc.
  event_filter        JSONB,                  -- 事件过滤条件

  -- Cron触发配置
  cron_expression     VARCHAR(100),           -- '0 9 * * *' 每天9点
  timezone            VARCHAR(50) DEFAULT 'Asia/Shanghai',

  -- Webhook触发配置
  webhook_path        VARCHAR(200),
  webhook_secret      VARCHAR(200),

  -- 执行配置
  trigger_strategy    VARCHAR(20) DEFAULT 'async',  -- 'async' | 'sync'
  concurrency_limit   INTEGER DEFAULT 1,

  created_by          VARCHAR(100),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_triggers_workflow ON workflow_triggers(workflow_id);
CREATE INDEX idx_triggers_type ON workflow_triggers(type);
CREATE INDEX idx_triggers_enabled ON workflow_triggers(enabled);
CREATE INDEX idx_triggers_event_type ON workflow_triggers(event_type) WHERE type = 'event';
```

#### 3.2.2 触发事件日志表

```sql
CREATE TABLE workflow_trigger_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id          UUID NOT NULL REFERENCES workflow_triggers(id) ON DELETE CASCADE,
  workflow_instance_id UUID,
  event_type          VARCHAR(100),
  event_payload       JSONB,
  status              VARCHAR(20) NOT NULL,  -- 'pending' | 'success' | 'failed' | 'skipped'
  error_message       TEXT,
  execution_time_ms   INTEGER,
  triggered_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trigger_logs_trigger ON workflow_trigger_logs(trigger_id);
CREATE INDEX idx_trigger_logs_status ON workflow_trigger_logs(status);
CREATE INDEX idx_trigger_logs_time ON workflow_trigger_logs(triggered_at DESC);
```

#### 3.2.3 新增节点配置 (扩展现有表)

```sql
-- 在 workflow_nodes 表中新增节点类型
-- 扩展 config 字段为 JSONB 存储不同节点配置

-- Task节点配置示例
{
  "type": "task",
  "taskType": "manual",          -- 'manual' | 'system'
  "assigneeType": "user",        -- 'user' | 'role' | 'variable'
  "assigneeIds": ["user-1"],
  "assigneeVariable": "approver",
  "timeout": 86400,              -- 秒
  "timeoutAction": "auto_complete",  -- 'auto_complete' | 'notify' | 'escalate'
  "formSchema": {},              -- 人工任务表单配置
  "resultVariable": "taskResult"
}

-- SubWorkflow节点配置示例
{
  "type": "sub-workflow",
  "subWorkflowId": "uuid",
  "subWorkflowVersion": 1,
  "inputMappings": [             -- 输入参数映射
    { "source": "$.variables.amount", "target": "$.input.amount" }
  ],
  "outputMappings": [            -- 输出参数映射
    { "source": "$.output.result", "target": "$.variables.subResult" }
  ],
  "waitForCompletion": true,
  "resultVariable": "subWorkflowResult"
}

-- Delay节点配置示例
{
  "type": "delay",
  "duration": 3600,              -- 秒
  "durationVariable": "$.variables.waitTime",
  "resumeEvent": "ticket.resumed",  -- 可选：事件唤醒
  "timeoutAction": "continue",   -- 'continue' | 'terminate'
  "resultVariable": "delayResult"
}

-- Timer节点配置示例
{
  "type": "timer",
  "cronExpression": "0 9 * * 1-5",  -- 工作日9点
  "timezone": "Asia/Shanghai",
  "maxExecutions": null,         -- null = 无限
  "inputVariables": {},          -- 每次执行的输入变量
  "resultVariable": "timerResult"
}
```

#### 3.2.4 人工任务表 (新增)

```sql
CREATE TABLE workflow_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id         UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  node_id             VARCHAR(100) NOT NULL,
  task_type           VARCHAR(20) NOT NULL,  -- 'manual' | 'system'

  -- 分配信息
  assignee_type       VARCHAR(20) NOT NULL,  -- 'user' | 'role'
  assignee_id         VARCHAR(100),
  candidate_users     VARCHAR(100)[],
  candidate_roles     VARCHAR(100)[],

  -- 任务内容
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  form_data           JSONB,

  -- 状态
  status              VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'assigned' | 'completed' | 'cancelled'
  priority            VARCHAR(20) DEFAULT 'normal',   -- 'low' | 'normal' | 'high' | 'urgent'

  -- 时间
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

---

## 4. 触发器系统设计

### 4.1 触发器类型

| 类型 | 说明 | 配置 |
|------|------|------|
| **Event (事件)** | 订阅系统事件触发 | event_type, event_filter |
| **Cron (定时)** | Cron表达式定时触发 | cron_expression, timezone |
| **Manual (手动)** | API/UI手动触发 | 无需配置 |
| **Webhook** | 外部HTTP调用触发 | webhook_path, webhook_secret |

### 4.2 事件类型映射

| 事件源 | 事件类型 | 事件Payload |
|--------|----------|-------------|
| 工单系统 | `ticket.created` | `{ ticketId, title, priority, creator }` |
| 工单系统 | `ticket.assigned` | `{ ticketId, assignee, assigner }` |
| 工单系统 | `ticket.resolved` | `{ ticketId, resolver, resolution }` |
| 工单系统 | `ticket.closed` | `{ ticketId, closer }` |
| 监控告警 | `alert.triggered` | `{ alertId, name, severity, labels }` |
| 监控告警 | `alert.acknowledged` | `{ alertId, acknowledger }` |
| 监控告警 | `alert.resolved` | `{ alertId }` |
| CI/CD | `pipeline.started` | `{ pipelineId, runId, branch }` |
| CI/CD | `pipeline.completed` | `{ pipelineId, runId, status }` |
| CI/CD | `deployment.started` | `{ deploymentId, environment }` |
| CI/CD | `deployment.completed` | `{ deploymentId, status }` |

### 4.3 触发器管理器

```typescript
// services/lowcode/TriggerManager.ts

interface TriggerConfig {
  id: string;
  workflowId: string;
  name: string;
  type: 'event' | 'cron' | 'manual' | 'webhook';
  enabled: boolean;
  config: EventTriggerConfig | CronTriggerConfig | WebhookTriggerConfig;
}

class TriggerManager {
  private eventBus: EventBusService;
  private scheduler: WorkflowScheduler;
  private instanceManager: InstanceManager;

  // 初始化所有触发器
  async initialize(): Promise<void> {
    // 1. 加载所有启用的触发器
    const triggers = await this.loadEnabledTriggers();

    // 2. 订阅事件触发器
    for (const trigger of triggers.filter(t => t.type === 'event')) {
      await this.subscribeEventTrigger(trigger);
    }

    // 3. 注册定时触发器
    for (const trigger of triggers.filter(t => t.type === 'cron')) {
      await this.registerCronTrigger(trigger);
    }
  }

  // 事件触发处理
  private async handleEvent(event: TypedEnvelope<any>): Promise<void> {
    // 1. 查找匹配的触发器
    const triggers = await this.findMatchingTriggers(event.type, event.payload);

    // 2. 执行每个触发器
    for (const trigger of triggers) {
      try {
        await this.executeTrigger(trigger, event.payload);
      } catch (error) {
        await this.logTriggerFailure(trigger, error);
      }
    }
  }

  // 执行触发器
  private async executeTrigger(trigger: TriggerConfig, eventPayload: any): Promise<void> {
    // 1. 记录触发日志
    const log = await this.createTriggerLog(trigger, eventPayload);

    // 2. 构建工作流输入变量
    const inputVariables = this.buildInputVariables(trigger, eventPayload);

    // 3. 创建工作流实例
    const instance = await this.instanceManager.create(trigger.workflowId, inputVariables);

    // 4. 异步执行工作流
    await this.instanceManager.execute(instance.id);

    // 5. 更新触发日志
    await this.updateTriggerLog(log, instance.id);
  }
}
```

### 4.4 定时调度器

```typescript
// services/lowcode/WorkflowScheduler.ts

import { CronJob } from 'cron';

class WorkflowScheduler {
  private cronJobs = new Map<string, CronJob>();
  private instanceManager: InstanceManager;

  // 注册Cron触发器
  async registerCronTrigger(trigger: TriggerConfig): Promise<void> {
    const cronExpr = trigger.config.cronExpression;
    const job = new CronJob(cronExpr, () => {
      this.executeCronTrigger(trigger);
    }, null, true, trigger.config.timezone);

    this.cronJobs.set(trigger.id, job);
  }

  // 执行定时触发
  private async executeCronTrigger(trigger: TriggerConfig): Promise<void> {
    const inputVariables = {
      ...trigger.config.inputVariables,
      __triggeredAt: new Date().toISOString(),
      __triggerType: 'cron',
    };

    await this.instanceManager.create(trigger.workflowId, inputVariables);
    await this.instanceManager.execute(instance.id);
  }
}
```

---

## 5. 节点执行器增强

### 5.1 现有节点扩展

在现有 `WorkflowEngine.executeNode()` 方法中新增节点类型处理：

```typescript
// services/lowcode/WorkflowEngine.ts (扩展)

private async executeNode(node: WorkflowNode, instance: WorkflowInstance, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
  switch (node.type) {
    case 'start':
      return this.executeStartNode(node.config as StartNodeConfig, instance);
    case 'approval':
      return await this.executeApprovalNode(node.config as ApprovalNodeConfig, instance, context);
    case 'condition':
      return this.executeConditionNode(node.config as ConditionNodeConfig, instance, context);
    case 'notification':
      return await this.executeNotificationNode(node.config as NotificationNodeConfig, instance, context);
    case 'webhook':
      return await this.executeWebhookNode(node.config as WebhookNodeConfig, instance, context);
    case 'end':
      return this.executeEndNode(node.config as EndNodeConfig, instance);

    // ========== 新增节点类型 ==========
    case 'task':
      return await this.executeTaskNode(node.config as TaskNodeConfig, instance, context);
    case 'sub-workflow':
      return await this.executeSubWorkflowNode(node.config as SubWorkflowNodeConfig, instance, context);
    case 'delay':
      return await this.executeDelayNode(node.config as DelayNodeConfig, instance, context);
    case 'timer':
      return await this.executeTimerNode(node.config as TimerNodeConfig, instance, context);

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}
```

### 5.2 Task节点实现

```typescript
private async executeTaskNode(
  config: TaskNodeConfig,
  instance: WorkflowInstance,
  context: WorkflowExecutionContext
): Promise<NodeExecutionResult> {
  if (config.taskType === 'system') {
    // 系统任务：直接执行
    return await this.executeSystemTask(config, instance, context);
  } else {
    // 人工任务：创建任务记录，等待完成
    return await this.executeManualTask(config, instance, context);
  }
}

private async executeManualTask(
  config: TaskNodeConfig,
  instance: WorkflowInstance,
  context: WorkflowExecutionContext
): Promise<NodeExecutionResult> {
  // 1. 创建人工任务记录
  const task = await this.taskRepository.create({
    instance_id: instance.id,
    node_id: config.id,
    task_type: 'manual',
    assignee_type: config.assigneeType,
    assignee_id: this.resolveAssignee(config),
    title: config.title || `任务: ${config.name}`,
    description: config.description,
    status: 'pending',
  });

  // 2. 等待任务完成 (通过事件或超时)
  const completed = await this.waitForTaskCompletion(task.id, config.timeout * 1000);

  if (!completed) {
    // 超时处理
    return this.handleTaskTimeout(config, instance);
  }

  // 3. 返回任务结果
  return {
    outputVariables: {
      ...instance.variables,
      [config.resultVariable || 'taskResult']: {
        taskId: task.id,
        status: 'completed',
        formData: completed.formData,
      },
    },
    nextNodeId: this.getNextNodeId(instance),
  };
}
```

### 5.3 Sub-Workflow节点实现

```typescript
private async executeSubWorkflowNode(
  config: SubWorkflowNodeConfig,
  instance: WorkflowInstance,
  context: WorkflowExecutionContext
): Promise<NodeExecutionResult> {
  // 1. 构建子流程输入
  const subInput = this.mapVariables(instance.variables, config.inputMappings);

  // 2. 创建子流程实例
  const subInstance = await this.instanceManager.create(
    config.subWorkflowId,
    subInput,
    {
      parentInstanceId: instance.id,
      parentNodeId: config.id,
    }
  );

  if (config.waitForCompletion) {
    // 3. 等待子流程完成
    const result = await this.waitForInstanceCompletion(subInstance.id);

    // 4. 映射输出变量
    const outputVars = this.mapVariables(result.variables, config.outputMappings);

    return {
      outputVariables: {
        ...instance.variables,
        ...outputVars,
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  } else {
    // 异步执行，立即返回
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
```

---

## 6. API接口设计

### 6.1 触发器管理API

```yaml
# 触发器CRUD
POST   /api/v1/workflow-triggers           # 创建触发器
GET    /api/v1/workflow-triggers           # 列表触发器
GET    /api/v1/workflow-triggers/:id       # 获取触发器详情
PUT    /api/v1/workflow-triggers/:id       # 更新触发器
DELETE /api/v1/workflow-triggers/:id       # 删除触发器
POST   /api/v1/workflow-triggers/:id/test  # 测试触发器
POST   /api/v1/workflow-triggers/:id/enable # 启用触发器
POST   /api/v1/workflow-triggers/:id/disable # 禁用触发器

# 触发日志
GET    /api/v1/workflow-triggers/:id/logs  # 触发日志
```

### 6.2 人工任务API

```yaml
# 任务管理
GET    /api/v1/workflow-tasks                    # 我的任务列表
GET    /api/v1/workflow-tasks/:id                # 任务详情
POST   /api/v1/workflow-tasks/:id/complete       # 完成任务
POST   /api/v1/workflow-tasks/:id/cancel         # 取消任务
POST   /api/v1/workflow-tasks/:id/claim          # 签收任务
POST   /api/v1/workflow-tasks/:id/delegate       # 转派任务
```

### 6.3 工作流增强API

```yaml
# 工作流实例
POST   /api/v1/workflow-instances/:id/suspend   # 暂停实例
POST   /api/v1/workflow-instances/:id/resume    # 恢复实例
POST   /api/v1/workflow-instances/:id/terminate # 终止实例

# 手动触发
POST   /api/v1/workflows/:id/trigger            # 手动触发工作流
```

---

## 7. 前端设计

### 7.1 触发器配置页面

```
路径: /workflows/triggers
功能: 配置工作流触发器

布局:
┌─────────────────────────────────────────────────────────────┐
│  触发器管理                                    [+ 新建触发器] │
├─────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ 全部   │ │ 事件   │ │ 定时   │ │ Webhook│               │
│  └────────┘ └────────┘ └────────┘ └────────┘               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [图标] 工单创建自动处理流程                               ││
│  │ 类型: 事件触发 | 事件: ticket.created                    ││
│  │ 状态: 启用中 | 触发次数: 156                              ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [图标] 每日巡检报告                                       ││
│  │ 类型: 定时触发 | Cron: 0 9 * * *                         ││
│  │ 状态: 启用中 | 下次执行: 明天 09:00                       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 7.2 触发器配置表单

```
字段:
- 触发器名称: input
- 关联工作流: select (工作流列表)
- 触发类型: radio (事件/定时/Webhook/手动)

事件触发配置 (当选择"事件"时):
- 事件类型: select (ticket.created, alert.triggered, etc.)
- 事件过滤: JSON editor (可选)

定时触发配置 (当选择"定时"时):
- Cron表达式: input (支持可视化选择)
- 时区: select
- 执行策略: radio (并行/串行)

Webhook触发配置 (当选择"Webhook"时):
- Webhook路径: input (只读)
- 密钥: input (用于签名验证)
```

### 7.3 人工任务处理页面

```
路径: /workflows/tasks
功能: 处理待办人工任务

布局:
┌─────────────────────────────────────────────────────────────┐
│  我的任务                                  [待处理(5)] [已完成(12)] │
├─────────────────────────────────────────────────────────────┤
│  筛选: [全部] [待签收] [待处理] [超时]                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🔴 高优先级 | 发布审批流程 - 第2步                       ││
│  │ 申请人: 张三  |  截止时间: 14:00 (还有2小时)             ││
│  │ [查看详情] [签收] [转派]                                 ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🟡 中优先级 | 故障处理流程 - 确认步骤                    ││
│  │ 申请人: 李四  |  截止时间: 明天                          ││
│  │ [查看详情] [完成] [转派]                                 ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 7.4 工作流设计器扩展

```
新增节点面板:

┌─────────────┐
│  基础节点   │
├─────────────┤
│  ○ Start    │
│  ○ End      │
├─────────────┤
│  流程控制   │
├─────────────┤
│  ○ 审批    │ ← 已有
│  ○ 条件    │ ← 已有
│  ○ 任务    │ ← 新增
│  ○ 子流程  │ ← 新增
│  ○ 延迟    │ ← 新增
├─────────────┤
│  集成       │
├─────────────┤
│  ○ 通知    │ ← 已有
│  ○ Webhook │ ← 已有
│  ○ 定时器  │ ← 新增
└─────────────┘
```

---

## 8. 实现计划

### 8.1 阶段划分

| 阶段 | 范围 | 预计工时 |
|------|------|----------|
| **Phase 1** | 数据库迁移、基础框架 | 3天 |
| **Phase 2** | 触发器系统（事件+定时） | 4天 |
| **Phase 3** | Task/SubWorkflow节点 | 3天 |
| **Phase 4** | 前端界面 | 3天 |
| **Phase 5** | 集成测试与优化 | 2天 |
| **总计** | | **15天** |

### 8.2 Phase 1: 基础框架

- [ ] 创建数据库迁移 (workflow_triggers, workflow_trigger_logs, workflow_tasks)
- [ ] 创建 TriggerManager 类
- [ ] 创建 WorkflowScheduler 类
- [ ] 扩展 WorkflowEngine 节点执行器

### 8.3 Phase 2: 触发器系统

- [ ] 实现事件订阅与触发
- [ ] 实现Cron定时触发
- [ ] 实现Webhook触发
- [ ] 实现触发日志记录

### 8.4 Phase 3: 新增节点

- [ ] Task节点（人工任务+系统任务）
- [ ] SubWorkflow节点
- [ ] Delay节点
- [ ] Timer节点

### 8.5 Phase 4: 前端

- [ ] 触发器配置页面
- [ ] 触发器列表与详情
- [ ] 人工任务处理页面
- [ ] 工作流设计器节点扩展

### 8.6 Phase 5: 测试与优化

- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 文档完善

---

## 9. 风险与约束

### 9.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Cron调度精度 | 毫秒级延迟 | 使用节点Cron库，考虑分布式锁 |
| 事件积压 | 高并发时处理延迟 | 添加消息队列缓冲，限流处理 |
| 循环依赖 | 子流程可能循环调用 | 限制嵌套深度，增加检测 |

### 9.2 兼容性

- 现有工作流定义无需修改
- 现有节点类型完全兼容
- API变更向后兼容（新增非修改）

---

## 10. 验收标准

### 10.1 功能验收

- [ ] 支持事件触发工作流（工单、告警事件）
- [ ] 支持Cron定时触发工作流
- [ ] 支持手动触发工作流
- [ ] 支持Task节点（人工任务处理）
- [ ] 支持SubWorkflow节点（子流程）
- [ ] 前端完整支持所有配置

### 10.2 性能验收

- [ ] 事件触发延迟 < 500ms
- [ ] 100并发工作流执行稳定
- [ ] 前端页面加载 < 2s

### 10.3 可靠性验收

- [ ] 触发器故障不影响主流程
- [ ] 工作流异常有完整错误日志
- [ ] 数据一致性保证

---

## 附录

### A. 事件类型完整列表

```typescript
const EVENT_TYPES = {
  // 工单事件
  TICKET_CREATED: 'ticket.created',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_UPDATED: 'ticket.updated',
  TICKET_RESOLVED: 'ticket.resolved',
  TICKET_CLOSED: 'ticket.closed',
  TICKET_TRANSFERRED: 'ticket.transferred',

  // 告警事件
  ALERT_TRIGGERED: 'alert.triggered',
  ALERT_ACKNOWLEDGED: 'alert.acknowledged',
  ALERT_RESOLVED: 'alert.resolved',
  ALERT_SILENCED: 'alert.silenced',

  // CI/CD事件
  PIPELINE_STARTED: 'pipeline.started',
  PIPELINE_COMPLETED: 'pipeline.completed',
  PIPELINE_FAILED: 'pipeline.failed',
  DEPLOYMENT_STARTED: 'deployment.started',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',

  // 系统事件
  USER_CREATED: 'user.created',
  USER_DELETED: 'user.deleted',
  ROLE_CHANGED: 'role.changed',
  PERMISSION_GRANTED: 'permission.granted',
};
```

### B. Cron表达式示例

| 表达式 | 说明 |
|--------|------|
| `0 9 * * *` | 每天9点 |
| `0 9 * * 1-5` | 工作日9点 |
| `0 0 1 * *` | 每月1号0点 |
| `0 */6 * * *` | 每6小时 |
| `0 0 * * *` | 每小时 |

### C. 节点配置JSON Schema

(见附件 JSON Schema 定义)