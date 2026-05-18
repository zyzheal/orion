# Agent 服务合并到 orion-ai-svc 设计文档

**日期**: 2026-05-18
**状态**: Draft

---

## 一、合并可行性分析

### 1.1 代码量评估

| 维度 | orion-agent-svc | orion-ai-svc |
|------|----------------|--------------|
| 总代码量 | ~3,800 行（25 文件） | ~14,500 行 |
| 框架 | Fastify | Fastify |
| 数据库 | PostgreSQL 连接池 | PostgreSQL 连接池 |
| 路由数 | 3（agent, task, orchestration） | 8 |
| 外部依赖 | 无 | 无 |

### 1.2 无冲突项

| 检查项 | 结果 |
|--------|------|
| 框架冲突 | ✅ 同为 Fastify |
| 端口冲突 | ✅ agent:3007, ai:3012，合并后统一 |
| 路由冲突 | ✅ agent 用 `/api/v1/agents/*`，ai 用 `/api/v1/ai-*`，无重叠 |
| 数据库 | ✅ 同 PostgreSQL，同连接池模式 |
| 依赖包 | ✅ 均为 fastify + pg + zod + uuid |
| 命名冲突 | ✅ agent-svc 无 `AIGateway`, `PromptGuard` 等类 |

### 1.3 需要迁移的文件

| 源路径 (agent-svc) | 目标路径 (ai-svc) | 类型 |
|-------------------|------------------|------|
| `src/services/MultiAgentOrchestrator.ts` | `src/services/agent/MultiAgentOrchestrator.ts` | 核心逻辑 |
| `src/services/AgentService.ts` | `src/services/agent/AgentService.ts` | 核心逻辑 |
| `src/services/AgentRepository.ts` | `src/repositories/AgentRepository.ts` | 数据层 |
| `src/services/AgentSandbox.ts` | `src/services/agent/AgentSandbox.ts` | 沙箱 |
| `src/services/RunnerManager.ts` | `src/services/agent/RunnerManager.ts` | 运行器 |
| `src/services/TaskExecutor.ts` | `src/services/agent/TaskExecutor.ts` | 任务执行 |
| `src/services/sandbox-worker.ts` | `src/services/agent/sandbox-worker.ts` | 沙箱工作 |
| `src/services/agent-profile-service.ts` | `src/services/agent/AgentProfileService.ts` | Profile 服务 |
| `src/services/agent-run-service.ts` | `src/services/agent/AgentRunService.ts` | Run 服务 |
| `src/services/event-bus-service.ts` | 保留 agent-svc 内部 | 事件总线 |
| `src/models/AgentProfile.ts` | `src/models/AgentProfile.ts` | 数据模型 |
| `src/models/AgentRun.ts` | `src/models/AgentRun.ts` | 数据模型 |
| `src/types/agent.ts` | `src/types/agent.ts` | 类型定义 |
| `src/routes/agent.ts` | `src/routes/agent.ts` | 路由 |
| `src/routes/task.ts` | `src/routes/task.ts` | 路由 |
| `src/routes/orchestration-routes.ts` | `src/routes/orchestration-routes.ts` | 路由 |
| `src/config/` | `src/config/agent.ts` | 配置 |
| `src/middleware/` | 合并到现有 middleware | 中间件 |

---

## 二、合并后的目录结构

```
orion-ai-svc/src/
├── app.ts                          ← 扩展：注册 agent 路由
├── config/
│   ├── index.ts                    ← 扩展：合并 agent 配置
│   └── app.ts
├── middleware/
│   ├── errorHandler.ts             ← 保留现有
│   ├── authMiddleware.ts           ← 保留现有
│   └── cors.ts                     ← 保留现有
├── models/
│   ├── AgentProfile.ts             ← 新增 (从 agent-svc)
│   └── AgentRun.ts                 ← 新增 (从 agent-svc)
├── types/
│   ├── agent.ts                    ← 新增 (从 agent-svc)
│   └── ... (现有类型)
├── routes/
│   ├── agent.ts                    ← 新增 (从 agent-svc)
│   ├── task.ts                     ← 新增 (从 agent-svc)
│   ├── orchestration-routes.ts     ← 新增 (从 agent-svc)
│   ├── ai-gateway.ts               ← 现有
│   ├── ai-routes.ts                ← 现有
│   ├── ai-security.ts              ← 现有
│   ├── ai-decision.ts              ← 现有
│   ├── ai-review.ts                ← 现有
│   ├── degradation.ts              ← 现有
│   ├── llm-trace.ts                ← 现有
│   ├── vector.ts                   ← 现有
│   └── vector-store.ts             ← 现有
├── services/
│   ├── agent/                      ← 新增目录
│   │   ├── MultiAgentOrchestrator.ts  ← 改造：注入 AIGateway
│   │   ├── AgentService.ts
│   │   ├── AgentProfileService.ts
│   │   ├── AgentRunService.ts
│   │   ├── AgentSandbox.ts
│   │   ├── RunnerManager.ts
│   │   ├── TaskExecutor.ts
│   │   └── sandbox-worker.ts
│   ├── AIGateway.ts                ← 现有
│   ├── AIDegradationRouter.ts      ← 现有
│   ├── PromptGuardService.ts       ← 现有 (升级为全局单例)
│   ├── CircuitBreakerManager.ts    ← 现有
│   ├── RuleEngine.ts               ← 现有
│   ├── VectorStore.ts              ← 现有
│   ├── CodeEmbeddingService.ts     ← 现有
│   ├── AIDiagnosisService.ts       ← 现有
│   └── AIGenerateService.ts        ← 现有
└── repositories/
    └── AgentRepository.ts          ← 新增 (从 agent-svc)
```

---

## 三、核心改造：MultiAgentOrchestrator 接入 AIGateway

### 3.1 改造前（模拟实现）

```typescript
// MultiAgentOrchestrator.ts (当前)
private async executeTask(task: AgentTask): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, task.timeout));
  return { taskId: task.id, type: task.type, output: `Result for ${task.prompt.substring(0, 20)}...` };
}
```

### 3.2 改造后（真实 LLM 调用）

```typescript
// MultiAgentOrchestrator.ts (合并后)
export class MultiAgentOrchestrator {
  private aiGateway: AIGateway;
  private toolRegistry: ToolRegistry;
  // ... existing fields ...

  constructor(aiGateway: AIGateway, toolRegistry: ToolRegistry) {
    this.aiGateway = aiGateway;
    this.toolRegistry = toolRegistry;
  }

  private async executeTask(task: AgentTask): Promise<unknown> {
    task.status = 'running';
    task.startedAt = new Date();

    if (task.type === 'execution' && (task as any).tool) {
      // 工具调用
      const toolName = (task as any).tool;
      const tool = this.toolRegistry.get(toolName);
      if (!tool) throw new Error(`Tool not found: ${toolName}`);
      return tool.execute(task.prompt);
    }

    // LLM 推理/生成
    const response = await this.aiGateway.execute<string>({
      scenario: 'agent_reasoning',
      input: {
        prompt: task.prompt,
        systemPrompt: this.buildSystemPrompt(task),
      },
      options: {
        timeout: task.timeout,
        fallbackEnabled: true,
      },
      metadata: {
        userId: 'orchestrator',
        traceId: task.id,
      },
    });

    return response.data;
  }

  private buildSystemPrompt(task: AgentTask): string {
    return `你是一个 ${task.type} 类型的 AI 助手。任务类型：${task.type}。请基于以下提示完成任务。`;
  }
}
```

### 3.3 Tool Registry 定义

```typescript
// services/agent/ToolRegistry.ts
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; required: boolean; description: string }>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  // 注册内置工具
  registerBuiltinTools(): void {
    this.register({
      name: 'prometheus_query',
      description: '查询 Prometheus 指标数据',
      parameters: { query: { type: 'string', required: true, description: 'PromQL 查询语句' } },
      execute: async (params) => { /* 实现 */ },
    });
    this.register({
      name: 'log_query',
      description: '查询日志',
      parameters: { service: { type: 'string', required: true }, limit: { type: 'number', required: false } },
      execute: async (params) => { /* 实现 */ },
    });
    this.register({
      name: 'diagnose',
      description: '运行诊断',
      parameters: { service: { type: 'string', required: true } },
      execute: async (params) => { /* 实现 */ },
    });
    this.register({
      name: 'deploy',
      description: '触发部署',
      parameters: { service: { type: 'string', required: true }, environment: { type: 'string', required: true } },
      execute: async (params) => { /* 实现 */ },
    });
    this.register({
      name: 'vector_search',
      description: '向量语义搜索',
      parameters: { query: { type: 'string', required: true }, topK: { type: 'number', required: false } },
      execute: async (params) => { /* 实现 */ },
    });
  }
}
```

---

## 四、app.ts 合并

### 4.1 合并后的 app.ts

```typescript
// orion-ai-svc/src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { getPool, closePool, checkHealth } from './utils/database';

// 现有路由
import aiGatewayRoutes from './routes/ai-gateway';
import aiDecisionRoutes from './routes/ai-decision';
import aiReviewRoutes from './routes/ai-review';
import aiSecurityRoutes from './routes/ai-security';
import vectorStoreRoutes from './routes/vector-store';
import { vectorRoutes } from './routes/vector';
import llmTraceRoutes from './routes/llm-trace';
import degradationRoutes from './routes/degradation';

// 新增：Agent 路由
import { agentRoutes, agentStore } from './routes/agent';
import { taskRoutes, setAgentStoreRef } from './routes/task';
import { orchestrationRoutes } from './routes/orchestration-routes';

// Wire agent store
setAgentStoreRef(agentStore);

import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  const database = getPool();

  // 现有路由
  await fastify.register(aiGatewayRoutes, { prefix: '/api/v1/ai-gateway', database });
  await fastify.register(aiDecisionRoutes, { prefix: '/api/v1/ai-decision', database });
  await fastify.register(aiReviewRoutes, { prefix: '/api/v1/ai-review', database });
  await fastify.register(aiSecurityRoutes, { prefix: '/api/v1/ai-security', database });
  await fastify.register(vectorStoreRoutes, { prefix: '/api/v1/vector-store', database });
  await fastify.register(vectorRoutes, { prefix: '/api/v1/vector', database });
  await fastify.register(llmTraceRoutes, { prefix: '/api/v1/llm', database });
  await fastify.register(degradationRoutes, { prefix: '/api/v1/degradation', database });

  // 新增：Agent 路由
  await fastify.register(agentRoutes, { prefix: '/api/v1' });
  await fastify.register(taskRoutes, { prefix: '/api/v1' });
  await fastify.register(orchestrationRoutes, { prefix: '/api/v1' });

  fastify.get('/health', async () => {
    const db = await checkHealth();
    return { status: db.status === 'up' ? 'ok' : 'degraded', timestamp: new Date().toISOString() };
  });

  fastify.addHook('onClose', async () => { await closePool(); });
  return { fastify };
}

async function main() {
  const { fastify } = await buildApp();
  const port = parseInt(process.env.PORT || '3012', 10);
  try { await fastify.listen({ port, host: '0.0.0.0' }); fastify.log.info(`AI Service listening on http://0.0.0.0:${port}`); } catch (err) { fastify.log.error(err, 'Failed to start server'); process.exit(1); }
}
if (process.argv[1] === new URL(import.meta.url).pathname) { main(); }
export { buildApp };
```

---

## 五、新增 Scenario 注册

在 AIGateway 中注册新的 `agent_reasoning` 场景：

```typescript
// ai-gateway.ts 扩展
aiGateway.registerScenario('agent_reasoning', {
  description: 'Agent 推理和决策',
  priority: 1,
  defaultProvider: 'anthropic-sonnet',
  fallbackProviders: ['anthropic-opus'],
  degradationStrategy: 'rule-engine',
});
```

---

## 六、数据库迁移

Agent 的表已存在于 `agent_profiles` 和 `agent_runs`，无需新增 migration。
只需确认 ai-svc 的数据库连接池能访问这些表（同一 PostgreSQL 实例）。

---

## 七、环境变量合并

```bash
# orion-ai-svc 现有
AI_LLM_PROVIDER=anthropic
AI_LLM_API_KEY=sk-ant-...
AI_LLM_MODEL=claude-sonnet-4-6-20250514
AI_LLM_BASE_URL=https://api.anthropic.com

# orion-agent-svc 新增配置（可选）
AGENT_SCALING_MAX_RUNNERS=10
AGENT_SCALING_COOLDOWN=60
AGENT_SCALING_EVAL_INTERVAL=30000
```

---

## 八、实施步骤

### Step 1: 创建目录和迁移文件
```bash
mkdir -p orion-ai-svc/src/services/agent
mkdir -p orion-ai-svc/src/repositories
mkdir -p orion-ai-svc/src/models
mkdir -p orion-ai-svc/src/types
```

### Step 2: 复制文件到新位置
| 操作 | 状态 |
|------|------|
| `agent-svc/src/services/MultiAgentOrchestrator.ts` → `ai-svc/src/services/agent/` | 复制 |
| `agent-svc/src/services/AgentService.ts` → `ai-svc/src/services/agent/` | 复制 |
| `agent-svc/src/services/AgentRepository.ts` → `ai-svc/src/repositories/` | 复制 |
| `agent-svc/src/models/*` → `ai-svc/src/models/` | 复制 |
| `agent-svc/src/types/agent.ts` → `ai-svc/src/types/` | 复制 |
| `agent-svc/src/routes/agent.ts` → `ai-svc/src/routes/` | 复制 |
| `agent-svc/src/routes/task.ts` → `ai-svc/src/routes/` | 复制 |
| `agent-svc/src/routes/orchestration-routes.ts` → `ai-svc/src/routes/` | 复制 |
| `agent-svc/src/services/agent-*` → `ai-svc/src/services/agent/` | 复制 |
| `agent-svc/src/services/RunnerManager.ts` → `ai-svc/src/services/agent/` | 复制 |
| `agent-svc/src/services/TaskExecutor.ts` → `ai-svc/src/services/agent/` | 复制 |
| `agent-svc/src/services/AgentSandbox.ts` → `ai-svc/src/services/agent/` | 复制 |
| `agent-svc/src/services/sandbox-worker.ts` → `ai-svc/src/services/agent/` | 复制 |
| `agent-svc/src/config/` → `ai-svc/src/config/agent.ts` | 合并 |

### Step 3: 修改 import 路径
所有 `from '../services/...'` 改为 `from './agent/...'` 等。

### Step 4: 改造 MultiAgentOrchestrator
注入 `AIGateway` 和 `ToolRegistry`，替换 `executeTask()` 的模拟实现。

### Step 5: 创建 ToolRegistry
实现 `ToolRegistry` 类，注册内置工具。

### Step 6: 合并 app.ts
在 `orion-ai-svc/src/app.ts` 中注册 agent 路由。

### Step 7: 验证
- `cd orion-ai-svc && npm run type-check`
- `npm run test`
- `curl http://localhost:3012/api/v1/agents` 确认路由可用

### Step 8: 清理
删除 `orion-agent-svc/` 目录。

---

## 九、风险与回滚

| 风险 | 缓解 |
|------|------|
| import 路径错误 | TypeScript 编译验证 |
| 路由冲突 | 路由前缀隔离（`/api/v1/agents`） |
| 数据库连接池冲突 | 共用同一连接池，无需额外配置 |
| 运行时错误 | agent-svc 保留直到 ai-svc 验证通过 |
| 回滚 | git revert 即可，agent-svc 代码仍在 git 中 |
