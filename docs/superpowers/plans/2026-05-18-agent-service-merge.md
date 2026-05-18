# Phase 1b: Agent 服务合并 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 orion-agent-svc 合并到 orion-ai-svc，包含文件迁移、import 路径修改、MultiAgentOrchestrator 改造、ToolRegistry 创建、app.ts 合并。

**Architecture:** 将 agent-svc 的所有源文件复制到 ai-svc 的 `src/services/agent/`、`src/routes/`、`src/models/`、`src/repositories/`、`src/types/` 目录下，修改 import 路径使其适应新位置。改造 MultiAgentOrchestrator 使其注入 AIGateway 和 ToolRegistry，替换 `executeTask()` 的模拟实现。

**Tech Stack:** TypeScript, Fastify, PostgreSQL, pg

---

## File Structure

| Source (agent-svc) | Target (ai-svc) | Action |
|-------------------|-----------------|--------|
| `src/services/MultiAgentOrchestrator.ts` | `src/services/agent/MultiAgentOrchestrator.ts` | Copy + Modify |
| `src/services/AgentService.ts` | `src/services/agent/AgentService.ts` | Copy |
| `src/services/AgentRepository.ts` | `src/repositories/AgentRepository.ts` | Copy + Modify |
| `src/services/AgentSandbox.ts` | `src/services/agent/AgentSandbox.ts` | Copy |
| `src/services/RunnerManager.ts` | `src/services/agent/RunnerManager.ts` | Copy |
| `src/services/TaskExecutor.ts` | `src/services/agent/TaskExecutor.ts` | Copy |
| `src/services/sandbox-worker.ts` | `src/services/agent/sandbox-worker.ts` | Copy |
| `src/services/agent-profile-service.ts` | `src/services/agent/AgentProfileService.ts` | Copy + Modify |
| `src/services/agent-run-service.ts` | `src/services/agent/AgentRunService.ts` | Copy + Modify |
| `src/models/AgentProfile.ts` | `src/models/AgentProfile.ts` | Copy |
| `src/models/AgentRun.ts` | `src/models/AgentRun.ts` | Copy |
| `src/types/agent.ts` | `src/types/agent.ts` | Copy |
| `src/routes/agent.ts` | `src/routes/agent.ts` | Copy + Modify |
| `src/routes/task.ts` | `src/routes/task.ts` | Copy + Modify |
| `src/routes/orchestration-routes.ts` | `src/routes/orchestration-routes.ts` | Copy + Modify |
| `src/utils/database.ts` | Reuse existing ai-svc database.ts | No copy needed |
| New | `src/services/agent/ToolRegistry.ts` | Create |
| Existing | `src/app.ts` | Modify |

---

### Task 1: 创建目录结构

**Files:**
- Create directories in `orion-ai-svc/src/`

- [ ] **Step 1: 创建目标目录**

Run:
```bash
cd orion-ai-svc/src
mkdir -p services/agent repositories models types
```

- [ ] **Step 2: 确认目标目录已创建**

Run:
```bash
ls -la orion-ai-svc/src/services/agent orion-ai-svc/src/repositories orion-ai-svc/src/models orion-ai-svc/src/types
```
Expected: All directories exist

- [ ] **Step 3: Commit**

```bash
git add orion-ai-svc/src/services/agent orion-ai-svc/src/repositories orion-ai-svc/src/models orion-ai-svc/src/types
git commit -m "chore(ai-svc): create directory structure for agent service merge"
```

---

### Task 2: 复制 Agent 数据模型和类型

**Files:**
- Create: `orion-ai-svc/src/models/AgentProfile.ts`
- Create: `orion-ai-svc/src/models/AgentRun.ts`
- Create: `orion-ai-svc/src/types/agent.ts`

- [ ] **Step 1: 复制 AgentProfile.ts**

从 `orion-agent-svc/src/models/AgentProfile.ts` 复制到 `orion-ai-svc/src/models/AgentProfile.ts`。内容保持原样。

- [ ] **Step 2: 复制 AgentRun.ts**

从 `orion-agent-svc/src/models/AgentRun.ts` 复制到 `orion-ai-svc/src/models/AgentRun.ts`。内容保持原样。

- [ ] **Step 3: 复制 agent.ts 类型**

从 `orion-agent-svc/src/types/agent.ts` 复制到 `orion-ai-svc/src/types/agent.ts`。

同时需要将 `MultiAgentOrchestrator.ts` 中的 `AgentTask`、`OrchestrationPlan`、`OrchestrationResult` 类型也加入此文件（如果它们不在 agent.ts 中）。

- [ ] **Step 4: Commit**

```bash
git add orion-ai-svc/src/models/AgentProfile.ts orion-ai-svc/src/models/AgentRun.ts orion-ai-svc/src/types/agent.ts
git commit -m "feat(ai-svc): copy agent models and types from agent-svc"
```

---

### Task 3: 复制 Agent Repository

**Files:**
- Create: `orion-ai-svc/src/repositories/AgentRepository.ts`

- [ ] **Step 1: 复制 AgentRepository.ts**

从 `orion-agent-svc/src/services/AgentRepository.ts` 复制到 `orion-ai-svc/src/repositories/AgentRepository.ts`。

- [ ] **Step 2: 修改 import 路径**

文件中的 import 路径需要适配新位置：
- `../models/AgentProfile` -> `../models/AgentProfile`
- `../models/AgentRun` -> `../models/AgentRun`
- `../utils/database` -> `../utils/database`

（由于从 `services/` 移到 `repositories/`，相对路径从 `../models` 变为 `../models`，实际上路径不变，因为 models 在上一级）

确认 import 路径正确。

- [ ] **Step 3: Commit**

```bash
git add orion-ai-svc/src/repositories/AgentRepository.ts
git commit -m "feat(ai-svc): copy AgentRepository from agent-svc"
```

---

### Task 4: 复制 Agent Services

**Files:**
- Create: `orion-ai-svc/src/services/agent/AgentService.ts`
- Create: `orion-ai-svc/src/services/agent/AgentProfileService.ts`
- Create: `orion-ai-svc/src/services/agent/AgentRunService.ts`
- Create: `orion-ai-svc/src/services/agent/AgentSandbox.ts`
- Create: `orion-ai-svc/src/services/agent/RunnerManager.ts`
- Create: `orion-ai-svc/src/services/agent/TaskExecutor.ts`
- Create: `orion-ai-svc/src/services/agent/sandbox-worker.ts`

- [ ] **Step 1: 批量复制服务文件**

```bash
cd orion-ai-svc/src/services/agent

# 从 agent-svc 复制所有服务文件
cp ../../../orion-agent-svc/src/services/AgentService.ts .
cp ../../../orion-agent-svc/src/services/agent-profile-service.ts ./AgentProfileService.ts
cp ../../../orion-agent-svc/src/services/agent-run-service.ts ./AgentRunService.ts
cp ../../../orion-agent-svc/src/services/AgentSandbox.ts .
cp ../../../orion-agent-svc/src/services/RunnerManager.ts .
cp ../../../orion-agent-svc/src/services/TaskExecutor.ts .
cp ../../../orion-agent-svc/src/services/sandbox-worker.ts .
```

- [ ] **Step 2: 修改 import 路径**

在所有复制过来的文件中，修改相对路径：
- `../models/` -> `../../models/`
- `../services/` -> `../` (同级)
- `../utils/database` -> `../../utils/database`
- `../types/agent` -> `../../types/agent`

对每个文件执行替换：

```bash
cd orion-ai-svc/src/services/agent
for f in *.ts; do
  sed -i '' "s|../models/|../../models/|g" "$f"
  sed -i '' "s|../utils/database|../../utils/database|g" "$f"
  sed -i '' "s|../types/agent|../../types/agent|g" "$f"
  sed -i '' "s|./agent-profile-service|./AgentProfileService|g" "$f"
  sed -i '' "s|./agent-run-service|./AgentRunService|g" "$f"
done
```

- [ ] **Step 3: Commit**

```bash
git add orion-ai-svc/src/services/agent/
git commit -m "feat(ai-svc): copy agent services from agent-svc with updated imports"
```

---

### Task 5: 创建 ToolRegistry

**Files:**
- Create: `orion-ai-svc/src/services/agent/ToolRegistry.ts`

- [ ] **Step 1: 创建 ToolRegistry.ts**

```typescript
// orion-ai-svc/src/services/agent/ToolRegistry.ts

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description: string;
}

export interface ToolExecutionContext {
  params: Record<string, unknown>;
  userId?: string;
  traceId?: string;
}

export type SandboxLevel = 'none' | 'process' | 'container';

export interface ToolDefinition {
  name: string;
  version: string;
  description: string;
  parameters: ToolParameter[];
  sandbox: SandboxLevel;
  requiresApproval: boolean;
  execute: (ctx: ToolExecutionContext) => Promise<unknown>;
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

  registerBuiltinTools(): void {
    this.register({
      name: 'prometheus_query',
      version: '1.0.0',
      description: '查询 Prometheus 指标数据',
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'PromQL 查询语句' },
        { name: 'range', type: 'string', required: false, description: '时间范围，如 1h, 24h' },
      ],
      sandbox: 'none',
      requiresApproval: false,
      execute: async (ctx) => {
        // TODO: 调用 Prometheus API
        return { data: [], query: ctx.params.query };
      },
    });
    this.register({
      name: 'log_query',
      version: '1.0.0',
      description: '查询日志',
      parameters: [
        { name: 'service', type: 'string', required: true, description: '服务名称' },
        { name: 'limit', type: 'number', required: false, description: '返回条数' },
      ],
      sandbox: 'none',
      requiresApproval: false,
      execute: async (ctx) => {
        // TODO: 调用日志 API
        return { logs: [], service: ctx.params.service };
      },
    });
    this.register({
      name: 'diagnose',
      version: '1.0.0',
      description: '运行诊断',
      parameters: [
        { name: 'service', type: 'string', required: true, description: '服务名称' },
      ],
      sandbox: 'process',
      requiresApproval: false,
      execute: async (ctx) => {
        // TODO: 调用诊断服务
        return { diagnosis: {}, service: ctx.params.service };
      },
    });
    this.register({
      name: 'deploy',
      version: '1.0.0',
      description: '触发部署',
      parameters: [
        { name: 'service', type: 'string', required: true, description: '服务名称' },
        { name: 'environment', type: 'string', required: true, description: '目标环境' },
      ],
      sandbox: 'container',
      requiresApproval: true,
      execute: async (ctx) => {
        // TODO: 调用部署 API
        return { status: 'deployed', service: ctx.params.service };
      },
    });
    this.register({
      name: 'vector_search',
      version: '1.0.0',
      description: '向量语义搜索',
      parameters: [
        { name: 'query', type: 'string', required: true, description: '搜索内容' },
        { name: 'topK', type: 'number', required: false, description: '返回条数' },
      ],
      sandbox: 'none',
      requiresApproval: false,
      execute: async (ctx) => {
        // TODO: 调用 VectorStore
        return { results: [], query: ctx.params.query };
      },
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-ai-svc/src/services/agent/ToolRegistry.ts
git commit -m "feat(ai-svc): add ToolRegistry with 5 builtin tools"
```

---

### Task 6: 改造 MultiAgentOrchestrator

**Files:**
- Create: `orion-ai-svc/src/services/agent/MultiAgentOrchestrator.ts`

- [ ] **Step 1: 复制并重命名**

从 `orion-agent-svc/src/services/MultiAgentOrchestrator.ts` 复制到 `orion-ai-svc/src/services/agent/MultiAgentOrchestrator.ts`。

- [ ] **Step 2: 添加 ExecutionTask 和 Semaphore 类型**

在文件顶部（export class MultiAgentOrchestrator 之前），添加：

```typescript
// 扩展 AgentTask 以支持工具调用
export interface ExecutionTask extends AgentTask {
  tool?: string;
  toolParams?: Record<string, unknown>;
  dependencies?: string[];
}

// 信号量实现
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }
}
```

- [ ] **Step 3: 修改 MultiAgentOrchestrator 类**

替换原有类实现：

```typescript
import { AIGateway } from '../../services/AIGateway';
import { ToolRegistry, ToolDefinition } from './ToolRegistry';

export class MultiAgentOrchestrator {
  private aiGateway: AIGateway;
  private toolRegistry: ToolRegistry;
  private readonly maxConcurrentTools = 10;
  private readonly maxConcurrentLLMCalls = 5;
  private toolSemaphore: Semaphore;
  private llmSemaphore: Semaphore;
  private plans: Map<string, OrchestrationPlan> = new Map();
  private runningTasks: Map<string, ExecutionTask> = new Map();

  constructor(aiGateway: AIGateway, toolRegistry: ToolRegistry) {
    this.aiGateway = aiGateway;
    this.toolRegistry = toolRegistry;
    this.toolSemaphore = new Semaphore(this.maxConcurrentTools);
    this.llmSemaphore = new Semaphore(this.maxConcurrentLLMCalls);
  }

  /**
   * 执行单个任务（工具调用或 LLM 推理）
   */
  private async executeTask(task: ExecutionTask): Promise<unknown> {
    task.status = 'running';
    task.startedAt = new Date();

    // 工具调用
    if (task.type === 'execution' && task.tool) {
      await this.toolSemaphore.acquire();
      try {
        const tool = this.toolRegistry.get(task.tool);
        if (!tool) throw new Error(`Tool not found: ${task.tool}`);
        return tool.execute({ params: task.toolParams || {}, traceId: task.id });
      } finally {
        this.toolSemaphore.release();
      }
    }

    // LLM 推理
    await this.llmSemaphore.acquire();
    try {
      const response = await this.aiGateway.execute({
        scenario: 'agent_reasoning' as any, // 需要扩展 AIScenario 类型
        input: {
          prompt: task.prompt,
          systemPrompt: this.buildSystemPrompt(task),
        },
        options: {
          timeout: task.timeout,
          fallbackEnabled: true,
        },
        context: {
          userId: 'orchestrator',
          traceId: task.id,
        },
      });
      return response.data;
    } finally {
      this.llmSemaphore.release();
    }
  }

  private buildSystemPrompt(task: ExecutionTask): string {
    const availableTools = this.toolRegistry.list().map(t => `- ${t.name}: ${t.description}`).join('\n');
    return `你是一个 ${task.type} 类型的 AI 助手。
任务类型：${task.type}。
可用工具：
${availableTools}

输出要求：使用 JSON 格式返回结果，包含 conclusion 和 reasoning 字段。
请基于以下提示完成任务：`;
  }

  /**
   * 执行完整计划：解析任务依赖，并行执行无依赖任务
   */
  async executePlan(planId: string): Promise<{ success: boolean; planId: string; results: Map<string, unknown>; errors: Map<string, string>; duration: number }> {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error('Plan not found');

    plan.status = 'executing';
    const startTime = Date.now();
    const results = new Map<string, unknown>();
    const errors = new Map<string, string>();

    // 使用 hybrid 模式（支持依赖关系的并行执行）
    await this.executeHybrid(plan as any, results, errors);

    const duration = Date.now() - startTime;
    plan.status = errors.size > 0 ? 'failed' : 'completed';
    plan.completedAt = new Date();

    return { success: errors.size === 0, planId, results, errors, duration };
  }

  // ... 保留原有的 createPlan, getPlan, listPlans, abortPlan, getRunningTasks, getTaskQueue 方法
  // 但需要修改 executeParallel, executeSequential, executeHybrid, buildTaskLevels 以使用新的 executeTask
  // 修改 AgentTask[] 为 ExecutionTask[]
}
```

- [ ] **Step 4: 保留原有方法**

保留以下方法不变：
- `createPlan`
- `getPlan`
- `listPlans`
- `abortPlan`
- `getRunningTasks`
- `getTaskQueue`
- `buildTaskLevels`（修改类型为 `ExecutionTask[]`）
- `executeParallel`（调用新的 `executeTask`）
- `executeSequential`（调用新的 `executeTask`）
- `executeHybrid`（调用新的 `executeTask`）

- [ ] **Step 5: 修改 import 路径**

```typescript
import { AgentTask, OrchestrationPlan, OrchestrationResult } from '../../types/agent';
import { AIGateway } from '../../services/AIGateway';
import { ToolRegistry } from './ToolRegistry';
```

- [ ] **Step 6: Commit**

```bash
git add orion-ai-svc/src/services/agent/MultiAgentOrchestrator.ts
git commit -m "feat(ai-svc): rewrite MultiAgentOrchestrator with AIGateway injection and ToolRegistry"
```

---

### Task 7: 复制并修改 Agent Routes

**Files:**
- Create: `orion-ai-svc/src/routes/agent.ts`
- Create: `orion-ai-svc/src/routes/task.ts`
- Create: `orion-ai-svc/src/routes/orchestration-routes.ts`

- [ ] **Step 1: 复制路由文件**

```bash
cp orion-agent-svc/src/routes/agent.ts orion-ai-svc/src/routes/agent.ts
cp orion-agent-svc/src/routes/task.ts orion-ai-svc/src/routes/task.ts
cp orion-agent-svc/src/routes/orchestration-routes.ts orion-ai-svc/src/routes/orchestration-routes.ts
```

- [ ] **Step 2: 修改 import 路径**

在所有路由文件中：
- `../services/AgentService` -> `../services/agent/AgentService`
- `../services/MultiAgentOrchestrator` -> `../services/agent/MultiAgentOrchestrator`
- `../services/AgentRepository` -> `../repositories/AgentRepository`
- `../utils/database` -> `../utils/database`

- [ ] **Step 3: 修改路由前缀**

确保路由使用 `/api/v1/agents` 前缀（通过 app.ts 的 Fastify register prefix 控制，路由文件内部使用相对路径）。

- [ ] **Step 4: Commit**

```bash
git add orion-ai-svc/src/routes/agent.ts orion-ai-svc/src/routes/task.ts orion-ai-svc/src/routes/orchestration-routes.ts
git commit -m "feat(ai-svc): copy agent routes with updated imports"
```

---

### Task 8: 合并 app.ts

**Files:**
- Modify: `orion-ai-svc/src/app.ts`

- [ ] **Step 1: 修改 app.ts**

将现有 app.ts 替换为以下内容：

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
import { agentRoutes } from './routes/agent';
import { taskRoutes } from './routes/task';
import { orchestrationRoutes } from './routes/orchestration-routes';

import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] });
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
  await fastify.register(agentRoutes, { prefix: '/api/v1', database });
  await fastify.register(taskRoutes, { prefix: '/api/v1', database });
  await fastify.register(orchestrationRoutes, { prefix: '/api/v1', database });

  fastify.get('/health', async () => {
    const db = await checkHealth();
    return { status: db.status === 'up' ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks: { database: db } };
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

- [ ] **Step 2: Commit**

```bash
git add orion-ai-svc/src/app.ts
git commit -m "feat(ai-svc): merge agent routes into app.ts"
```

---

### Task 9: 添加 agent_reasoning 场景注册

**Files:**
- Modify: `orion-ai-svc/src/services/AIGateway.ts` 或相关场景配置文件

- [ ] **Step 1: 在 AIGateway 中注册新场景**

在 ai-svc 启动代码中（或 AIGateway 初始化处），添加：

```typescript
// 注册 agent_reasoning 场景
aiGateway.registerScenario('agent_reasoning', {
  description: 'Agent 推理和决策',
  priority: 1,
  defaultProvider: 'anthropic-sonnet',
  fallbackProviders: ['anthropic-opus'],
  degradationStrategy: 'rule-engine',
});
```

如果 AIGateway 没有 `registerScenario` 方法，则在 `types.ts` 的 `AIScenario` 类型中添加：

```typescript
export type AIScenario = AIScenarioP0 | AIScenarioP1 | 'agent_reasoning' | 'chatops_intent';
```

- [ ] **Step 2: Commit**

```bash
git add orion-ai-svc/src/services/types.ts
git commit -m "feat(ai-svc): add agent_reasoning and chatops_intent scenarios to AIScenario type"
```

---

### Task 10: 更新 ai-svc package.json 依赖

**Files:**
- Modify: `orion-ai-svc/package.json`

- [ ] **Step 1: 添加 agent-svc 的依赖**

在 `orion-ai-svc/package.json` 的 `dependencies` 中添加：

```json
{
  "dependencies": {
    "fastify": "^5.2.1",
    "@fastify/cors": "^10.0.0",
    "@fastify/sensible": "^6.0.0",
    "pg": "^8.13.0",
    "ioredis": "^5.4.0",
    "nats": "^2.28.0",
    "uuid": "^11.0.3",
    "zod": "^3.23.8"
  }
}
```

添加 `uuid` 和 `zod`（agent-svc 使用的依赖）。

- [ ] **Step 2: 安装依赖**

Run: `cd orion-ai-svc && npm install`
Expected: Dependencies installed successfully

- [ ] **Step 3: Commit**

```bash
git add orion-ai-svc/package.json orion-ai-svc/package-lock.json
git commit -m "chore(ai-svc): add uuid and zod dependencies from agent-svc merge"
```

---

### Task 11: 验证编译和运行

**Files:**
- Test: Full ai-svc build

- [ ] **Step 1: 运行 TypeScript 类型检查**

Run: `cd orion-ai-svc && npx tsc --noEmit`
Expected: PASS (fix any import errors that arise)

- [ ] **Step 2: 启动 ai-svc 验证**

Run: `cd orion-ai-svc && npm run dev`
Expected: Server starts on port 3012

- [ ] **Step 3: 验证 Agent API 可用**

Run: `curl http://localhost:3012/api/v1/agents`
Expected: Returns JSON array (possibly empty) or 200 OK

- [ ] **Step 4: Commit**

No code changes if all passes. If fixes were needed:

```bash
git add orion-ai-svc/src/
git commit -m "fix(ai-svc): fix import errors from agent service merge"
```

---

## Self-Review

### 1. Spec Coverage Check

| Spec Section | Task |
|-------------|------|
| 4.1 合并后的目录结构 | Tasks 1-7 |
| 4.2 MultiAgentOrchestrator 改造 | Task 6 |
| 4.3 Tool Registry 接口契约 | Task 5 |
| 4.4 app.ts 合并 | Task 8 |
| 4.5 新增 Scenario 注册 | Task 9 |
| 4.6 数据库迁移 | 跳过（同一 PostgreSQL 实例，表已存在） |
| 4.7 环境变量合并 | package.json (Task 10) |

### 2. Placeholder Scan

Task 5 (ToolRegistry) has `// TODO` comments in tool execute functions - these are intentional placeholders for Phase 3 implementation when actual tool logic is wired.

### 3. Type Consistency

- `ExecutionTask` extends `AgentTask` (defined in types/agent.ts)
- `AIResponse` uses existing type from `services/types.ts` (note: spec added `usage` field for cost tracking - the current AIGateway AIResponse doesn't have `usage` field, so this will need to be added in Phase 2)
- `AIScenario` type extended with `'agent_reasoning'` and `'chatops_intent'`

### 4. Scope Check

This plan covers **only Phase 1b: Agent Service Merge**. It does NOT include:
- Database migration scripts (tables already exist, same PostgreSQL instance)
- AI Gateway Provider Registry / Scenario Router (Phase 2)
- Cost Tracker integration (Phase 2)
- ChatOps LLM integration (Phase 3)
- Deleting orion-agent-svc directory (done after verification in a separate commit)
