# AI 能力平台重新设计文档

**日期**: 2026-05-18
**状态**: Draft
**作者**: AI Product Expert + AI Architect + UI/UX Designer

---

## 一、背景与问题

### 1.1 现状

当前 AI 能力菜单包含 7 个模块，分布在 `menuConfigStore.ts` 的 `/ai` 分类下：

| 模块 | 路由 | 当前实现 | 完整度 |
|------|------|---------|--------|
| AI 网关 | `/ai-gateway` | 单页面：健康表格 + 网关状态 | 25% |
| Agent 调度 | `/agents` | Agent 列表/详情/运行 | 40% |
| AI Review | `/console/ai-review/*` | 4 子页面：Dashboard/History/Rules/Config | 55% |
| AI 文档 | `/console/ai-docs/*` | 5 子页面：Spaces/Documents/Editor/RAG/Graph | 70% |
| ChatOps | `/console/chatops/*` | 5 子页面：Settings/Recommend/Commands/Executions/Audit | 60% |
| AI 知识库 | `/knowledge` | 占位页面 | 10% |
| AI 安全 | `/ai-security` | 策略 CRUD + 评估 | 35% |

### 1.2 核心问题

**架构层面：**
1. **两套独立 LLM 调用路径** — AI Review 直连 LLMClient（`LLM_*` 环境变量），绕过 AI Gateway（`AI_LLM_*` 环境变量）
2. **PromptGuard 重复实例** — AIGateway 和 ai-security 各有一份 PromptInjectionDetector + PromptSanitizer
3. **Agent Orchestrator 是模拟实现** — `executeTask()` 只有 `setTimeout`，无真实 LLM 调用
4. **VectorStore 孤立** — 无模块主动调用向量搜索
5. **orion-agent-svc 独立部署** — 3,800 行代码独立服务，与 orion-ai-svc 功能高度耦合

**产品层面：**
1. **分类维度混乱** — "基础设施"与"研发辅助"并列，但它们是不同层级
2. **AI Gateway 只有监控无管理** — 缺少 Provider 管理、场景路由配置、LLM Trace
3. **ChatOps 无 LLM 接入** — 纯规则命令路由，无自然语言理解
4. **AI 知识库完全占位**
5. **缺少成本治理模块** — LLM 调用成本无监控和优化

**权限层面：**
1. **RBAC 未与 AI 模块打通** — AI 相关 route 无 `roleGuard` 或权限中间件
2. **AI 权限只有 2 个粗粒度** — `ai:use` / `ai:manage`，无法细分
3. **前端无权限控制** — 路由、菜单、按钮均无权限判断
4. **JWT 携带角色数组，但 UserInfo.role 是单字符串** — 前后端不一致

**UI/UX 层面：**
1. **信息架构过重** — 一级分类太多（7 个），用户认知负担大
2. **缺少 Dashboard 优先** — 无全局 AI 健康总览页
3. **空状态未定义** — 知识库、新模块无引导

---

## 二、目标架构

### 2.1 统一 AI Gateway 为唯一 LLM 出口

```
┌──────────────────────────────────────────────────────────────────────┐
│                    orion-ai-svc (统一 AI 服务)                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      AI Gateway (核心)                        │   │
│  │                                                               │   │
│  │  Provider Registry (多 Provider 管理)                         │   │
│  │  ┌──────────────┬──────────────┬──────────────────┐          │   │
│  │  │ anthropic    │ openai       │ nvidia-nim       │          │   │
│  │  │ - sonnet-4-6 │ - gpt-4o     │ - llama-3.1-70b  │          │   │
│  │  │ - haiku-4-5  │ - gpt-4o-mini│                  │          │   │
│  │  │ - opus-4-6   │              │                  │          │   │
│  │  └──────┬───────┴──────┬───────┴────────┬─────────┘          │   │
│  │         │              │                │                     │   │
│  │  ┌──────▼──────────────▼────────────────▼──────────┐         │   │
│  │  │            Scenario Router (场景路由)            │         │   │
│  │  │  chatops_intent  → haiku       (快速+便宜)       │         │   │
│  │  │  code-review     → sonnet      (代码能力强)      │         │   │
│  │  │  root-cause      → opus        (强推理)          │         │   │
│  │  │  [支持主备 Provider 链]                           │         │   │
│  │  └────────────┬─────────────────────────────┬──────┘         │   │
│  │               │                             │                │   │
│  │  ┌────────────▼──────────┐ ┌────────────────▼───────┐        │   │
│  │  │ PromptGuardService    │ │ CircuitBreakerManager  │        │   │
│  │  │ (全局单例)            │ │ (Provider+Scenario)    │        │   │
│  │  └───────────────────────┘ └────────────────────────┘        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                MultiAgentOrchestrator                         │   │
│  │  (从 orion-agent-svc 合并至此，直接调用 AIGateway)            │   │
│  └────────────────────┬─────────────────────────────────────────┘   │
│                       │                                              │
│  ┌────────────────────▼─────────────────────────────────────────┐   │
│  │                  Tool Registry (工具注册中心)                  │   │
│  │  deploy │ monitoring │ pipeline │ vector_search │ log_query  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                Cost Tracker (成本追踪)                        │   │
│  │  Token 计量 │ Provider 成本 │ 场景成本 │ 预算告警            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 ChatOps 方案 C 完整流程

```
用户: "帮我排查下 api 服务为什么延迟很高"
         │
         ▼
① 意图识别: POST /api/ai-gateway/execute
   scenario: 'chatops_intent'
   → { intent: "diagnose_latency", target: "api", confidence: 0.95 }
         │
         ▼
② Agent 编排: POST /api/agents/orchestration/plans
   tasks: [
     { tool: "prometheus_query", ... },     // 并行
     { tool: "log_query", ... },            // 并行
     { tool: "diagnose", dependencies: [...] }  // 依赖前两步
   ]
         │
         ▼
③ MultiAgentOrchestrator.executePlan() (内部直接调用)
   ├── Task 1 → ToolRegistry.invoke("prometheus_query")
   ├── Task 2 → ToolRegistry.invoke("log_query")
   └── Task 3 → aiGateway.execute("分析数据...")
         │
         ▼
④ SSE 流式返回前端 (实时显示诊断进度)
```

### 2.3 Agent 服务合并架构

orion-agent-svc（3,800 行，Fastify）合并到 orion-ai-svc（14,500 行，Fastify）：

| 维度 | orion-agent-svc | orion-ai-svc | 合并后 |
|------|----------------|--------------|--------|
| 总代码量 | ~3,800 行（25 文件） | ~14,500 行 | ~18,300 行 |
| 框架 | Fastify | Fastify | Fastify（无冲突） |
| 数据库 | PostgreSQL 连接池 | PostgreSQL 连接池 | 共用连接池 |
| 路由数 | 3（agent, task, orchestration） | 8 | 11 |
| 端口 | 3007 | 3012 | 3012（统一） |
| 外部依赖 | 无 | 无 | 无 |

**合并可行性：**
- 框架相同（Fastify），无兼容问题
- 路由无重叠（agent: `/api/v1/agents/*`，ai: `/api/v1/ai-*`）
- 同 PostgreSQL，同连接池模式
- 无命名冲突（agent-svc 无 `AIGateway`, `PromptGuard` 等类）
- 回滚成本低：git revert 即可，agent-svc 代码仍在 git 中

---

## 三、新菜单设计

### 3.1 菜单结构（场景化分类）

采用**场景优先**的分类方式，替换原来的技术分类：

```
AI 能力平台
│
├── 📊 AI 总览            ← 新增：全局健康/成本/使用量 Dashboard
│
├── 🤖 智能助手            ← 用户日常高频入口
│   ├── ChatOps 对话工作台  ← 主交互界面（方案 C）
│   ├── AI 文档            ← 现有迁移
│   └── 知识库             ← 从占位升级为完整功能
│
├── 🔍 代码智能            ← 开发者日常工具
│   ├── AI Review          ← 现有迁移
│
├── 🛡️ 安全与治理           ← 安全/合规视角
│   ├── AI 安全策略         ← 扩展现有
│   ├── 威胁监控            ← 新增
│   └── 合规报告            ← 新增
│
├── ⚙️ 平台配置             ← 管理员/架构师专属
│   ├── Provider 管理       ← 新增
│   ├── AI Gateway 监控     ← 扩展现有（从代码智能移入）
│   ├── 场景路由配置        ← 新增
│   ├── Agent 管理          ← 现有迁移
│   ├── 编排策略            ← 新增
│   ├── 工具注册表          ← 新增
│   ├── LLM Trace           ← 新增
│   └── 成本分析            ← 新增
```

### 3.2 路由映射

| 新菜单项 | 新路由 | 来源 | 权限 |
|---------|--------|------|------|
| AI 总览 | `/ai/dashboard` | 新增 | `ai:*` |
| ChatOps 对话工作台 | `/ai/chatops` | 从 `/console/chatops` 迁移 | `chatops:use` |
| AI 文档 | `/ai/docs/*` | 从 `/console/ai-docs/*` 迁移 | `ai:doc:read` |
| 知识库 | `/ai/knowledge` | 从 `/knowledge` 迁移 | `knowledge:read` |
| AI Review | `/ai/review/*` | 从 `/console/ai-review/*` 迁移 | `ai:review:read` |
| AI Gateway 监控 | `/ai/gateway` | 从 `/ai-gateway` 迁移 | `ai:gateway:read` |
| AI 安全策略 | `/ai/security` | 从 `/ai-security` 迁移 | `ai:security:read` |
| 威胁监控 | `/ai/security/threats` | 新增 | `ai:security:read` |
| 合规报告 | `/ai/security/compliance` | 新增 | `ai:security:read` |
| Provider 管理 | `/ai/provider` | 新增 | `ai:provider:read` |
| 场景路由配置 | `/ai/scenario-router` | 新增 | `ai:scenario:read` |
| Agent 管理 | `/ai/agents` | 从 `/agents` 迁移 | `ai:agent:read` |
| 编排策略 | `/ai/orchestration` | 新增 | `ai:orchestration:read` |
| 工具注册表 | `/ai/tools` | 新增 | `ai:tool:read` |
| LLM Trace | `/ai/trace` | 新增 | `ai:trace:read` |
| 成本分析 | `/ai/cost` | 新增 | `ai:cost:read` |

### 3.3 菜单 Store 更新

```typescript
// stores/menuConfigStore.ts — /ai 分类更新
'/ai': {
  key: '/ai',
  label: 'AI 能力',
  description: '智能化平台',
  systemTitle: 'AI 能力',
  systemDescription: 'AI 驱动的研发效能提升，包含智能助手、代码智能、安全治理与平台配置',
  enabled: true,
  children: [
    { key: '/ai/dashboard', label: 'AI 总览', description: '全局健康与成本看板', category: '全局', enabled: true },
    { key: '/ai/chatops', label: 'ChatOps', description: '对话式运维助手', category: '智能助手', enabled: true },
    { key: '/ai/docs', label: 'AI 文档', description: '智能文档协作', category: '智能助手', enabled: true },
    { key: '/ai/knowledge', label: '知识库', description: '企业知识管理', category: '智能助手', enabled: true },
    { key: '/ai/review', label: 'AI Review', description: '智能代码评审', category: '代码智能', enabled: true },
    { key: '/ai/security', label: '安全治理', description: 'AI 安全策略与合规', category: '安全治理', enabled: true },
    { key: '/ai/provider', label: 'Provider 管理', description: 'LLM Provider 注册', category: '平台配置', enabled: true },
    { key: '/ai/gateway', label: 'AI Gateway', description: '模型路由与监控', category: '平台配置', enabled: true },
    { key: '/ai/agents', label: 'Agent 管理', description: '智能体配置', category: '平台配置', enabled: true },
    { key: '/ai/orchestration', label: '编排策略', description: '多 Agent 编排', category: '平台配置', enabled: true },
    { key: '/ai/tools', label: '工具注册表', description: '工具定义', category: '平台配置', enabled: true },
    { key: '/ai/trace', label: 'LLM Trace', description: '调用追踪', category: '平台配置', enabled: true },
    { key: '/ai/cost', label: '成本分析', description: 'Token 与成本', category: '平台配置', enabled: true },
  ],
},
```

---

## 四、Agent 服务合并设计

### 4.1 合并后的目录结构

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
│   └── ... (其他现有路由)
├── services/
│   ├── agent/                      ← 新增目录
│   │   ├── MultiAgentOrchestrator.ts  ← 改造：注入 AIGateway
│   │   ├── AgentService.ts
│   │   ├── AgentProfileService.ts
│   │   ├── AgentRunService.ts
│   │   ├── AgentSandbox.ts
│   │   ├── RunnerManager.ts
│   │   ├── TaskExecutor.ts
│   │   ├── ToolRegistry.ts         ← 新增：工具注册中心
│   │   └── sandbox-worker.ts
│   ├── AIGateway.ts                ← 现有
│   ├── AIDegradationRouter.ts      ← 现有
│   ├── PromptGuardService.ts       ← 现有 (升级为全局单例)
│   ├── CircuitBreakerManager.ts    ← 现有
│   └── ... (其他现有服务)
└── repositories/
    ├── AgentProfileRepository.ts   ← 新增 (从 agent-svc)
    └── AgentRunRepository.ts       ← 新增 (从 agent-svc)
```

### 4.2 MultiAgentOrchestrator 改造

**改造前（模拟实现）：**
```typescript
// MultiAgentOrchestrator.ts (当前)
private async executeTask(task: AgentTask): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, task.timeout));
  return { taskId: task.id, type: task.type, output: `Result for ${task.prompt.substring(0, 20)}...` };
}
```

**改造后（真实 LLM 调用）：**
```typescript
// MultiAgentOrchestrator.ts (合并后)
export interface ExecutionTask extends AgentTask {
  tool?: string;
  toolParams?: Record<string, unknown>;
}

export class MultiAgentOrchestrator {
  private aiGateway: AIGateway;
  private toolRegistry: ToolRegistry;

  constructor(aiGateway: AIGateway, toolRegistry: ToolRegistry) {
    this.aiGateway = aiGateway;
    this.toolRegistry = toolRegistry;
  }

  private async executeTask(task: ExecutionTask): Promise<unknown> {
    task.status = 'running';
    task.startedAt = new Date();

    if (task.type === 'execution' && task.tool) {
      const tool = this.toolRegistry.get(task.tool);
      if (!tool) throw new Error(`Tool not found: ${task.tool}`);
      return tool.execute(task.toolParams || {});
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

  private buildSystemPrompt(task: ExecutionTask): string {
    const availableTools = this.toolRegistry.list().map(t => `- ${t.name}: ${t.description}`).join('\n');
    return `你是一个 ${task.type} 类型的 AI 助手。
任务类型：${task.type}。
可用工具：
${availableTools}

输出要求：使用 JSON 格式返回结果，包含 conclusion 和 reasoning 字段。
请基于以下提示完成任务：`;
  }
}
```

### 4.3 Tool Registry 接口契约

```typescript
// services/agent/ToolRegistry.ts
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

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
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
      description: '查询 Prometheus 指标数据',
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'PromQL 查询语句' },
        { name: 'range', type: 'string', required: false, description: '时间范围，如 1h, 24h' },
      ],
      execute: async (ctx) => { /* 调用 Prometheus API */ },
    });
    this.register({
      name: 'log_query',
      description: '查询日志',
      parameters: [
        { name: 'service', type: 'string', required: true, description: '服务名称' },
        { name: 'limit', type: 'number', required: false, description: '返回条数' },
      ],
      execute: async (ctx) => { /* 调用日志 API */ },
    });
    this.register({
      name: 'diagnose',
      description: '运行诊断',
      parameters: [
        { name: 'service', type: 'string', required: true, description: '服务名称' },
      ],
      execute: async (ctx) => { /* 调用诊断服务 */ },
    });
    this.register({
      name: 'deploy',
      description: '触发部署',
      parameters: [
        { name: 'service', type: 'string', required: true, description: '服务名称' },
        { name: 'environment', type: 'string', required: true, description: '目标环境' },
      ],
      execute: async (ctx) => { /* 调用部署 API */ },
    });
    this.register({
      name: 'vector_search',
      description: '向量语义搜索',
      parameters: [
        { name: 'query', type: 'string', required: true, description: '搜索内容' },
        { name: 'topK', type: 'number', required: false, description: '返回条数' },
      ],
      execute: async (ctx) => { /* 调用 VectorStore */ },
    });
  }
}
```

### 4.4 app.ts 合并

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
import { agentRoutes, createAgentService } from './routes/agent';
import { taskRoutes } from './routes/task';
import { orchestrationRoutes } from './routes/orchestration-routes';

import { errorHandler } from './middleware/errorHandler';

async function buildApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });
  await fastify.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'] });
  await fastify.register(sensible);
  errorHandler(fastify);

  const database = getPool();

  // 依赖注入：创建 Agent 服务实例并注入到路由
  const agentService = createAgentService(database);

  // 现有路由
  await fastify.register(aiGatewayRoutes, { prefix: '/api/v1/ai-gateway', database });
  await fastify.register(aiDecisionRoutes, { prefix: '/api/v1/ai-decision', database });
  await fastify.register(aiReviewRoutes, { prefix: '/api/v1/ai-review', database });
  await fastify.register(aiSecurityRoutes, { prefix: '/api/v1/ai-security', database });
  await fastify.register(vectorStoreRoutes, { prefix: '/api/v1/vector-store', database });
  await fastify.register(vectorRoutes, { prefix: '/api/v1/vector', database });
  await fastify.register(llmTraceRoutes, { prefix: '/api/v1/llm', database });
  await fastify.register(degradationRoutes, { prefix: '/api/v1/degradation', database });

  // 新增：Agent 路由（依赖注入）
  await fastify.register(agentRoutes, { prefix: '/api/v1', agentService });
  await fastify.register(taskRoutes, { prefix: '/api/v1', agentService });
  await fastify.register(orchestrationRoutes, { prefix: '/api/v1', agentService });

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

### 4.5 新增 Scenario 注册

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

### 4.6 数据库迁移

**验证结果：**
- agent-svc 连接 `DB_NAME=orion_agent`（独立数据库）
- ai-svc 连接 `DATABASE_URL=postgresql://orion:orion123@localhost:5432/ai_db`（同一实例，不同数据库）
- 两个服务在同一 PostgreSQL 实例但不同数据库

**迁移方案：**
合并后统一使用 ai-svc 的数据库连接（`ai_db`），需要将 agent-svc 的表迁移到 ai_db：

```sql
-- 在 ai_db 中创建 agent 表（若不存在）
CREATE TABLE IF NOT EXISTS agent_profiles (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_prompt TEXT,
  tools JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agent_profiles(id),
  status VARCHAR(20) DEFAULT 'pending',
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**数据迁移步骤：**
1. 从 `orion_agent` 导出 `agent_profiles` 和 `agent_runs` 表数据
2. 导入到 `ai_db`
3. 合并后 agent 的 Repository 使用 `getPool()`（ai-svc 的连接池）即可访问
4. 验证通过后，agent-svc 独立数据库可安全删除

### 4.7 环境变量合并

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

### 4.8 Cost Tracker 接口定义

```typescript
// services/agent/CostTracker.ts
export interface CostRecord {
  id: string;
  scenario: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  userId: string;
  timestamp: Date;
}

export interface CostSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
  costByScenario: Record<string, number>;
  costByProvider: Record<string, number>;
}

export class CostTracker {
  private pool: Pool;
  private pricing: Map<string, { inputPer1k: number; outputPer1k: number }>;

  constructor(pool: Pool) {
    this.pool = pool;
    this.pricing = new Map();
    this.registerPricing();
  }

  private registerPricing(): void {
    this.pricing.set('anthropic-sonnet', { inputPer1k: 0.003, outputPer1k: 0.015 });
    this.pricing.set('anthropic-opus', { inputPer1k: 0.015, outputPer1k: 0.075 });
    this.pricing.set('anthropic-haiku', { inputPer1k: 0.0008, outputPer1k: 0.004 });
    this.pricing.set('openai-gpt-4o', { inputPer1k: 0.005, outputPer1k: 0.015 });
  }

  async record(request: AIRequest, response: AIResponse): Promise<void> {
    const usage = response.usage;
    if (!usage) return;

    const key = `${response.provider || 'unknown'}-${response.model || 'unknown'}`;
    const price = this.pricing.get(key) || { inputPer1k: 0.01, outputPer1k: 0.03 };
    const cost = (usage.inputTokens * price.inputPer1k + usage.outputTokens * price.outputPer1k) / 1000;

    await this.pool.query(
      `INSERT INTO llm_cost_records (scenario, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, user_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [request.scenario, response.provider, response.model, usage.inputTokens, usage.outputTokens, usage.totalTokens, cost, request.metadata?.userId, new Date()],
    );
  }

  async getSummary(days: number = 7): Promise<CostSummary> {
    // 查询聚合
    const result = await this.pool.query(
      `SELECT COUNT(*) as total_requests,
              SUM(input_tokens) as total_input,
              SUM(output_tokens) as total_output,
              SUM(cost_usd) as total_cost
       FROM llm_cost_records
       WHERE timestamp > NOW() - INTERVAL '${days} days'`,
    );
    return {
      totalRequests: parseInt(result.rows[0].total_requests),
      totalInputTokens: parseInt(result.rows[0].total_input),
      totalOutputTokens: parseInt(result.rows[0].total_output),
      totalCostUsd: parseFloat(result.rows[0].total_cost),
      avgCostPerRequest: parseFloat(result.rows[0].total_cost) / parseInt(result.rows[0].total_requests),
      costByScenario: {},
      costByProvider: {},
    };
  }
}
```

**Cost Tracker 数据库迁移：**
```sql
CREATE TABLE IF NOT EXISTS llm_cost_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario VARCHAR(100) NOT NULL,
  provider VARCHAR(50),
  model VARCHAR(50),
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  user_id VARCHAR(255),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_scenario ON llm_cost_records(scenario);
CREATE INDEX idx_cost_timestamp ON llm_cost_records(timestamp);
CREATE INDEX idx_cost_user ON llm_cost_records(user_id);
```

---

## 五、权限管控设计

### 5.1 当前 RBAC 现状分析

| 组件 | 状态 | 说明 |
|------|------|------|
| JWT 认证 | ✅ | `authMiddleware.ts` 解析 JWT，提取 roles 数组 |
| Role Guard | ✅ | `roleGuard(['admin'])` 路由级角色拦截 |
| PermissionService | ✅ | ChatOps 双层权限：命令级 + 资源级 |
| RBACRuleRepository | ✅ | 流水线级 RBAC 规则存储 |
| Roles DB | ✅ | `roles`, `permissions`, `role_permissions` 表 |
| 前端权限 | ❌ | 路由/菜单/按钮均无权限判断 |
| AI 模块 RBAC | ❌ | 所有 AI route 无权限中间件 |
| ABAC | ❌ | 无属性策略引擎 |

**结论：有 RBAC 基础设施，但未覆盖 AI 模块，前端完全缺失。**

### 5.2 权限点扩展

当前只有 `ai:use` / `ai:manage` 两个粗粒度权限，扩展为：

```typescript
// 新增到 COMMON_PERMISSIONS (api/roles.ts)

// AI 基础设施
{ value: 'ai:provider:read', label: 'AI Provider - 查看' },
{ value: 'ai:provider:write', label: 'AI Provider - 管理' },
{ value: 'ai:scenario:read', label: '场景路由 - 查看' },
{ value: 'ai:scenario:write', label: '场景路由 - 管理' },
{ value: 'ai:gateway:read', label: 'AI Gateway - 查看' },
{ value: 'ai:gateway:write', label: 'AI Gateway - 管理' },
{ value: 'ai:trace:read', label: 'LLM Trace - 查看' },
{ value: 'ai:cost:read', label: '成本分析 - 查看' },
{ value: 'ai:cost:write', label: '成本分析 - 管理' },

// Agent 编排
{ value: 'ai:agent:read', label: 'Agent - 查看' },
{ value: 'ai:agent:write', label: 'Agent - 管理' },
{ value: 'ai:orchestration:read', label: '编排策略 - 查看' },
{ value: 'ai:orchestration:write', label: '编排策略 - 管理' },
{ value: 'ai:tool:read', label: '工具注册表 - 查看' },
{ value: 'ai:tool:write', label: '工具注册表 - 管理' },

// AI Review
{ value: 'ai:review:read', label: 'AI Review - 查看' },
{ value: 'ai:review:write', label: 'AI Review - 管理' },

// AI 文档
{ value: 'ai:doc:read', label: 'AI 文档 - 查看' },
{ value: 'ai:doc:write', label: 'AI 文档 - 编辑' },

// 知识库
{ value: 'knowledge:read', label: '知识库 - 查看' },
{ value: 'knowledge:write', label: '知识库 - 管理' },

// ChatOps
{ value: 'chatops:use', label: 'ChatOps - 使用' },
{ value: 'chatops:read', label: 'ChatOps - 查看记录' },
{ value: 'chatops:config:write', label: 'ChatOps - 配置管理' },

// AI 安全
{ value: 'ai:security:read', label: 'AI 安全 - 查看' },
{ value: 'ai:security:write', label: 'AI 安全 - 管理' },
```

### 5.3 角色权限矩阵

| 角色 | Provider | Gateway | Agent | Review | Doc | Knowledge | ChatOps | Security | Trace | Cost |
|------|----------|---------|-------|--------|-----|-----------|---------|----------|-------|------|
| **Admin** | W | W | W | W | W | W | W | W | R | R |
| **AI Architect** | W | W | W | R | R | R | R | R | R | R |
| **Security Admin** | - | R | R | R | R | R | R | W | R | R |
| **Team Lead** | - | R | W | W | W | W | C | R | R | R |
| **Developer** | - | R | R | R | W | R | U | R | - | - |
| **OnCall Engineer** | - | R | R | R | R | R | W | R | R | - |
| **Viewer** | - | R | - | R | R | R | U | - | - | - |

> W=Write, R=Read, U=Use, C=Config

### 5.4 前端权限控制实现

#### 5.4.0 新增 PermissionStore

```typescript
// stores/permissionStore.ts — 从角色派生权限点
import { create } from 'zustand';
import { ROLE_PERMISSIONS, type CommonPermission } from '@/api/roles';

interface PermissionState {
  permissions: string[];
  // 从用户角色派生权限
  setRoles: (roles: string[]) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: [],

  setRoles: (roles: string[]) => {
    const perms = new Set<string>();
    for (const role of roles) {
      const rolePerms = ROLE_PERMISSIONS[role];
      if (rolePerms) rolePerms.forEach(p => perms.add(p));
      // admin 拥有全部权限
      if (role === 'admin') perms.add('*');
    }
    set({ permissions: Array.from(perms) });
  },

  hasPermission: (permission: string) => {
    const { permissions } = get();
    return permissions.includes('*') || permissions.includes(permission);
  },

  hasAnyPermission: (perms: string[]) => {
    const { permissions } = get();
    if (permissions.includes('*')) return true;
    return perms.some(p => permissions.includes(p));
  },
}));
```

#### 5.4.1 扩展 AppRoute 接口

现有 `AppRoute` 使用 `requiredRole`（角色数组）做路由守卫。为支持细粒度权限，新增 `requiredPermissions` 字段：

```typescript
// router/routes.ts — 扩展 AppRoute 接口
export interface AppRoute {
  path?: string;
  element: ReactNode;
  protected?: boolean;
  /** 角色守卫：任一角色匹配即可访问（现有） */
  requiredRole?: string | string[];
  /** 权限点守卫：所有权限点均需满足（新增） */
  requiredPermissions?: string[];
  children?: AppRoute[];
}
```

#### 5.4.2 改造 ProtectedRoute 支持双重守卫

```typescript
// router/index.tsx — ProtectedRoute 扩展
const ProtectedRoute: React.FC<{ children: React.ReactNode; route: AppRoute }> = ({
  children,
  route,
}) => {
  const user = useAuthStore((s) => s.user);
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const hasAnyPermission = usePermissionStore((s) => s.hasAnyPermission);

  // 1. 角色守卫（现有逻辑，保持不变）
  if (route.requiredRole && !checkRoleAccess(user?.role, route.requiredRole)) {
    message.error('您没有权限访问此页面');
    navigate('/dashboard', { replace: true });
    return null;
  }

  // 2. 权限点守卫（新增）
  if (route.requiredPermissions && !hasAnyPermission(route.requiredPermissions)) {
    message.error('权限不足，需要 ' + route.requiredPermissions.join(' / ') + ' 权限');
    navigate('/dashboard', { replace: true });
    return null;
  }

  return <>{children}</>;
};
```

#### 5.4.3 路由守卫使用示例

```typescript
// router/routes.ts — AI 路由定义
{
  path: '/ai/gateway',
  element: React.lazy(() => import('@/pages/AIGateway')),
  protected: true,
  requiredPermissions: ['ai:gateway:read'],
},
{
  path: '/ai/provider',
  element: React.lazy(() => import('@/pages/AIProvider')),
  protected: true,
  requiredPermissions: ['ai:provider:read'],
},
{
  path: '/ai/security',
  element: React.lazy(() => import('@/pages/AISecurity')),
  protected: true,
  requiredPermissions: ['ai:security:read'],
},
```

#### 5.4.4 菜单过滤

```typescript
// stores/menuConfigStore.ts — 根据用户权限过滤菜单
const MODULE_PERMISSIONS: Record<string, string[]> = {
  '/ai/dashboard': ['ai:*'],
  '/ai/chatops': ['chatops:use'],
  '/ai/docs': ['ai:doc:read'],
  '/ai/knowledge': ['knowledge:read'],
  '/ai/review': ['ai:review:read'],
  '/ai/gateway': ['ai:gateway:read'],
  '/ai/security': ['ai:security:read'],
  '/ai/provider': ['ai:provider:read'],
  '/ai/agents': ['ai:agent:read'],
  '/ai/orchestration': ['ai:orchestration:read'],
  '/ai/tools': ['ai:tool:read'],
  '/ai/trace': ['ai:trace:read'],
  '/ai/cost': ['ai:cost:read'],
};

export const getVisibleChildren = (moduleKey: string, userPermissions: string[]): MenuChildConfig[] => {
  const module = useMenuConfigStore.getState().modules[moduleKey];
  if (!module) return [];

  return module.children.filter(child => {
    const required = MODULE_PERMISSIONS[child.key];
    if (!required) return child.enabled;
    // 用户拥有任一所需权限即可看到该菜单项
    return child.enabled && required.some(p =>
      userPermissions.includes(p) || userPermissions.includes('*')
    );
  });
};
```

#### 5.4.5 按钮级控制

```typescript
// hooks/usePermission.ts
export function usePermission(permission: string): boolean {
  return usePermissionStore((s) => s.hasPermission(permission));
}

export function useAnyPermission(permissions: string[]): boolean {
  return usePermissionStore((s) => s.hasAnyPermission(permissions));
}

// 页面中使用
function AIGatewayPage() {
  const canConfigure = usePermission('ai:gateway:write');
  return (
    <Button icon={<SettingOutlined />} disabled={!canConfigure}>配置</Button>
  );
}
```

### 5.5 后端权限中间件

#### 5.5.1 权限点查询 Repository

```typescript
// repositories/UserPermissionRepository.ts
export interface UserPermissionRepository {
  getUserPermissions(userId: string): Promise<string[]>;
}

export class PgUserPermissionRepository implements UserPermissionRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const result = await this.pool.query(`
      SELECT DISTINCT p.value
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE r.id IN (
        SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = $1
      )
    `, [userId]);
    return result.rows.map(row => row.value);
  }
}
```

#### 5.5.2 权限中间件

```typescript
// middleware/permissionGuard.ts
export function requirePermission(requiredPermissions: string[]) {
  const permRepo = new PgUserPermissionRepository(getPool());

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const userRoles = (request.user as any)?.roles || [];
    if (userRoles.includes('admin')) return; // Admin bypass

    const userPerms = await permRepo.getUserPermissions((request.user as any).userId);
    const hasPerm = requiredPermissions.some(p => userPerms.includes(p));
    if (!hasPerm) {
      return reply.code(403).send({
        code: 403,
        error: 'FORBIDDEN',
        message: '权限不足',
      });
    }
  };
}
```

#### 5.5.3 路由中使用权限中间件

```typescript
// routes/ai-provider.ts
fastify.get('/api/v1/ai-provider', {
  preHandler: [requirePermission(['ai:provider:read'])],
  handler: listProviders,
});
```

### 5.6 旧路由迁移兼容

Phase 4 路由重排时需要处理旧路由书签失效问题。在 `router/routes.ts` 中添加 301 重定向：

```typescript
// router/routes.ts — 旧路由 301 重定向
const Redirect: React.FC<{ to: string }> = ({ to }) => {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace: true }); }, [navigate, to]);
  return <Loading />;
};

// 旧路由重定向
{ path: '/ai-gateway', element: <Redirect to="/ai/gateway" />, protected: true },
{ path: '/ai-gateway/*', element: <Redirect to="/ai/gateway" />, protected: true },
{ path: '/agents', element: <Redirect to="/ai/agents" />, protected: true },
{ path: '/agent-runs/*', element: <Redirect to="/ai/agents" />, protected: true },
{ path: '/ai-security', element: <Redirect to="/ai/security" />, protected: true },
{ path: '/console/chatops', element: <Redirect to="/ai/chatops" />, protected: true },
{ path: '/console/chatops/*', element: <Redirect to="/ai/chatops" />, protected: true },
{ path: '/console/ai-review', element: <Redirect to="/ai/review" />, protected: true },
{ path: '/console/ai-review/*', element: <Redirect to="/ai/review" />, protected: true },
{ path: '/console/ai-docs', element: <Redirect to="/ai/docs" />, protected: true },
{ path: '/console/ai-docs/*', element: <Redirect to="/ai/docs" />, protected: true },
{ path: '/console/llm-trace', element: <Redirect to="/ai/trace" />, protected: true },
{ path: '/console/llm-trace/*', element: <Redirect to="/ai/trace" />, protected: true },
{ path: '/console/ai-cost', element: <Redirect to="/ai/cost" />, protected: true },
{ path: '/console/ai-cost/*', element: <Redirect to="/ai/cost" />, protected: true },
```

---

## 六、UI/UX 设计规范

### 6.1 AI 总览 Dashboard（首页）

采用 Dashboard 优先设计，用户进入 AI 能力平台首先看到全局状态：

```
┌─────────────────────────────────────────────────────────────────┐
│ AI 能力平台总览                                     [刷新] [配置] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ 健康场景  │  │ 活跃Agent │  │ 今日Token │  │ 今日成本  │        │
│  │   12/14   │  │    8     │  │  1.2M   │  │  $42.50  │        │
│  │  🟢 86%   │  │  🟢 运行  │  │  ↑ 15%  │  │  ↓ 8%   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  ┌───────────────────────────────┐  ┌──────────────────────┐   │
│  │  AI Gateway 场景健康           │  │  最近 Agent 运行     │   │
│  │  ┌─────────────────────────┐  │  │  ┌────────────────┐  │   │
│  │  │ chatops_intent  🟢      │  │  │  │ #1042  🔧 完成 │  │   │
│  │  │ code-review     🟢      │  │  │  │ #1041  📝 运行 │  │   │
│  │  │ root-cause      🟡      │  │  │  │ #1040  🔍 完成 │  │   │
│  │  └─────────────────────────┘  │  │  └────────────────┘  │   │
│  └───────────────────────────────┘  └──────────────────────┘   │
│                                                                 │
│  ┌───────────────────────────────┐  ┌──────────────────────┐   │
│  │  安全事件 (24h)               │  │  快速入口            │   │
│  │  ┌─────────────────────────┐  │  │  ┌────────────────┐  │   │
│  │  │ 拦截: 12  高危: 2       │  │  │  │ ChatOps 对话   │  │   │
│  │  │ 合规评分: 94/100        │  │  │  │ AI Review      │  │   │
│  │  └─────────────────────────┘  │  │  │ 知识库         │  │   │
│  └───────────────────────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 ChatOps 对话工作台

```
┌──────────────────────────────────────────────────────────────┐
│ ChatOps 对话工作台                              [历史记录] [设置]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🤖 Orion: 你好！我可以帮你排查问题、执行部署、查询    │   │
│  │    日志。试试说："帮我排查 api 服务延迟"              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 👤 你: 帮我排查下 api 服务为什么延迟很高               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🤖 Orion: 正在分析 api 服务延迟...                    │   │
│  │   ─────────────────────────────────                   │   │
│  │   ✓ 查询 Prometheus 指标 (P99: 340ms, ↑ 280%)        │   │
│  │   ✓ 查询最近 1h 日志 (发现 12 条 ERROR)              │   │
│  │   ✓ 诊断结果：数据库连接池耗尽                        │   │
│  │                                                       │   │
│  │   建议：                                               │   │
│  │   1. 临时扩容 DB 连接池 (max: 50 → 100)              │   │
│  │   2. 检查慢查询 (3 条 > 5s)                          │   │
│  │                                                       │   │
│  │   [执行扩容] [查看慢查询] [生成报告]                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 输入命令...                              [发送] [语音] │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 空状态引导

每个模块首次加载或无数据时显示引导：

| 模块 | 空状态文案 | 引导操作 |
|------|-----------|---------|
| Provider 管理 | "尚未配置 LLM Provider" | [添加 Provider] |
| Agent 管理 | "还没有 Agent，创建一个开始使用" | [创建 Agent] |
| 工具注册表 | "工具注册后 Agent 可以调用" | [注册工具] |
| 知识库 | "开始构建你的知识库" | [导入文档] [创建条目] |
| 编排策略 | "定义 Agent 协作策略" | [创建策略] |
| LLM Trace | "LLM 调用后将自动记录 Trace" | — |
| 成本分析 | "开始使用后将显示成本数据" | — |

---

## 七、实施阶段

### Phase 1a: 权限基础设施 (1 周)
- [ ] 扩展 `COMMON_PERMISSIONS` 添加 AI 权限点
- [ ] 新增 `stores/permissionStore.ts`（从角色派生权限）
- [ ] 新增 `repositories/UserPermissionRepository.ts`
- [ ] 新增 `middleware/permissionGuard.ts`
- [ ] 扩展 `ProtectedRoute` 支持 `requiredPermissions`
- [ ] 新增 `hooks/usePermission.ts`
- [ ] **验证**：TypeScript 编译 + 单元测试

### Phase 1b: Agent 服务合并 (1 周)
- [ ] 数据库迁移：在 ai_db 中创建 agent_profiles/agent_runs 表
- [ ] 从 orion_agent 导出数据导入到 ai_db
- [ ] 创建 `orion-ai-svc/src/services/agent/` 目录
- [ ] 复制 agent-svc 文件到新位置（修改 import 路径）
- [ ] 创建 ToolRegistry 类
- [ ] 改造 MultiAgentOrchestrator 注入 AIGateway + ToolRegistry
- [ ] 合并 app.ts（依赖注入方式注册 agent 路由）
- [ ] **验证**：`npm run type-check` + `npm run test` + `curl http://localhost:3012/api/v1/agents`
- [ ] 删除 orion-agent-svc/ 目录
- [ ] **验证**：E2E 测试确认 Agent API 正常

### Phase 2: AI Gateway 扩展 (2-3 周)
- [ ] Provider Registry 多 Provider 管理
- [ ] Scenario Router 场景→模型映射
- [ ] LLM Trace 页面（数据保留策略：7 天原始 + 30 天聚合）
- [ ] Cost Tracker 成本追踪（新增接口定义，见 4.8 节）
- [ ] PromptGuard 升级为全局单例（消除 ai-security.ts 重复）
- [ ] AI Review 改为 HTTP 调 AI Gateway（统一 LLM 出口）
- [ ] **验证**：Gateway 多 Provider 切换 + 熔断降级 E2E 测试

### Phase 3: 菜单重排 + ChatOps 方案 C (2-3 周)
- [ ] 菜单结构更新（场景化分类）
- [ ] 路由迁移（旧路由 301 重定向）
- [ ] AI 总览 Dashboard 页面
- [ ] ChatOps 对话工作台 (自然语言输入)
- [ ] 意图识别配置 (LLM 驱动的意图分类)
- [ ] Agent 编排集成 (使用合并后的 MultiAgentOrchestrator)
- [ ] Tool Registry 工具实现 (prometheus_query, log_query, diagnose, deploy)
- [ ] SSE 流式输出
- [ ] 各模块空状态引导
- [ ] **验证**：ChatOps 完整对话流程 E2E 测试

### Phase 4: 知识库 + 安全治理 (1-2 周)
- [ ] 知识库 CRUD
- [ ] 威胁监控
- [ ] 合规报告
- [ ] 安全评估完善
- [ ] **验证**：知识库 RAG 检索 + 安全策略评估 E2E 测试

---

## 八、技术决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 多 Provider 支持 | AI Gateway 内部多 Provider + Scenario Router | 利用已有 CircuitBreaker 架构 |
| Agent Orchestrator 位置 | 合并到 orion-ai-svc | 直接调用 Gateway 零延迟，减少部署复杂度 |
| PromptGuard | 全局单例 (AIGateway 内部) | 消除重复实例，统一安全策略 |
| AI Review 调用方式 | HTTP 调 AI Gateway | 统一 LLM 出口，可追踪、可熔断 |
| ChatOps LLM 接入 | 方案 C (Agent 编排) | 完整智能运维助手 |
| 环境变量 | 统一为 `AI_LLM_*` | 消除命名混乱 |
| 菜单分类 | 场景化（智能助手/代码智能/安全与治理/平台配置） | 用户认知负担最小，按使用频率排列 |
| LLM Trace 存储 | 7 天原始 + 30 天聚合 | 平衡可观测性与存储成本 |
| 权限模型 | RBAC（角色→权限点）| 当前 RBAC 基础设施已到位，ABAC 延后 |
| 新增角色 | OnCall Engineer | 运维场景高频用户，需要 ChatOps + Gateway + Trace 权限 |

---

## 九、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Agent 合并 import 路径错误 | 编译失败 | TypeScript 编译验证 |
| Agent 合并路由冲突 | 运行时错误 | 路由前缀隔离（`/api/v1/agents`） |
| Agent 合并数据库迁移失败 | 数据丢失 | 先备份 orion_agent 数据，再迁移 |
| Agent 合并数据库表不存在 | 运行时错误 | 先执行 SQL migration 创建 agent_profiles/agent_runs |
| Agent 合并运行时错误 | 服务不可用 | agent-svc 保留直到 ai-svc 验证通过 |
| AI Review 迁移后性能下降 | 用户体验 | HTTP 调用延迟 < 5ms（同服务内） |
| PromptGuard 单例化 | 安全策略不一致 | 统一配置入口，消除硬编码 |
| LLM Trace 存储成本 | 数据库膨胀 | 7 天原始 + 30 天聚合，定期清理 |
| 菜单迁移后书签失效 | 用户无法访问 | 旧路由 301 重定向到新路由（已在 5.6 节定义 15 条重定向） |
| 权限拦截过严 | 用户无法访问功能 | Phase 1a 先跑通 admin bypass，再逐步收紧 |
| 回滚 | 全部变更 | git revert 即可，agent-svc 代码仍在 git 中 |
