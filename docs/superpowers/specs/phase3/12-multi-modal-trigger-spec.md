# 多模态触发详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 编写中
> **能力域**: 12. 多模态触发
> **目标成熟度**: L2 → L2.3
> **关键交付**: 条件驱动

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前触发能力：
- 手动触发（UI/CLI）
- API 触发
- Webhook 触发（`api/webhook-routes.ts`）
- Cron 调度（`api/cron-routes.ts`）
- EventBus 事件发布（`api/eventbus-routes.ts`）

**不足**：
- 无复杂条件触发（多条件组合、依赖条件）
- 无事件模式匹配触发
- 无 ChatOps 交互式触发
- 缺少触发条件可视化编辑器

### 1.2 Phase 3 目标 (L2.3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 条件驱动 | 多条件组合触发（AND/OR/NOT） | L2.3 |
| 事件模式匹配 | 基于 EventBus 事件模式匹配触发 | L2.3 |
| ChatOps 触发 | Slack/飞书/DingTalk 命令触发 Pipeline | L2.3 |
| 触发可视化 | 触发条件可视化编辑器 | L2.3 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| MT1 | 支持 5+ 触发类型：manual、webhook、schedule、event、chat | API 测试 |
| MT2 | 条件组合：AND/OR/NOT，嵌套最多 3 层 | 单元测试 |
| MT3 | 事件模式匹配：支持事件类型、属性、通配符 | 集成测试 |
| MT4 | ChatOps 触发：支持 /orion run <pipeline> 命令 | 集成测试 |
| MT5 | 触发条件可视化编辑器（拖拽/连线） | 前端验证 |
| MT6 | 触发历史与执行结果关联 | API 测试 |

## 三、API 设计

```
Base: /api/v1/triggers
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/definitions` | 获取触发定义列表 | - | `{ data: TriggerDefinition[] }` |
| POST | `/definitions` | 创建触发定义 | `CreateTrigger` | `{ id, name, type }` |
| PUT | `/definitions/:id` | 更新触发定义 | `CreateTrigger` | `{ ... }` |
| DELETE | `/definitions/:id` | 删除触发定义 | - | `{ success }` |
| POST | `/webhooks/:id/execute` | 执行 Webhook 触发 | `{ payload? }` | `{ runId, status }` |
| POST | `/events/match` | 事件模式匹配测试 | `{ event, pattern }` | `{ matched, details }` |
| GET | `/history` | 获取触发历史 | query: definitionId, status | `{ data: TriggerHistory[], total }` |
| GET | `/chatops/config` | 获取 ChatOps 配置 | - | `{ platforms, commands }` |
| PUT | `/chatops/config` | 更新 ChatOps 配置 | `ChatOpsConfig` | `{ success }` |

```typescript
interface TriggerDefinition {
  id: string;
  name: string;
  description: string;
  type: 'manual' | 'webhook' | 'schedule' | 'event' | 'chat' | 'condition';
  target: {
    pipelineId: string;
    params?: Record<string, unknown>;
  };
  conditions?: TriggerCondition;
  webhookConfig?: WebhookConfig;
  scheduleConfig?: ScheduleConfig;
  eventConfig?: EventConfig;
  chatConfig?: ChatConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TriggerCondition {
  operator: 'and' | 'or' | 'not';
  children: (TriggerCondition | ConditionExpression)[];
}

interface ConditionExpression {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex';
  value: unknown;
}

interface WebhookConfig {
  secret?: string;
  allowedIps?: string[];
  headerFilter?: Record<string, string>;
  payloadMapping?: Record<string, string>;
}

interface ScheduleConfig {
  cron: string;
  timezone: string;
}

interface EventConfig {
  eventType: string;
  pattern: Record<string, unknown>;
  source?: string;
}

interface ChatConfig {
  platform: 'slack' | 'feishu' | 'dingtalk';
  command: string;
  allowedChannels?: string[];
  allowedUsers?: string[];
  confirmationRequired: boolean;
}

interface TriggerHistory {
  id: string;
  definitionId: string;
  triggerType: string;
  status: 'triggered' | 'skipped' | 'failed';
  runId?: string;
  conditionResult?: boolean;
  triggerSource: string;
  triggeredAt: Date;
  error?: string;
}
```

## 四、数据库变更

```sql
-- Migration 112: Multi-Modal Triggers
CREATE TABLE IF NOT EXISTS trigger_definitions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  type                  VARCHAR(50) NOT NULL,
  target                JSONB NOT NULL,
  conditions            JSONB,
  webhook_config        JSONB,
  schedule_config       JSONB,
  event_config          JSONB,
  chat_config           JSONB,
  enabled               BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_trigger_definitions_tenant ON trigger_definitions(tenant_id);
CREATE INDEX idx_trigger_definitions_type ON trigger_definitions(type);

CREATE TABLE IF NOT EXISTS trigger_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id         UUID NOT NULL REFERENCES trigger_definitions(id) ON DELETE CASCADE,
  trigger_type          VARCHAR(50),
  status                VARCHAR(20),
  run_id                UUID,
  condition_result      BOOLEAN,
  trigger_source        VARCHAR(200),
  error                 TEXT,
  triggered_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_trigger_history_definition ON trigger_history(definition_id, triggered_at DESC);
```

## 五、前端设计

**路由**: `/triggers`

```
┌─────────────────────────────────────────────┐
│  多模态触发                      [创建触发器] │
├─────────────────────────────────────────────┤
│  触发器列表                                  │
│  ┌────────────────────────────────────────┐  │
│  │ PR 自动构建  [Webhook]  ✅             │  │
│  │   GitHub PR → 构建 Pipeline             │  │
│  ├────────────────────────────────────────┤  │
│  │ 每日安全扫描  [Schedule]  ✅           │  │
│  │   每天 02:00 → 安全扫描 Pipeline        │  │
│  ├────────────────────────────────────────┤  │
│  │ Slack 手动触发  [Chat]  ✅             │  │
│  │   /orion deploy production            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  触发历史                                    │
│  最近 100 次触发 | 成功率 98.5%              │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/Triggers/index.tsx` | 新建 | 多模态触发主页面 |
| `src/components/ConditionBuilder/index.tsx` | 新建 | 条件构建器 |
| `src/components/TriggerForm/index.tsx` | 新建 | 触发器表单 |
| `src/api/triggers.ts` | 新建 | 触发器 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 15 | ConditionEvaluator、EventMatcher、TriggerExecutor |
| 集成测试 | 5 | 条件触发→Pipeline 执行完整流程 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 条件评估延迟 | < 50ms |
| Webhook 处理 | < 200ms |
| ChatOps 响应 | < 2s |
| 事件匹配 | < 100ms |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 条件引擎 | 3 | 2 | 2 |
| 事件匹配 | 2 | - | 1 |
| ChatOps | 2 | 1 | 1 |
| 触发历史 | 1 | 1 | 0.5 |
| **合计** | **8** | **4** | **4.5** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
