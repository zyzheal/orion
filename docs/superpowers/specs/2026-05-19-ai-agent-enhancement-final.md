# AI Agent 增强 DevOps 系统 — 完整设计方案

**日期**: 2026-05-19
**状态**: Draft
**版本**: 2.0（修正冲突后）

---

## 一、设计概述

### 1.1 背景

Orion 平台已具备 AI 基础能力（AI Gateway、MultiAgentOrchestrator、ToolRegistry、LLM Trace、ScenarioRouter、CostTracker），但未与 DevOps 六大业务模块深度集成。

### 1.2 目标

将 AI Agent 能力注入六大模块，同时 **完全兼容现有系统架构**，不引入任何冲突。

### 1.3 设计约束

| 约束 | 要求 |
|------|------|
| 配置 | 在 `UnifiedConfigService.ts` 中新增 `aiAgents` 段，不新建配置目录 |
| 事件 | 复用现有 EventBus + PipelineEventType，不新建事件类型 |
| 审计 | 扩展 `llm_traces` 表，不新建审计表 |
| 场景路由 | 在现有 `ScenarioRouter.ts` 中扩展规则 |
| 成本 | 复用 `CostTracker.ts` |
| 通知 | 复用 `notification.channels.wechat` |
| 路由注册 | 在 `routes.ts` 中统一注册 |
| 环境变量 | 使用 `AI_AGENT_` 前缀（与 `AI_LLM_` 一致） |

---

## 二、架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        orion-platform-service                            │
│                                                                          │
│  ┌─────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │  现有业务模块（不变）             │  │  新增 AI Agent 模块            │  │
│  │                                 │  │                               │  │
│  │  PipelineService                │  │  ai-agents/                   │  │
│  │  BuildService                   │  │  ├── base/                    │  │
│  │  AlertService                   │  │  │   ├── BaseAgent.ts         │  │
│  │  DeployService                  │  │  │   ├── types.ts             │  │
│  │  NotificationService            │  │  │   └── AIGatewayAdapter.ts  │  │
│  │  GitService                     │  │  ├── pipeline/                │  │
│  │  ...                            │  │  ├── stability/               │  │
│  └──────────┬──────────────────────┘  │  ├── performance/             │  │
│             │ 只读接口调用             │  ├── release/                 │  │
│             │                         │  ├── knowledge/               │  │
│             ▼                         │  └── monitoring/              │  │
│  ┌─────────────────────────────────┐  └──────────────┬───────────────┘  │
│  │  基础设施层（已有，扩展）         │                 │                   │
│  │                                 │                 │                   │
│  │  AIGateway ─────────────────────┼─────────────────┤                   │
│  │  ScenarioRouter ◄─── 扩展场景规则 │                 │                   │
│  │  CostTracker ◄────── 设配额      │                 │                   │
│  │  ToolRegistry ──────────────────┼─────────────────┤                   │
│  │  EventBus ──────────────────────┼─ 订阅现有事件   │                   │
│  │  UnifiedConfigService ◄─ 新增段 │                 │                   │
│  │  LLMTraceRepository ◄── 扩展字段│                 │                   │
│  └─────────────────────────────────┘                 │                   │
└──────────────────────────────────────────────────────┼───────────────────┘
                                                       │
                                                       ▼
                                              统一通过 AIGateway
                                              调用 LLM Provider
```

---

## 三、配置设计（修正后）

### 3.1 UnifiedConfigService 扩展

在 `orion-platform-service/src/config/UnifiedConfigService.ts` 的 `SystemConfig` interface 中新增：

```typescript
export interface SystemConfig {
  // ========== 现有配置段（不变） ==========
  app: { ... };
  database: { ... };
  redis: { ... };
  nats: { ... };
  escalation: { ... };
  alert: { ... };
  selfHealing: { ... };
  ticketing: { ... };
  monitoring: { ... };
  security: { ... };
  notification: {
    channels: {
      dingtalk: { enabled: boolean; webhookUrl?: string };
      wechat: { enabled: boolean; corpId?: string; agentId?: string };
      email: { enabled: boolean; smtpHost?: string; smtpPort?: number };
      sms: { enabled: boolean; provider?: string };
      slack: { enabled: boolean; webhookUrl?: string };
    };
    defaultChannel: string;
  };
  audit: { ... };
  pipeline: { ... };
  deploy: { ... };
  tenant: { ... };
  build: { ... };
  artifact: { ... };
  canary: { ... };
  chaos: { ... };

  // ========== 新增：AI Agent 配置 ==========
  aiAgents: {
    // 总开关
    enabled: boolean;

    // 单个 Agent 配置
    agents: {
      'pipeline-yaml': AgentRuntimeConfig;
      'root-cause': AgentRuntimeConfig;
      'auto-fix': AgentRuntimeConfig & { requireApproval: boolean };
      'perf-opt': AgentRuntimeConfig;
      'release-diff': AgentRuntimeConfig;
      'release-notes': AgentRuntimeConfig;
      'alert-classify': AgentRuntimeConfig;
      'alert-merge': AgentRuntimeConfig;
      'rag-knowledge': AgentRuntimeConfig & { knowledgeBaseId?: string };
      'wecom-bot': { enabled: boolean; webhookPath: string };
    };

    // 全局限制
    global: {
      maxTokensPerDay: number;     // 每日 Token 上限（默认 100000）
      maxCostPerDay: number;       // 每日成本上限（默认 ¥50）
    };
  };
}

// Agent 运行时配置（通用）
interface AgentRuntimeConfig {
  enabled: boolean;
  maxConcurrency: number;      // 最大并发调用数
  timeoutMs: number;           // 超时时间
  retry: {
    maxRetries: number;
    backoffMs: number;
  };
  requiredTools: string[];     // 依赖的工具列表
  requiredPermissions: string[]; // 需要的权限列表
}
```

### 3.2 环境变量映射

```bash
# .env 文件

# ===== AI Agent 总开关 =====
AI_AGENTS_ENABLED=true

# ===== 单个 Agent 开关 =====
AI_AGENT_PIPELINE_YAML_ENABLED=true
AI_AGENT_ROOT_CAUSE_ENABLED=true
AI_AGENT_AUTO_FIX_ENABLED=false          # P2，默认关闭
AI_AGENT_PERF_OPT_ENABLED=true
AI_AGENT_RELEASE_DIFF_ENABLED=true
AI_AGENT_RELEASE_NOTES_ENABLED=true
AI_AGENT_ALERT_CLASSIFY_ENABLED=true
AI_AGENT_ALERT_MERGE_ENABLED=true
AI_AGENT_RAG_KNOWLEDGE_ENABLED=true
AI_AGENT_WECOM_BOT_ENABLED=false

# ===== 全局限制 =====
AI_AGENT_MAX_TOKENS_PER_DAY=100000
AI_AGENT_MAX_COST_PER_DAY=50

# ===== LLM Provider（已有，不动） =====
AI_LLM_ANTHROPIC_API_KEY=sk-xxx
AI_LLM_OPENAI_API_KEY=sk-xxx
```

---

## 四、数据库设计（修正后）

### 4.1 扩展 llm_traces 表

```sql
-- 在现有 llm_traces 表上新增字段
-- 不新建表，复用现有 LLM Trace 体系

ALTER TABLE llm_traces
  ADD COLUMN IF NOT EXISTS agent_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS agent_input JSONB,
  ADD COLUMN IF NOT EXISTS agent_output JSONB;

-- agent_id 格式：'pipeline-yaml', 'root-cause', 'auto-fix', ...
-- agent_input: Agent 的原始输入（如自然语言描述）
-- agent_output: Agent 的原始输出（如生成的 YAML）
```

### 4.2 现有 llm_traces 表结构（供参考）

```sql
-- 已有字段
llm_traces (
  trace_id UUID PRIMARY KEY,
  tenant_id UUID,
  scenario_id VARCHAR(100),       -- Agent 场景：'agent:pipeline-yaml' 等
  provider VARCHAR(50),           -- 'anthropic', 'openai'
  model VARCHAR(50),              -- 'sonnet-4-6', 'opus-4-6', 'haiku-4-5'
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost DECIMAL(10,4),             -- 本次调用成本
  status VARCHAR(20),             -- 'success', 'failed', 'timeout'
  created_at TIMESTAMP DEFAULT NOW()
)
```

---

## 五、代码实现

### 5.1 目录结构

```
orion-platform-service/src/
├── config/
│   └── UnifiedConfigService.ts          # 新增 aiAgents 配置段
├── api/
│   ├── routes.ts                        # 新增 import + 注册
│   └── ai-agent-routes.ts               # 新增
├── events/
│   └── ai-agent-subscriptions.ts        # 新增
├── services/
│   ├── ai-agents/                       # 新增
│   │   ├── index.ts                     # Agent 初始化入口
│   │   ├── base/
│   │   │   ├── BaseAgent.ts             # Agent 抽象基类
│   │   │   ├── types.ts                 # 类型定义
│   │   │   └── AIGatewayAdapter.ts      # AIGateway 适配层
│   │   ├── pipeline/
│   │   │   ├── PipelineYamlAgent.ts
│   │   │   └── prompts.ts
│   │   ├── stability/
│   │   │   ├── RootCauseAgent.ts
│   │   │   ├── AutoFixAgent.ts
│   │   │   └── prompts.ts
│   │   ├── performance/
│   │   │   ├── PerfOptAgent.ts
│   │   │   └── prompts.ts
│   │   ├── release/
│   │   │   ├── ReleaseDiffAgent.ts
│   │   │   ├── ReleaseNotesAgent.ts
│   │   │   └── prompts.ts
│   │   ├── knowledge/
│   │   │   ├── RAGKnowledgeAgent.ts
│   │   │   └── prompts.ts
│   │   └── monitoring/
│   │       ├── AlertClassifyAgent.ts
│   │       ├── AlertMergeAgent.ts
│   │       └── prompts.ts
│   └── ai/                              # 已有，只扩展不修改
│       ├── ScenarioRouter.ts            # 扩展 Agent 场景规则
│       └── ...
└── repositories/
    └── LLMTraceRepository.ts            # 扩展字段支持
```

### 5.2 BaseAgent 基类

```typescript
// orion-platform-service/src/services/ai-agents/base/types.ts

export interface AgentConfig {
  id: string;
  name: string;
  enabled: boolean;
  scenario: string;                    // AI Gateway 场景标识
  maxConcurrency: number;
  timeoutMs: number;
  retry: { maxRetries: number; backoffMs: number };
  requiredTools: string[];
  requiredPermissions: string[];
}

export interface AgentExecutionContext {
  traceId: string;
  userId: string;
  tenantId: string;
  timestamp: string;
}
```

```typescript
// orion-platform-service/src/services/ai-agents/base/BaseAgent.ts

import { AIGateway } from '../../ai/AIGateway';
import { AgentConfig, AgentExecutionContext } from './types';
import { AIGatewayAdapter } from './AIGatewayAdapter';
import { LLMTraceService } from '../../llm-trace/LLMTraceService';

/**
 * Agent 抽象基类
 *
 * 职责：
 * 1. 统一的生命周期管理（启用检查、限流、重试）
 * 2. 统一的 AI Gateway 调用（通过 AIGatewayAdapter）
 * 3. 统一的 LLM Trace 记录（复用 llm_traces 表）
 * 4. 统一的错误处理
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected gatewayAdapter: AIGatewayAdapter;
  protected traceService: LLMTraceService;

  private concurrentCalls = 0;

  constructor(
    config: AgentConfig,
    aiGateway: AIGateway,
    traceService: LLMTraceService
  ) {
    this.config = config;
    this.gatewayAdapter = new AIGatewayAdapter(aiGateway);
    this.traceService = traceService;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async execute<TInput, TOutput>(
    input: TInput,
    context: AgentExecutionContext
  ): Promise<TOutput> {
    if (!this.isEnabled()) {
      throw new Error(`Agent ${this.config.id} is disabled`);
    }

    if (this.concurrentCalls >= this.config.maxConcurrency) {
      throw new Error(`Agent ${this.config.id} concurrency limit reached`);
    }

    this.concurrentCalls++;

    const startTime = Date.now();
    try {
      const result = await this.doExecute(input, context);

      // 记录 LLM Trace（复用 llm_traces 表）
      await this.traceService.recordTrace({
        traceId: context.traceId,
        tenantId: context.tenantId as any,
        scenarioId: `agent:${this.config.id}`,
        provider: 'anthropic',
        model: this.config.scenario,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        status: 'success',
        agentInput: JSON.stringify(input),
        agentOutput: JSON.stringify(result),
      });

      return result;
    } catch (error) {
      // 错误也记录 Trace
      await this.traceService.recordTrace({
        traceId: context.traceId,
        tenantId: context.tenantId as any,
        scenarioId: `agent:${this.config.id}`,
        provider: 'anthropic',
        model: this.config.scenario,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        status: 'failed',
        agentInput: JSON.stringify(input),
        agentOutput: JSON.stringify({ error: error.message }),
      });
      throw error;
    } finally {
      this.concurrentCalls--;
    }
  }

  protected abstract doExecute<TInput, TOutput>(
    input: TInput,
    context: AgentExecutionContext
  ): Promise<TOutput>;

  protected async callAI(prompt: string, temperature: number = 0.3): Promise<string> {
    const result = await this.gatewayAdapter.chat({
      scenario: `agent:${this.config.id}`,
      messages: [{ role: 'user', content: prompt }],
      temperature,
    });
    return result.content;
  }
}
```

### 5.3 AIGatewayAdapter

```typescript
// orion-platform-service/src/services/ai-agents/base/AIGatewayAdapter.ts

import { AIGateway, AIRequest } from '../../ai/AIGateway';

/**
 * AIGateway 适配层
 * 为 Agent 提供简化的 chat() 接口
 */
export class AIGatewayAdapter {
  constructor(private gateway: AIGateway) {}

  async chat(options: {
    scenario: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
  }): Promise<{ content: string }> {
    const result = await this.gateway.execute({
      scenario: options.scenario as any,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
    } as AIRequest);

    return { content: result.data as string };
  }
}
```

### 5.4 场景路由扩展

```typescript
// orion-ai-svc/src/services/ScenarioRouter.ts
// 在现有 rules 数组中追加：

export const scenarioRoutingRules: ScenarioRoutingRule[] = [
  // ... 现有规则（不变） ...

  // Agent 场景（新增）
  {
    scenario: 'agent:pipeline-yaml',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
    maxTokens: 4000,
    temperature: 0.2,
  },
  {
    scenario: 'agent:root-cause',
    primaryProvider: 'anthropic',
    primaryModel: 'opus-4-6',
    fallbackProvider: 'anthropic',
    fallbackModel: 'sonnet-4-6',
    maxTokens: 8000,
    temperature: 0.1,
  },
  {
    scenario: 'agent:auto-fix',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    maxTokens: 4000,
    temperature: 0.1,
  },
  {
    scenario: 'agent:perf-opt',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    maxTokens: 4000,
    temperature: 0.3,
  },
  {
    scenario: 'agent:release-diff',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    maxTokens: 6000,
    temperature: 0.2,
  },
  {
    scenario: 'agent:release-notes',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    maxTokens: 3000,
    temperature: 0.7,
  },
  {
    scenario: 'agent:alert-classify',
    primaryProvider: 'anthropic',
    primaryModel: 'haiku-4-5',
    maxTokens: 1000,
    temperature: 0.1,
  },
  {
    scenario: 'agent:alert-merge',
    primaryProvider: 'anthropic',
    primaryModel: 'haiku-4-5',
    maxTokens: 500,
    temperature: 0.1,
  },
  {
    scenario: 'agent:rag-knowledge',
    primaryProvider: 'anthropic',
    primaryModel: 'haiku-4-5',
    fallbackProvider: 'anthropic',
    fallbackModel: 'sonnet-4-6',
    maxTokens: 3000,
    temperature: 0.3,
  },
];
```

### 5.5 事件订阅（复用现有 EventBus）

```typescript
// orion-platform-service/src/events/ai-agent-subscriptions.ts

import { EventBusService } from '../services/event-bus-service';
import { AgentRegistry } from '../services/ai-agents/base/AgentRegistry';
import { PipelineEventType } from './types';

/**
 * AI Agent 事件订阅
 *
 * 复用现有 EventBus + PipelineEventType，不新建事件类型
 * Agent 作为事件订阅者，而非发布者
 */
export function registerAIAgentSubscribers(
  eventBus: EventBusService,
  agentRegistry: AgentRegistry
): void {
  // 流水线失败 → 触发根因分析 Agent
  eventBus.subscribe(PipelineEventType.RunFailed, async (event) => {
    const agent = agentRegistry.get('root-cause');
    if (agent?.isEnabled()) {
      try {
        await agent.handlePipelineFailed(event.data.runId);
      } catch (error) {
        console.error('RootCauseAgent failed:', error);
      }
    }
  });

  // 流水线完成 → 触发性能分析 Agent（定时触发改为事件触发）
  eventBus.subscribe(PipelineEventType.RunCompleted, async (event) => {
    const agent = agentRegistry.get('perf-opt');
    if (agent?.isEnabled()) {
      try {
        await agent.analyzePipelineRun(event.data.runId);
      } catch (error) {
        console.error('PerfOptAgent failed:', error);
      }
    }
  });

  // 更多订阅规则...
}
```

### 5.6 API 路由注册

```typescript
// orion-platform-service/src/api/ai-agent-routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { AgentRegistry } from '../services/ai-agents/base/AgentRegistry';

export interface AIAgentRoutesOptions {
  agentRegistry: AgentRegistry;
}

export async function aiAgentRoutes(
  app: FastifyInstance,
  options: AIAgentRoutesOptions
): Promise<void> {
  const registry = options.agentRegistry;

  // POST /api/v1/agents/:agentId/execute
  app.post(
    '/:agentId/execute',
    {
      onRequest: [
        authenticateUser,
        requirePermission({
          resource: 'ai_agent',
          action: 'execute',
          extractResourceId: (req) => (req.params as { agentId: string }).agentId,
        }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: { agentId: string }; Body: any }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const agent = registry.get(agentId);

      if (!agent) {
        return reply.code(404).send({ error: `Agent ${agentId} not found` });
      }

      if (!agent.isEnabled()) {
        return reply.code(503).send({ error: `Agent ${agentId} is disabled` });
      }

      const result = await agent.execute(request.body, {
        traceId: request.id,
        userId: (request.user as any).id,
        tenantId: (request.user as any).tenantId,
        timestamp: new Date().toISOString(),
      });

      return reply.send({ agentId, result });
    }
  );

  // GET /api/v1/agents - 获取 Agent 列表
  app.get(
    '/',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'ai_agent', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const agents = registry.getAll().map(a => ({
        id: a.config.id,
        name: a.config.name,
        enabled: a.isEnabled(),
        scenario: a.config.scenario,
      }));
      return reply.send({ agents });
    }
  );
}
```

```typescript
// orion-platform-service/src/api/routes.ts
// 在现有 import 列表中新增：

import { aiAgentRoutes, AIAgentRoutesOptions } from './ai-agent-routes';

// 在路由注册函数中新增：

if (unifiedConfig.getConfig().aiAgents?.enabled) {
  const agentRegistry = initializeAIAgents(unifiedConfig, aiGateway, traceService);
  await app.register(aiAgentRoutes, {
    prefix: '/api/v1/agents',
    agentRegistry,
  } as AIAgentRoutesOptions);

  // 注册事件订阅
  registerAIAgentSubscribers(eventBusService, agentRegistry);
}
```

---

## 六、各 Agent 详细设计

### 6.1 PipelineYamlAgent

```typescript
// orion-platform-service/src/services/ai-agents/pipeline/PipelineYamlAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { AIGateway } from '../../ai/AIGateway';
import { LLMTraceService } from '../../llm-trace/LLMTraceService';
import { AgentConfig, AgentExecutionContext } from '../base/types';
import { PIPELINE_YAML_PROMPT } from './prompts';

export interface PipelineYamlInput {
  naturalLanguage: string;
  platform?: 'android' | 'ios' | 'pc' | 'web';
  templateId?: string;
}

export interface PipelineYamlOutput {
  yaml: string;
  stages: Array<{ name: string; tasks: string[] }>;
  validationErrors: string[];
  suggestions: string[];
}

export class PipelineYamlAgent extends BaseAgent {
  private pipelineService: PipelineService;

  constructor(
    aiGateway: AIGateway,
    traceService: LLMTraceService,
    private pipelineService: PipelineService
  ) {
    super({
      id: 'pipeline-yaml',
      name: 'Pipeline YAML Generator',
      enabled: true,
      scenario: 'agent:pipeline-yaml',
      maxConcurrency: 5,
      timeoutMs: 30000,
      retry: { maxRetries: 2, backoffMs: 1000 },
      requiredTools: ['pipeline'],
      requiredPermissions: ['pipeline:create'],
    }, aiGateway, traceService);
  }

  protected async doExecute(
    input: PipelineYamlInput,
    _context: AgentExecutionContext
  ): Promise<PipelineYamlOutput> {
    const prompt = PIPELINE_YAML_PROMPT.render({
      nl: input.naturalLanguage,
      platform: input.platform || 'pc',
      templates: this.pipelineService.getTemplates(input.platform).map(t =>
        `- ${t.name}: ${t.description}`
      ).join('\n'),
    });

    const content = await this.callAI(prompt, 0.2);
    const yaml = this.extractYaml(content);
    const validation = this.pipelineService.validateYaml(yaml);

    return {
      yaml,
      stages: this.parseStages(yaml),
      validationErrors: validation.errors,
      suggestions: validation.warnings,
    };
  }

  private extractYaml(content: string): string {
    const match = content.match(/```yaml\n([\s\S]*?)\n```/);
    return match ? match[1] : content;
  }

  private parseStages(yaml: string): Array<{ name: string; tasks: string[] }> {
    // 解析 YAML stages
    return [];
  }
}
```

### 6.2 RootCauseAgent

```typescript
// orion-platform-service/src/services/ai-agents/stability/RootCauseAgent.ts

import { BaseAgent } from '../base/BaseAgent';
import { AIGateway } from '../../ai/AIGateway';
import { LLMTraceService } from '../../llm-trace/LLMTraceService';
import { AgentConfig, AgentExecutionContext } from '../base/types';
import { ROOT_CAUSE_PROMPT } from './prompts';

export interface RootCauseOutput {
  rootCause: string;
  confidence: number;
  culpritCommit?: {
    hash: string;
    author: string;
    message: string;
    changedFiles: string[];
  };
  evidence: string[];
  fixSuggestion: string;
}

export class RootCauseAgent extends BaseAgent {
  constructor(
    aiGateway: AIGateway,
    traceService: LLMTraceService,
    private pipelineRunService: PipelineRunService,
    private gitService: GitService,
    private errorClassifier: ErrorClassifier
  ) {
    super({
      id: 'root-cause',
      name: 'Root Cause Analyzer',
      enabled: true,
      scenario: 'agent:root-cause',
      maxConcurrency: 3,
      timeoutMs: 60000,
      retry: { maxRetries: 1, backoffMs: 2000 },
      requiredTools: ['pipeline', 'git', 'log_query'],
      requiredPermissions: ['pipeline:read', 'code:read'],
    }, aiGateway, traceService);
  }

  async handlePipelineFailed(runId: string): Promise<RootCauseOutput> {
    return this.execute({ runId }, {
      traceId: `rca-${runId}`,
      userId: 'system',
      tenantId: 'system',
      timestamp: new Date().toISOString(),
    });
  }

  protected async doExecute(
    input: { runId: string },
    _context: AgentExecutionContext
  ): Promise<RootCauseOutput> {
    // 1. 收集上下文数据
    const runLogs = await this.pipelineRunService.getRunLogs(input.runId);
    const errorClass = await this.errorClassifier.classify(runLogs);
    const run = await this.pipelineRunService.getRun(input.runId);
    const recentCommits = await this.gitService.getRecentCommits(
      run.repositoryId,
      run.branch,
      10
    );

    // 2. AI 分析
    const prompt = ROOT_CAUSE_PROMPT.render({
      errorType: errorClass.type,
      errorSummary: errorClass.summary,
      logSnippets: runLogs.slice(-50).join('\n'),
      recentCommits: recentCommits.map(c =>
        `- ${c.hash.substring(0, 8)} ${c.message} (${c.author})`
      ).join('\n'),
    });

    const content = await this.callAI(prompt, 0.1);
    return JSON.parse(content);
  }
}
```

---

## 七、实施计划

### 7.1 基础设施先行（Week 1）

| 任务 | 产出 | 依赖 |
|------|------|------|
| 扩展 UnifiedConfigService | `aiAgents` 配置段 | 无 |
| 扩展 llm_traces 表 | SQL migration | DBA 审批 |
| 扩展 ScenarioRouter | 9 个 Agent 场景规则 | 无 |
| BaseAgent + AIGatewayAdapter | 可复用基类 | 无 |

### 7.2 P0 Agent（Week 2-3）

| Agent | 预计工时 | 依赖基础设施 |
|-------|---------|------------|
| PipelineYamlAgent | 3 人日 | BaseAgent + PipelineService |
| RootCauseAgent | 4 人日 | BaseAgent + GitService + ErrorClassifier |

### 7.3 P1 Agent（Week 4-5）

| Agent | 预计工时 | 依赖 |
|-------|---------|------|
| AlertClassifyAgent | 2 人日 | BaseAgent + AlertService |
| PerfOptAgent | 3 人日 | BaseAgent + PipelineMetricsService |
| ReleaseDiffAgent | 3 人日 | BaseAgent + ArtifactService + GitService |

### 7.4 P2 Agent（Week 6-7）

| Agent | 预计工时 | 依赖 |
|-------|---------|------|
| AutoFixAgent | 5 人日 | RootCauseAgent + AgentSandbox |
| ReleaseNotesAgent | 2 人日 | ReleaseDiffAgent |
| AlertMergeAgent | 2 人日 | AlertClassifyAgent |
| RAGKnowledgeAgent | 3 人日 | VectorStore + KnowledgeService |
| WeComBotAdapter | 2 人日 | RAGKnowledgeAgent + notification.channels.wechat |

---

## 八、与现有系统的集成对照表

| 组件 | 方案原始设计 | 现有系统 | 修正后设计 |
|------|------------|---------|-----------|
| 配置 | 新建 `config/ai-agents/` 目录 | `UnifiedConfigService.ts` 集中配置 | 在 `UnifiedConfigService` 中新增 `aiAgents` 段 |
| 事件 | 自定义事件名 `pipeline.run.failed` | `PipelineEventType.RunFailed` 已存在 | 复用 `PipelineEventType.RunFailed` |
| 审计 | 新建 `ai_agent_audit_log` 表 | `llm_traces` 表已存在 | 扩展 `llm_traces` 表加 3 个字段 |
| 场景路由 | 新建 `scenario-routing.ts` | `ScenarioRouter.ts` 已存在 | 在现有 `ScenarioRouter.ts` 中扩展规则 |
| 成本控制 | 新环境变量 `AI_AGENT_MAX_COST_PER_DAY` | `CostTracker.ts` 已存在 | 通过 `CostTracker` 设 Agent 配额 |
| 通知渠道 | 新环境变量 `WECOM_BOT_WEBHOOK_URL` | `notification.channels.wechat` | 复用 `notification.channels.wechat` 配置 |
| 路由注册 | `app.ts` 中条件注册 | `routes.ts` 统一注册 | 在 `routes.ts` 中 import + 注册 |
| 环境变量 | `AI_AGENT_` 前缀 | `AI_LLM_` 前缀已存在 | 保持 `AI_AGENT_`（风格一致） |

---

## 九、独立性保障

| 维度 | 保障方式 |
|------|---------|
| 代码隔离 | `ai-agents/` 独立目录 |
| 配置隔离 | `aiAgents` 配置段独立 |
| 路由隔离 | `/api/v1/agents/` 独立前缀 |
| 启动隔离 | `aiAgents.enabled` 总开关 |
| 回滚保障 | 关闭开关 = 原始状态 |
| 业务零修改 | 事件订阅，不改业务代码 |

---

*本文档是 AI Agent 增强六大模块的最终设计方案（修正冲突后）*
