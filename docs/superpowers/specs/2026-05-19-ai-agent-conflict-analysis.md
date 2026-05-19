# AI Agent 配置集成方案 — 冲突分析与修正

**日期**: 2026-05-19

---

## 一、冲突分析结果

### 发现 8 个冲突点，其中 3 个 Critical

---

### Conflict 1 (Critical): UnifiedConfigService 结构不一致

**问题**：配置方案提议新建 `config/ai-agents/` 目录和独立配置文件，但现有系统使用 `UnifiedConfigService.ts` 的 **单文件集中式配置**。

**现有模式**：
```typescript
// orion-platform-service/src/config/UnifiedConfigService.ts
export interface SystemConfig {
  app: { ... };
  database: { ... };
  alert: { deduplicationWindowMs, correlationWindowMs, ... };
  selfHealing: { enabled, maxConcurrentHealings, ... };
  pipeline: { maxConcurrentRuns, defaultTimeoutMinutes, ... };
  build: { maxParallelJobs, ... };
  artifact: { retentionDays, ... };
  canary: { initialTrafficPercent, ... };
  chaos: { maxConcurrentExperiments, ... };
  notification: { channels: { dingtalk, wechat, email, ... } };
  // ... 18 个模块的配置都在同一个 interface 中
}
```

**冲突**：
- 现有系统：所有模块配置集中在 `SystemConfig` interface
- 方案：提议独立 `AGENT_REGISTRY` 文件 + 环境变量

**修复方案**：在 `UnifiedConfigService.ts` 中新增 `aiAgents` 配置段

---

### Conflict 2 (Critical): EventBus 已有完整事件体系

**问题**：方案提议新建 `AIAgentEventTriggers` 和自定义事件名（如 `pipeline.run.failed`），但现有系统已有 **CloudEvents 1.0 规范** 的事件体系。

**现有事件体系**：
```
orion-platform-service/src/events/
├── EventBusAdapter.ts           # 统一事件适配器（CloudEvents 1.0）
├── PipelineEventPublisher.ts    # 流水线事件发布器
├── PipelineEventListener.ts     # 流水线事件监听器
├── CodeEventPublisher.ts        # 代码事件
├── DeploymentEventPublisher.ts  # 部署事件
├── ConfigEventPublisher.ts      # 配置事件
├── IncidentEventPublisher.ts    # 事件事件
├── SelfHealingEventPublisher.ts # 自愈事件
├── EventSubscriber.ts           # 通用事件订阅
└── types/                       # 各事件类型定义
```

**现有事件名模式**：
```typescript
// events/types.ts - PipelineEventType
export enum PipelineEventType {
  RunStarted = 'run.started',
  RunCompleted = 'run.completed',
  RunFailed = 'run.failed',      // ← 已存在，无需新建
  StageStarted = 'stage.started',
  StageCompleted = 'stage.completed',
  StageFailed = 'stage.failed',
  TaskStarted = 'task.started',
  TaskFailed = 'task.failed',
}
```

**冲突**：
- 方案中的 `pipeline.run.failed` 事件名与现有 `PipelineEventType.RunFailed` 重复
- 方案中的 `alert.triggered` 在现有系统中不存在（告警走的是 AlertService 直接调用）

**修复方案**：
- 复用现有 `PipelineEventType.RunFailed`，不新建事件
- 新增 `AIAgentEventPublisher` 扩展现有事件体系

---

### Conflict 3 (Critical): LLM Trace 已存在，审计表重复

**问题**：方案提议新建 `ai_agent_audit_log` 表，但现有系统已有 `llm_traces` 表和完整的 LLM Trace 体系。

**现有 LLM Trace 体系**：
```
orion-platform-service/src/services/llm-trace/
├── LLMTraceService.ts           # Trace 服务
└── CostCalculator.ts            # 成本计算

orion-ai-svc/src/services/llm-trace/
├── LLMTraceService.ts           # AI 服务侧 Trace
└── CostCalculator.ts            # 成本计算

orion-platform-service/src/api/llm-trace-routes.ts  # /api/v1/llm/traces/*
```

**现有数据库表**：
```sql
-- 已有
llm_traces (
  trace_id, tenant_id, scenario_id,
  provider, model, input_tokens, output_tokens,
  total_tokens, cost, status, created_at
)
```

**冲突**：方案提议的 `ai_agent_audit_log` 与 `llm_traces` 功能高度重叠

**修复方案**：复用 `llm_traces` 表，通过 `scenario_id` 区分不同 Agent

---

## 二、其他冲突（Important/Minor）

### Conflict 4 (Important): 场景路由重复

**问题**：方案在 `config/ai-agents/scenario-routing.ts` 中重新定义场景路由，但 `orion-ai-svc` 已有 `ScenarioRouter.ts`。

**现有**：
```
orion-ai-svc/src/services/ScenarioRouter.ts
```

**修复**：在现有 `ScenarioRouter.ts` 中扩展规则，不新建文件

---

### Conflict 5 (Important): 成本限制重复

**问题**：方案提议 `AI_AGENT_MAX_COST_PER_DAY` 环境变量，但 `orion-ai-svc` 已有 `CostTracker.ts`。

**现有**：
```
orion-ai-svc/src/services/CostTracker.ts
```

**修复**：通过 `CostTracker` 的 API 设置 Agent 维度的成本配额

---

### Conflict 6 (Important): 通知渠道配置重复

**问题**：方案提议 `WECOM_BOT_WEBHOOK_URL` 独立环境变量，但 `UnifiedConfigService` 已有通知渠道配置。

**现有**：
```typescript
notification: {
  channels: {
    dingtalk: { enabled: boolean; webhookUrl?: string };
    wechat: { enabled: boolean; corpId?: string; agentId?: string };
    email: { enabled: boolean; ... };
  };
}
```

**修复**：复用 `notification.channels.wechat` 配置

---

### Conflict 7 (Minor): API 路由注册方式不一致

**问题**：方案提议在 `app.ts` 中条件注册 AI Agent 路由，但现有系统所有路由都在 `routes.ts` 中统一注册。

**现有模式**：
```typescript
// orion-platform-service/src/api/routes.ts
import llmTraceRoutes from './llm-trace-routes';
import vectorStoreRoutes from './vector-store-routes';
// ... 60+ 个 route 模块统一导入注册
```

**修复**：新增 `ai-agent-routes.ts`，在 `routes.ts` 中统一注册

---

### Conflict 8 (Minor): 环境变量命名风格

**问题**：方案使用 `AI_AGENT_` 前缀，但现有系统环境变量风格不统一（部分用 `DB_`、`REDIS_`、`NATS_`）。

**修复**：保持 `AI_AGENT_` 前缀（与现有 `AI_LLM_` 风格一致），但需在文档中统一说明

---

## 三、修正后的配置方案

### 3.1 UnifiedConfigService 扩展

```typescript
// orion-platform-service/src/config/UnifiedConfigService.ts
// 在 SystemConfig interface 中新增：

export interface SystemConfig {
  // ... 现有配置段不变 ...

  // AI Agent 配置（新增）
  aiAgents: {
    // 总开关
    enabled: boolean;

    // 单个 Agent 开关
    agents: {
      'pipeline-yaml': {
        enabled: boolean;
        maxConcurrency: number;
        timeoutMs: number;
        retry: { maxRetries: number; backoffMs: number; };
        requiredTools: string[];
        requiredPermissions: string[];
      };
      'root-cause': {
        enabled: boolean;
        maxConcurrency: number;
        timeoutMs: number;
        retry: { maxRetries: number; backoffMs: number; };
        requiredTools: string[];
        requiredPermissions: string[];
      };
      'auto-fix': {
        enabled: boolean;
        maxConcurrency: number;
        timeoutMs: number;
        retry: { maxRetries: number; backoffMs: number; };
        requireApproval: boolean;  // 自动修复需审批
        requiredTools: string[];
        requiredPermissions: string[];
      };
      'perf-opt': {
        enabled: boolean;
        maxConcurrency: number;
        timeoutMs: number;
        requiredTools: string[];
      };
      'release-diff': {
        enabled: boolean;
        maxConcurrency: number;
        timeoutMs: number;
        requiredTools: string[];
      };
      'release-notes': {
        enabled: boolean;
        maxConcurrency: number;
        timeoutMs: number;
        requiredTools: string[];
      };
      'alert-classify': {
        enabled: boolean;
        maxConcurrency: number;
        timeoutMs: number;
        requiredTools: string[];
      };
      'alert-merge': {
        enabled: boolean;
        maxConcurrency: number;
        timeoutMs: number;
        requiredTools: string[];
      };
      'rag-knowledge': {
        enabled: boolean;
        maxConcurrency: number;
        timeoutMs: number;
        requiredTools: string[];
        knowledgeBaseId?: string;
      };
      'wecom-bot': {
        enabled: boolean;
        webhookPath: string;  // 默认 /webhook/wecom-knowledge
      };
    };

    // 全局限制
    global: {
      maxTokensPerDay: number;     // 每日 Token 上限
      maxCostPerDay: number;       // 每日成本上限（元）
    };
  };
}
```

### 3.2 环境变量映射

```bash
# 环境变量 → UnifiedConfigService 映射

# 总开关
AI_AGENTS_ENABLED=true                      → aiAgents.enabled

# 单个 Agent
AI_AGENT_PIPELINE_YAML_ENABLED=true         → aiAgents.agents['pipeline-yaml'].enabled
AI_AGENT_ROOT_CAUSE_ENABLED=true            → aiAgents.agents['root-cause'].enabled
AI_AGENT_AUTO_FIX_ENABLED=false             → aiAgents.agents['auto-fix'].enabled
# ... 其他 Agent

# 全局限制
AI_AGENT_MAX_TOKENS_PER_DAY=100000          → aiAgents.global.maxTokensPerDay
AI_AGENT_MAX_COST_PER_DAY=50                → aiAgents.global.maxCostPerDay

# 企微 Webhook（路由用，不走通知渠道）
AI_AGENT_WECOM_WEBHOOK_PATH=/webhook/wecom-knowledge  → aiAgents.agents['wecom-bot'].webhookPath
```

### 3.3 事件体系修正

```typescript
// 复用现有事件，不新建事件类型
// 新增 Agent 作为事件订阅者，而非发布者

import { PipelineEventType } from '../events/types';
import { EventSubscriber, TypedSubscriptionRule } from '../events/EventSubscriber';

// AI Agent 事件订阅规则
export const AIAgentSubscriptionRules: TypedSubscriptionRule[] = [
  {
    // 流水线失败 → 触发根因分析 Agent
    eventType: 'pipeline.run.failed',        // 复用现有事件
    handler: 'ai-agent:root-cause',
    filter: (event) => event.agentId === 'root-cause',
  },
  {
    // 流水线完成 → 触发性能分析 Agent
    eventType: 'pipeline.run.completed',     // 复用现有事件
    handler: 'ai-agent:perf-opt',
    filter: (event) => event.agentId === 'perf-opt',
  },
];

// 注册到现有 EventBus
export function registerAIAgentSubscribers(
  eventBus: EventBusService,
  agentRegistry: AgentRegistry
): void {
  for (const rule of AIAgentSubscriptionRules) {
    eventBus.subscribe(rule.eventType, async (event) => {
      const agent = agentRegistry.get(rule.handler.replace('ai-agent:', ''));
      if (agent?.isEnabled()) {
        await agent.handleEvent(event);
      }
    });
  }
}
```

### 3.4 审计复用 LLM Trace

```typescript
// 不新建 ai_agent_audit_log 表
// Agent 执行记录写入 llm_traces 表，通过 scenario_id 区分

// scenario_id 命名规范：
// 'agent:pipeline-yaml'
// 'agent:root-cause'
// 'agent:auto-fix'
// 'agent:perf-opt'
// 'agent:alert-classify'
// 'agent:rag-knowledge'
// ...

// LLM Trace 已包含：
// - trace_id (可关联 Agent 执行 ID)
// - scenario_id (区分 Agent)
// - provider, model
// - input_tokens, output_tokens, total_tokens
// - cost
// - status
// - created_at

// 如需额外审计字段（input/output JSON），扩展 llm_traces 表：
ALTER TABLE llm_traces ADD COLUMN agent_input JSONB;
ALTER TABLE llm_traces ADD COLUMN agent_output JSONB;
ALTER TABLE llm_traces ADD COLUMN user_id UUID;
ALTER TABLE llm_traces ADD COLUMN tenant_id UUID;
```

### 3.5 场景路由扩展

```typescript
// orion-ai-svc/src/services/ScenarioRouter.ts
// 在现有 rules 数组中追加 Agent 场景

export const scenarioRoutingRules: ScenarioRoutingRule[] = [
  // ... 现有规则 ...

  // Agent 场景（新增）
  { scenario: 'agent:pipeline-yaml', ... },
  { scenario: 'agent:root-cause', ... },
  { scenario: 'agent:auto-fix', ... },
  { scenario: 'agent:perf-opt', ... },
  { scenario: 'agent:release-diff', ... },
  { scenario: 'agent:release-notes', ... },
  { scenario: 'agent:alert-classify', ... },
  { scenario: 'agent:alert-merge', ... },
  { scenario: 'agent:rag-knowledge', ... },
];
```

---

## 四、冲突修复总结

| # | 冲突 | 严重程度 | 修复方式 |
|---|------|---------|---------|
| 1 | 配置结构不一致 | Critical | 在 UnifiedConfigService 中新增 `aiAgents` 段 |
| 2 | 事件体系重复 | Critical | 复用现有 PipelineEventType，不新建事件 |
| 3 | 审计表重复 | Critical | 扩展 `llm_traces` 表，不新建 `ai_agent_audit_log` |
| 4 | 场景路由重复 | Important | 在现有 ScenarioRouter.ts 中扩展 |
| 5 | 成本限制重复 | Important | 复用 CostTracker |
| 6 | 通知渠道重复 | Important | 复用 `notification.channels.wechat` |
| 7 | 路由注册不一致 | Minor | 在 routes.ts 中统一注册 |
| 8 | 环境变量风格 | Minor | 保持 `AI_AGENT_` 前缀，统一文档 |

---

## 五、修正后的模块边界

```
orion-platform-service/src/
├── config/
│   └── UnifiedConfigService.ts          # 新增 aiAgents 配置段 ← 修改
├── api/
│   ├── routes.ts                        # 新增 aiAgentRoutes 导入 ← 修改
│   └── ai-agent-routes.ts               # 新增
├── events/
│   └── ai-agent-subscriptions.ts        # 新增：Agent 事件订阅
├── services/
│   ├── ai-agents/                       # 新增：Agent 实现
│   │   ├── base/
│   │   │   ├── BaseAgent.ts
│   │   │   ├── types.ts
│   │   │   └── AIGatewayAdapter.ts
│   │   ├── pipeline/
│   │   ├── stability/
│   │   ├── performance/
│   │   ├── release/
│   │   ├── knowledge/
│   │   └── monitoring/
│   └── ai/                              # 已有，不动
│       ├── AIGateway.ts
│       ├── ScenarioRouter.ts            # 扩展 Agent 场景路由 ← 修改
│       ├── CostTracker.ts
│       └── ...
└── repositories/
    ├── LLMTraceRepository.ts            # 扩展字段 ← 修改
    └── ...
```

**不变的部分**：
- 现有 70+ 业务服务代码不变
- 现有 60+ API 路由不变
- 现有 EventBus 事件发布逻辑不变
- 现有 UnifiedConfigService 中其他配置段不变
