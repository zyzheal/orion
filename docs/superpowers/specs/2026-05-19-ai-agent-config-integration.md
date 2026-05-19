# AI Agent 增强 — 配置化与架构集成方案

**日期**: 2026-05-19
**状态**: Draft

---

## 一、设计目标

1. **保持独立性**：AI Agent 模块与现有业务模块解耦，可独立启用/禁用
2. **非侵入式接入**：不修改现有业务代码，通过事件/配置驱动
3. **符合现有架构**：复用 ConfigService (config-mgmt)、AIGateway
4. **渐进式部署**：按开关灰度发布，出问题可快速回滚

---

## 二、架构原则

### 2.1 模块边界

```
┌─────────────────────────────────────────────────────────────────┐
│                   orion-platform-service                         │
│                                                                  │
│  ┌───────────────────────┐    ┌────────────────────────────┐   │
│  │   现有业务模块（不动）  │    │   新增 AI Agent 模块        │   │
│  │                       │    │                            │   │
│  │  PipelineService      │    │  ai-agents/                │   │
│  │  BuildService         │    │  ├── base/                 │   │
│  │  AlertService         │    │  ├── pipeline/             │   │
│  │  DeployService        │    │  ├── stability/            │   │
│  │  ...                  │    │  ├── performance/          │   │
│  └───────────┬───────────┘    │  ├── release/              │   │
│              │                 │  ├── knowledge/            │   │
│              │ 只读接口调用     │  └── monitoring/           │   │
│              ▼                 └────────────┬───────────────┘   │
│  ┌───────────────────────┐                 │                    │
│  │   基础设施层（已有）    │                 │                    │
│  │  AIGateway            │◄────────────────┘                    │
│  │  Tool Adapter (AI→Service)│                                │
│  │  UnifiedConfigService │                                      │
│  │  Database             │                                      │
│  └───────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
```

**核心规则**：
- AI Agent → 现有业务：✅ 允许（通过 ToolAdapter 调用）
- 现有业务 → AI Agent：❌ 禁止（保持业务模块纯净）
- 交互方式：事件驱动，非同步调用

---

## 三、配置体系设计

### 3.1 配置文件结构

```
orion-platform-service/src/config/
├── ConfigService.ts          # 已有 (config-mgmt)
├── ai-agents/                       # 新增：AI Agent 配置目录
│   ├── index.ts                     # 配置入口
│   ├── agent-registry.ts            # Agent 注册配置
│   ├── scenario-routing.ts          # 场景路由配置
│   ├── tool-registry.ts             # 工具注册配置
│   └── prompts/                     # Prompt 模板目录
│       ├── pipeline-yaml.ts
│       ├── root-cause.ts
│       ├── auto-fix.ts
│       ├── perf-opt.ts
│       ├── release-diff.ts
│       ├── release-notes.ts
│       ├── knowledge-qa.ts
│       ├── alert-classify.ts
│       └── alert-merge.ts
```

### 3.2 Agent 注册配置

```typescript
// orion-platform-service/src/config/ai-agents/agent-registry.ts

import { AgentConfig } from '../../services/ai-agents/base/types';

export const AGENT_REGISTRY: Record<string, AgentConfig> = {
  // P0: 流水线 YAML 生成
  'pipeline-yaml': {
    id: 'pipeline-yaml',
    name: 'Pipeline YAML Generator',
    enabled: process.env.AI_AGENT_PIPELINE_YAML_ENABLED === 'true',  // 环境变量控制
    scenario: 'pipeline_yaml_generation',
    provider: 'sonnet',
    maxConcurrency: 5,
    timeoutMs: 30000,
    retry: {
      maxRetries: 2,
      backoffMs: 1000,
    },
    // 依赖的工具
    requiredTools: ['pipeline', 'git'],
    // 权限要求
    requiredPermissions: ['pipeline:create', 'pipeline:write'],
  },

  // P0: 根因分析
  'root-cause': {
    id: 'root-cause',
    name: 'Root Cause Analyzer',
    enabled: process.env.AI_AGENT_ROOT_CAUSE_ENABLED === 'true',
    scenario: 'root_cause_analysis',
    provider: 'opus',
    maxConcurrency: 3,
    timeoutMs: 60000,
    retry: {
      maxRetries: 1,
      backoffMs: 2000,
    },
    requiredTools: ['pipeline', 'git', 'log_query'],
    requiredPermissions: ['pipeline:read', 'code:read'],
  },

  // P1: 告警归类
  'alert-classify': {
    id: 'alert-classify',
    name: 'Alert Classifier',
    enabled: process.env.AI_AGENT_ALERT_CLASSIFY_ENABLED === 'true',
    scenario: 'alert_classification',
    provider: 'haiku',
    maxConcurrency: 20,
    timeoutMs: 10000,
    retry: {
      maxRetries: 2,
      backoffMs: 500,
    },
    requiredTools: ['alert'],
    requiredPermissions: ['alert:read'],
  },

  // ... 其他 Agent 配置
};
```

### 3.3 Agent 基类定义

```typescript
// orion-platform-service/src/services/ai-agents/base/types.ts

export interface AgentConfig {
  id: string;
  name: string;
  enabled: boolean;                    // 是否启用
  scenario: string;                    // AI Gateway 场景标识
  provider: string;                    // 默认 Provider
  maxConcurrency: number;              // 最大并发数
  timeoutMs: number;                   // 超时时间
  retry: {
    maxRetries: number;
    backoffMs: number;
  };
  requiredTools: string[];             // 依赖的工具列表
  requiredPermissions: string[];       // 需要的权限列表
}

export interface AgentExecutionContext {
  traceId: string;                     // 追踪 ID
  userId: string;                      // 用户 ID
  tenantId: string;                    // 租户 ID
  timestamp: string;                   // 执行时间
}

export interface AgentAuditLog {
  agentId: string;
  context: AgentExecutionContext;
  input: any;
  output: any;
  durationMs: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  success: boolean;
  error?: string;
}
```

```typescript
// orion-platform-service/src/services/ai-agents/base/BaseAgent.ts

import { AIGateway } from '../../ai/AIGateway';
import { ToolAdapter } from './ToolAdapter';  // 新增：AI 工具适配器（替代不存在的 ToolAdapter）
import { AgentConfig, AgentExecutionContext, AgentAuditLog } from './types';
import { AuditRepository } from '../../audit/AuditRepository';

/**
 * Agent 抽象基类
 * 
 * 职责：
 * 1. 统一的生命周期管理（启用检查、限流、重试）
 * 2. 统一的 AI Gateway 调用封装
 * 3. 统一的审计日志记录
 * 4. 统一的错误处理
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected aiGateway: AIGateway;
  protected toolAdapter: ToolAdapter;
  protected auditRepo: AuditRepository;

  private concurrentCalls = 0;

  constructor(
    config: AgentConfig,
    aiGateway: AIGateway,
    toolAdapter: ToolAdapter,
    auditRepo: AuditRepository
  ) {
    this.config = config;
    this.aiGateway = aiGateway;
    this.toolAdapter = toolAdapter;
    this.auditRepo = auditRepo;
  }

  /**
   * 检查 Agent 是否可用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 统一的执行入口（包含限流、重试、审计）
   */
  async execute<TInput, TOutput>(
    input: TInput,
    context: AgentExecutionContext
  ): Promise<TOutput> {
    if (!this.isEnabled()) {
      throw new Error(`Agent ${this.config.id} is disabled`);
    }

    // 限流检查
    if (this.concurrentCalls >= this.config.maxConcurrency) {
      throw new Error(`Agent ${this.config.id} concurrency limit reached`);
    }

    this.concurrentCalls++;

    const startTime = Date.now();
    let success = false;
    let output: any;
    let error: string | undefined;
    let tokenUsage = { input: 0, output: 0, total: 0 };

    try {
      // 执行（带重试）
      output = await this.executeWithRetry(input, context);
      success = true;
      return output;
    } catch (e) {
      error = e.message;
      throw e;
    } finally {
      this.concurrentCalls--;

      // 记录审计日志
      const auditLog: AgentAuditLog = {
        agentId: this.config.id,
        context,
        input,
        output,
        durationMs: Date.now() - startTime,
        tokenUsage,
        success,
        error,
      };
      await this.auditRepo.logAgentExecution(auditLog);
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry<TInput, TOutput>(
    input: TInput,
    context: AgentExecutionContext
  ): Promise<TOutput> {
    let lastError: Error | undefined;

    for (let i = 0; i <= this.config.retry.maxRetries; i++) {
      try {
        return await this.doExecute(input, context);
      } catch (e) {
        lastError = e;
        if (i < this.config.retry.maxRetries) {
          await this.sleep(this.config.retry.backoffMs * (i + 1));
        }
      }
    }

    throw lastError || new Error('Unknown error');
  }

  /**
   * 子类实现具体执行逻辑
   */
  protected abstract doExecute<TInput, TOutput>(
    input: TInput,
    context: AgentExecutionContext
  ): Promise<TOutput>;

  /**
   * 统一的 AI Gateway 调用（chat 方法适配）
   */
  protected async callAI(prompt: string, temperature: number = 0.3): Promise<string> {
    // 适配层：将 chat 调用转换为 AIGateway.execute
    const result = await this.aiGateway.execute({
      scenario: this.config.scenario as any,
      provider: this.config.provider,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      timeoutMs: this.config.timeoutMs,
    });

    return result.content as string;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3.4 AIGateway 适配层

```typescript
// orion-platform-service/src/services/ai-agents/base/AIGatewayAdapter.ts

import { AIGateway, AIRequest, AIResponse } from '../../ai/AIGateway';

/**
 * AIGateway 适配层
 * 
 * 为 Agent 提供简化的 chat() 接口，内部转换为 AIGateway.execute()
 */
export class AIGatewayAdapter {
  constructor(private gateway: AIGateway) {}

  /**
   * 简化的 chat调用
   */
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

### 3.5 场景路由配置化

```typescript
// orion-platform-service/src/config/ai-agents/scenario-routing.ts

import { ScenarioRoutingRule } from '../../services/ai/types';

export const SCENARIO_ROUTING_CONFIG: ScenarioRoutingRule[] = [
  {
    scenario: 'pipeline_yaml_generation',
    primaryProvider: 'anthropic',
    primaryModel: 'sonnet-4-6',
    fallbackProvider: 'openai',
    fallbackModel: 'gpt-4o',
    maxTokens: 4000,
    temperature: 0.2,
  },
  {
    scenario: 'root_cause_analysis',
    primaryProvider: 'anthropic',
    primaryModel: 'opus-4-6',
    fallbackProvider: 'anthropic',
    fallbackModel: 'sonnet-4-6',
    maxTokens: 8000,
    temperature: 0.1,
  },
  {
    scenario: 'alert_classification',
    primaryProvider: 'anthropic',
    primaryModel: 'haiku-4-5',
    maxTokens: 1000,
    temperature: 0.1,
  },
  // ... 其他场景配置
];
```

---

## 四、非侵入式接入方式

### 4.1 事件驱动接入（推荐）

现有业务模块不感知 AI Agent，通过事件总线触发：

```typescript
// orion-platform-service/src/events/ai-agent-triggers.ts

import { EventBus } from '../events/EventBus';
import { PipelineYamlAgent } from '../services/ai-agents/pipeline/PipelineYamlAgent';
import { RootCauseAgent } from '../services/ai-agents/stability/RootCauseAgent';
import { AlertClassifyAgent } from '../services/ai-agents/monitoring/AlertClassifyAgent';

/**
 * AI Agent 事件触发器
 * 
 * 监听业务事件，触发对应的 Agent 处理
 * 业务模块无需修改代码
 */
export class AIAgentEventTriggers {
  constructor(
    private eventBus: EventBus,
    private pipelineYamlAgent: PipelineYamlAgent,
    private rootCauseAgent: RootCauseAgent,
    private alertClassifyAgent: AlertClassifyAgent
  ) {}

  /**
   * 注册所有事件触发器
   */
  register(): void {
    // 流水线失败 → 触发根因分析
    this.eventBus.on('pipeline.run.failed', async (event) => {
      if (this.rootCauseAgent.isEnabled()) {
        await this.rootCauseAgent.analyze(event.runId);
      }
    });

    // 告警触发 → 触发告警归类
    this.eventBus.on('alert.triggered', async (event) => {
      if (this.alertClassifyAgent.isEnabled()) {
        await this.alertClassifyAgent.classify(event.alert);
      }
    });
  }
}
```

**现有业务模块无需修改**：

```typescript
// orion-platform-service/src/services/pipeline/PipelineRunService.ts
// 现有代码保持不变

async executePipeline(pipelineId: string): Promise<PipelineRun> {
  // ... 现有执行逻辑 ...

  if (run.status === 'failed') {
    // 只需发布事件，AI Agent 会自动订阅
    this.eventBus.publish('pipeline.run.failed', { runId: run.id });
  }

  return run;
}
```

### 4.2 API 路由接入

新增独立的 API 路由，不影响现有路由：

```typescript
// orion-platform-service/src/api/ai-agent-routes.ts

import { FastifyInstance } from 'fastify';
import { AgentRegistry } from '../services/ai-agents/base/AgentRegistry';

/**
 * AI Agent API 路由
 * 
 * 独立注册，不影响现有业务路由
 */
export async function registerAIAgentRoutes(
  app: FastifyInstance,
  agentRegistry: AgentRegistry
): Promise<void> {
  app.post('/api/v1/agents/:agentId/execute', async (req, reply) => {
    const { agentId } = req.params as { agentId: string };
    const input = req.body as any;

    const agent = agentRegistry.get(agentId);
    if (!agent) {
      return reply.code(404).send({ error: `Agent ${agentId} not found` });
    }

    if (!agent.isEnabled()) {
      return reply.code(503).send({ error: `Agent ${agentId} is disabled` });
    }

    const result = await agent.execute(input, {
      traceId: req.id,
      userId: req.user.id,
      tenantId: req.user.tenantId,
      timestamp: new Date().toISOString(),
    });

    return reply.send(result);
  });

  // 获取 Agent 列表
  app.get('/api/v1/agents', async (req, reply) => {
    const agents = agentRegistry.getAll().map(a => ({
      id: a.config.id,
      name: a.config.name,
      enabled: a.isEnabled(),
      scenario: a.config.scenario,
    }));
    return reply.send({ agents });
  });
}
```

### 4.3 应用启动配置

```typescript
// orion-platform-service/src/app.ts (修改部分)

import { AIAgentInitializer } from './services/ai-agents/base/AIAgentInitializer';

async function createApp(): Promise<FastifyInstance> {
  const app = fastify();

  // ... 现有初始化代码 ...

  // 初始化 AI Agent 模块（可选启用）
  if (process.env.AI_AGENTS_ENABLED === 'true') {
    const aiAgentInitializer = new AIAgentInitializer(
      aiGateway,
      toolAdapter,
      eventBus,
      auditRepository
    );
    await aiAgentInitializer.initialize(app);
  }

  return app;
}
```

```typescript
// orion-platform-service/src/services/ai-agents/base/AIAgentInitializer.ts

import { FastifyInstance } from 'fastify';
import { AIGateway } from '../../ai/AIGateway';
import { ToolAdapter } from './ToolAdapter';
import { EventBus } from '../../../events/EventBus';
import { AuditRepository } from '../../../audit/AuditRepository';
import { AGENT_REGISTRY } from '../../../config/ai-agents/agent-registry';
import { SCENARIO_ROUTING_CONFIG } from '../../../config/ai-agents/scenario-routing';
import { AIAgentEventTriggers } from '../../../events/ai-agent-triggers';

/**
 * AI Agent 初始化器
 * 
 * 负责：
 * 1. 加载 Agent 配置
 * 2. 注册场景路由
 * 3. 初始化 Agent 实例
 * 4. 注册事件触发器
 * 5. 注册 API 路由
 */
export class AIAgentInitializer {
  constructor(
    private aiGateway: AIGateway,
    private toolAdapter: ToolAdapter,
    private eventBus: EventBus,
    private auditRepo: AuditRepository
  ) {}

  async initialize(app: FastifyInstance): Promise<void> {
    // 1. 注册场景路由
    this.registerScenarioRoutes();

    // 2. 初始化 Agent 实例
    const agents = this.initializeAgents();

    // 3. 注册 Agent 注册表
    const agentRegistry = new AgentRegistry(agents);

    // 4. 注册事件触发器
    const eventTriggers = new AIAgentEventTriggers(
      this.eventBus,
      agents.pipelineYamlAgent,
      agents.rootCauseAgent,
      agents.alertClassifyAgent
    );
    eventTriggers.register();

    // 5. 注册 API 路由
    await registerAIAgentRoutes(app, agentRegistry);

    console.log(`AI Agents initialized: ${Object.keys(agents).length} agents`);
  }

  private registerScenarioRoutes(): void {
    // 将配置注册到 ScenarioRouter
    for (const rule of SCENARIO_ROUTING_CONFIG) {
      scenarioRouter.register(rule);
    }
  }

  private initializeAgents() {
    // 根据配置创建 Agent 实例
    const agents: Record<string, any> = {};

    if (AGENT_REGISTRY['pipeline-yaml'].enabled) {
      agents.pipelineYamlAgent = new PipelineYamlAgent(
        this.aiGateway,
        this.toolAdapter.getTool('pipeline'),
        this.toolAdapter.getTool('git')
      );
    }

    if (AGENT_REGISTRY['root-cause'].enabled) {
      agents.rootCauseAgent = new RootCauseAgent(
        this.aiGateway,
        this.toolAdapter.getTool('pipeline'),
        this.toolAdapter.getTool('git'),
        this.toolAdapter.getTool('log_query')
      );
    }

    // ... 其他 Agent 初始化

    return agents;
  }
}
```

---

## 五、环境变量配置

### 5.1 .env 配置项

```bash
# ==================== AI Agent 总开关 ====================
AI_AGENTS_ENABLED=true

# ==================== 单个 Agent 开关 ====================
AI_AGENT_PIPELINE_YAML_ENABLED=true
AI_AGENT_ROOT_CAUSE_ENABLED=true
AI_AGENT_AUTO_FIX_ENABLED=false          # P2, 默认关闭
AI_AGENT_PERF_OPT_ENABLED=true
AI_AGENT_RELEASE_DIFF_ENABLED=true
AI_AGENT_RELEASE_NOTES_ENABLED=true
AI_AGENT_ALERT_CLASSIFY_ENABLED=true
AI_AGENT_ALERT_MERGE_ENABLED=true
AI_AGENT_RAG_KNOWLEDGE_ENABLED=true
AI_AGENT_WECOM_BOT_ENABLED=false          # 需要企微配置

# ==================== LLM 配置 ====================
AI_LLM_ANTHROPIC_API_KEY=sk-xxx
AI_LLM_OPENAI_API_KEY=sk-xxx

# ==================== 成本限制 ====================
AI_AGENT_MAX_TOKENS_PER_DAY=100000
AI_AGENT_MAX_COST_PER_DAY=50              # 每日最大成本（元）

# ==================== 企微机器人 ====================
WECOM_BOT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
WECOM_BOT_SECRET=xxx
```

---

## 六、Prompt 模板管理

```typescript
// orion-platform-service/src/config/ai-agents/prompts/root-cause.ts

export const ROOT_CAUSE_ANALYSIS_PROMPT = `你是一个 DevOps 根因分析专家。请分析以下流水线失败的原因：

错误类型：{{errorType}}
错误摘要：{{errorSummary}}

关键日志片段：
{{logSnippets}}

最近的 Git 提交：
{{recentCommits}}

历史相似 Case：
{{similarCases}}

请输出：
1. 最可能导致此问题的提交（hash + 原因）
2. 具体的根因分析
3. 修复建议
4. 置信度评分（0-1）

以 JSON 格式输出。`;

/**
 * Prompt 渲染函数
 */
export function renderRootCausePrompt(vars: {
  errorType: string;
  errorSummary: string;
  logSnippets: string;
  recentCommits: string;
  similarCases: string;
}): string {
  return ROOT_CAUSE_ANALYSIS_PROMPT
    .replace('{{errorType}}', vars.errorType)
    .replace('{{errorSummary}}', vars.errorSummary)
    .replace('{{logSnippets}}', vars.logSnippets)
    .replace('{{recentCommits}}', vars.recentCommits)
    .replace('{{similarCases}}', vars.similarCases);
}
```

---

## 七、数据库配置（可选）

如需支持运行时动态修改配置，可增加数据库配置表：

```sql
-- AI Agent 配置表
CREATE TABLE ai_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(100) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  provider VARCHAR(50) NOT NULL DEFAULT 'sonnet',
  max_concurrency INTEGER NOT NULL DEFAULT 5,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  max_retries INTEGER NOT NULL DEFAULT 2,
  config_json JSONB,                    -- 其他配置
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agent 执行审计日志
CREATE TABLE ai_agent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(100) NOT NULL,
  trace_id VARCHAR(100),
  user_id UUID,
  tenant_id UUID,
  input_json JSONB,
  output_json JSONB,
  duration_ms INTEGER,
  token_input INTEGER,
  token_output INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_agent_audit_log_agent ON ai_agent_audit_log(agent_id, created_at);
CREATE INDEX idx_ai_agent_audit_log_user ON ai_agent_audit_log(user_id, created_at);
```

---

## 八、独立性保障

### 8.1 模块隔离清单

| 维度 | 保障方式 |
|------|---------|
| **代码隔离** | AI Agent 代码在独立目录 `ai-agents/`，不混入业务代码 |
| **配置隔离** | 环境变量以 `AI_AGENT_` 前缀，不污染其他配置 |
| **路由隔离** | API 路由在 `/api/v1/agents/` 前缀下 |
| **数据库隔离** | 独立配置表 `ai_agent_config`，不与业务表混合 |
| **启动隔离** | 通过 `AI_AGENTS_ENABLED` 环境变量控制是否加载 |
| **依赖隔离** | Agent 通过 ToolAdapter 调用业务，不直接 import 业务模块 |

### 8.2 禁用 Agent 后的系统行为

| Agent | 禁用后影响 | 回退方式 |
|-------|-----------|---------|
| PipelineYamlAgent | 无法用自然语言生成 YAML | 继续使用手动 YAML 编辑 |
| RootCauseAgent | 流水线失败后无自动根因分析 | 继续查看 ErrorClassifier 结果 |
| AutoFixAgent | 无自动修复 | 继续手动修复 |
| AlertClassifyAgent | 告警无 AI 归类 | 继续使用 AlertDeduplication 去重 |
| PerfOptAgent | 无自动性能分析 | 继续查看 PipelineMetricsService 指标 |

**系统核心功能不受影响，只是缺少 AI 增强能力。**

---

## 九、总结

| 特性 | 实现方式 |
|------|---------|
| 非侵入式 | 事件驱动 + 独立 API 路由，业务代码零修改 |
| 可配置 | 环境变量控制每个 Agent 的开关 |
| 可回滚 | 关闭环境变量即可恢复原始状态 |
| 符合架构 | 复用 AIGateway、ToolAdapter、UnifiedConfigService |
| 可审计 | BaseAgent 统一记录执行日志 |
| 可限流 | BaseAgent 内置并发控制 |
| 可重试 | BaseAgent 内置重试机制 |
| Prompt 管理 | 独立模板文件，支持变量替换 |
