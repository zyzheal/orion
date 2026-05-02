# Flagship Features: AI Agent Orchestration & Ephemeral Dev Environments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two MVP flagship features end-to-end -- (1) AI Agent Workflow Orchestration (Agentic CI) that lets users define agent profiles, trigger workflows manually, execute one agent step, and get results back; (2) Ephemeral Development Environments that auto-create K8s namespaces for PRs, deploy services, generate preview URLs, and tear down on merge.

**Architecture:** Both features follow the established Orion pattern: PostgreSQL-backed data models, Fastify route registration via `registerXxxRoutes(app, options)` with controller/service layers, NATS EventBus for async events (graceful degradation when unavailable), and React 18 + Ant Design 5 frontend pages with Axios API clients. Each feature is self-contained with its own models, services, controllers, route files, migrations, frontend API clients, and pages.

**Tech Stack:** Fastify 4 (backend), PostgreSQL (data), NATS (event bus), K8s (ephemeral envs - mocked for MVP), React 18 + Ant Design 5 (frontend), Axios (API client), TypeScript.

---

## File Structure

### Feature 1: AI Agent Orchestration

| File | Purpose |
|------|---------|
| `orion-platform-service/src/models/AgentProfile.ts` | Agent profile types, factory functions |
| `orion-platform-service/src/models/AgentRun.ts` | Agent run + decision types, factory functions |
| `orion-platform-service/src/services/agent-profile-service.ts` | Agent CRUD service |
| `orion-platform-service/src/services/agent-run-service.ts` | Agent execution service |
| `orion-platform-service/src/api/controllers/AgentProfileController.ts` | Agent profile HTTP controller |
| `orion-platform-service/src/api/controllers/AgentRunController.ts` | Agent run HTTP controller |
| `orion-platform-service/src/routes-agent.ts` | Fastify route registration |
| `orion-platform-service/src/db/migrations/024_create_agent_orchestration_tables.sql` | DB migrations |
| `orion-frontend/src/api/agents.ts` | Frontend API client |
| `orion-frontend/src/pages/AgentDashboard/index.tsx` | Agent dashboard page (list + trigger) |
| `orion-frontend/src/pages/AgentRunDetail/index.tsx` | Run detail page with decision timeline |

### Feature 2: Ephemeral Dev Environments

| File | Purpose |
|------|---------|
| `orion-platform-service/src/models/EphemeralEnvironment.ts` | Ephemeral env types, factory |
| `orion-platform-service/src/services/ephemeral-env-service.ts` | Environment lifecycle service |
| `orion-platform-service/src/services/k8s-provisioner-service.ts` | K8s namespace provisioning (mock MVP) |
| `orion-platform-service/src/api/controllers/EphemeralEnvController.ts` | Ephemeral env HTTP controller |
| `orion-platform-service/src/routes-ephemeral-env.ts` | Fastify route registration |
| `orion-platform-service/src/db/migrations/025_create_ephemeral_env_tables.sql` | DB migrations |
| `orion-frontend/src/api/ephemeral-envs.ts` | Frontend API client |
| `orion-frontend/src/pages/EphemeralEnvList/index.tsx` | Environment list page |
| `orion-frontend/src/pages/EphemeralEnvDetail/index.tsx` | Environment detail page |

---

## FEATURE 1: AI Agent Workflow Orchestration (Agentic CI)

### Task 1: Agent Profile Model

**Files:**
- Create: `orion-platform-service/src/models/AgentProfile.ts`

- [ ] **Step 1: Create the AgentProfile model with types and factory**

```typescript
/**
 * Agent Profile 数据模型
 *
 * 定义 Agent 的角色、工具集、能力配置和 LLM 配置
 */

import { v4 as uuidv4 } from 'uuid';

export type AgentRole =
  | 'bug_fixer'
  | 'code_fixer'
  | 'test_writer'
  | 'pr_submitter'
  | 'security_patcher'
  | 'doc_writer';

export interface AgentToolConfig {
  toolName: string;
  permission: 'read' | 'write' | 'execute';
  config?: Record<string, unknown>;
}

export interface AgentCapabilities {
  maxSteps: number;
  timeoutSec: number;
  retryCount: number;
}

export interface AgentConstraints {
  maxTokens: number;
  allowedBranches: string[];
  forbiddenOperations: string[];
}

export interface AgentLLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  tools: AgentToolConfig[];
  capabilities: AgentCapabilities;
  constraints: AgentConstraints;
  llmConfig: AgentLLMConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentProfileCreateInput {
  name: string;
  role: AgentRole;
  description?: string;
  tools?: AgentToolConfig[];
  capabilities?: Partial<AgentCapabilities>;
  constraints?: Partial<AgentConstraints>;
  llmConfig?: Partial<AgentLLMConfig>;
}

export interface AgentProfileUpdateInput {
  description?: string;
  tools?: AgentToolConfig[];
  capabilities?: Partial<AgentCapabilities>;
  constraints?: Partial<AgentConstraints>;
  llmConfig?: Partial<AgentLLMConfig>;
  enabled?: boolean;
}

const DEFAULT_CAPABILITIES: AgentCapabilities = {
  maxSteps: 20,
  timeoutSec: 3600,
  retryCount: 3,
};

const DEFAULT_CONSTRAINTS: AgentConstraints = {
  maxTokens: 8192,
  allowedBranches: ['main', 'develop'],
  forbiddenOperations: ['deploy_to_production', 'drop_database'],
};

const DEFAULT_LLM_CONFIG: AgentLLMConfig = {
  model: 'gpt-4o-mini',
  temperature: 0.2,
  maxTokens: 4096,
};

export function createAgentProfile(input: AgentProfileCreateInput): AgentProfile {
  const now = new Date();
  return {
    id: uuidv4(),
    name: input.name,
    role: input.role,
    description: input.description || '',
    tools: input.tools || [
      { toolName: 'read_file', permission: 'read' },
      { toolName: 'run_command', permission: 'execute' },
    ],
    capabilities: { ...DEFAULT_CAPABILITIES, ...input.capabilities },
    constraints: { ...DEFAULT_CONSTRAINTS, ...input.constraints },
    llmConfig: { ...DEFAULT_LLM_CONFIG, ...input.llmConfig },
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateAgentProfile(
  profile: AgentProfile,
  input: AgentProfileUpdateInput
): AgentProfile {
  return {
    ...profile,
    description: input.description ?? profile.description,
    tools: input.tools ?? profile.tools,
    capabilities: input.capabilities
      ? { ...profile.capabilities, ...input.capabilities }
      : profile.capabilities,
    constraints: input.constraints
      ? { ...profile.constraints, ...input.constraints }
      : profile.constraints,
    llmConfig: input.llmConfig
      ? { ...profile.llmConfig, ...input.llmConfig }
      : profile.llmConfig,
    enabled: input.enabled ?? profile.enabled,
    updatedAt: new Date(),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/models/AgentProfile.ts
git commit -m "feat(agent): add AgentProfile model with types and factory functions"
```

---

### Task 2: Agent Run Model

**Files:**
- Create: `orion-platform-service/src/models/AgentRun.ts`

- [ ] **Step 1: Create the AgentRun model with types and factory**

```typescript
/**
 * Agent Run 数据模型
 *
 * 定义 Agent 运行记录、决策日志和状态管理
 */

import { v4 as uuidv4 } from 'uuid';

export type AgentRunStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting_approval';

export type AgentAction =
  | 'read_file'
  | 'write_code'
  | 'run_command'
  | 'create_pr'
  | 'request_approval';

export interface AgentDecision {
  id: string;
  runId: string;
  agentId: string;
  stepNumber: number;
  action: AgentAction;
  actionInput: Record<string, unknown>;
  actionOutput?: Record<string, unknown>;
  reasoning: string;
  toolResult?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
}

export interface AgentRun {
  id: string;
  agentProfileId: string;
  agentProfileName: string;
  triggerPayload: Record<string, unknown>;
  status: AgentRunStatus;
  currentStep: number;
  totalSteps: number;
  result?: Record<string, unknown>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  timeoutAt: Date;
  decisions: AgentDecision[];
  tenantId?: string;
}

export interface AgentRunCreateInput {
  agentProfileId: string;
  agentProfileName: string;
  triggerPayload: Record<string, unknown>;
  totalSteps?: number;
  timeoutSec?: number;
  tenantId?: string;
}

export function createAgentRun(input: AgentRunCreateInput): AgentRun {
  const now = new Date();
  const timeoutSec = input.timeoutSec || 3600;
  const timeoutAt = new Date(now.getTime() + timeoutSec * 1000);

  return {
    id: uuidv4(),
    agentProfileId: input.agentProfileId,
    agentProfileName: input.agentProfileName,
    triggerPayload: input.triggerPayload,
    status: 'running',
    currentStep: 0,
    totalSteps: input.totalSteps || 1,
    startedAt: now,
    timeoutAt,
    decisions: [],
    tenantId: input.tenantId,
  };
}

export function addDecision(
  run: AgentRun,
  agentId: string,
  stepNumber: number,
  action: AgentAction,
  actionInput: Record<string, unknown>,
  reasoning: string
): AgentDecision {
  const decision: AgentDecision = {
    id: uuidv4(),
    runId: run.id,
    agentId,
    stepNumber,
    action,
    actionInput,
    reasoning,
    createdAt: new Date(),
  };
  run.decisions.push(decision);
  run.currentStep = stepNumber;
  return decision;
}

export function completeDecision(
  decision: AgentDecision,
  toolResult: Record<string, unknown>,
  actionOutput?: Record<string, unknown>
): void {
  decision.toolResult = toolResult;
  decision.actionOutput = actionOutput;
}

export function failDecision(
  decision: AgentDecision,
  error: string
): void {
  decision.error = error;
}

export function completeRun(
  run: AgentRun,
  result: Record<string, unknown>
): void {
  run.status = 'completed';
  run.result = result;
  run.completedAt = new Date();
}

export function failRun(
  run: AgentRun,
  error: string
): void {
  run.status = 'failed';
  run.error = error;
  run.completedAt = new Date();
}

export function cancelRun(run: AgentRun): void {
  run.status = 'cancelled';
  run.completedAt = new Date();
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/models/AgentRun.ts
git commit -m "feat(agent): add AgentRun model with decision tracking and state management"
```

---

### Task 3: Agent Profile Service

**Files:**
- Create: `orion-platform-service/src/services/agent-profile-service.ts`

- [ ] **Step 1: Create the AgentProfileService with in-memory store and CRUD operations**

```typescript
/**
 * Agent Profile Service
 *
 * 负责 Agent Profile 的生命周期管理：
 * - 创建、查询、更新、删除 Agent Profile
 * - 启用/禁用 Agent
 * - 查询可用 Agent 列表
 */

import pino from 'pino';
import {
  AgentProfile,
  AgentProfileCreateInput,
  AgentProfileUpdateInput,
  createAgentProfile,
  updateAgentProfile,
} from '../models/AgentProfile';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AgentProfileService {
  private profiles: Map<string, AgentProfile> = new Map();

  /**
   * 创建 Agent Profile
   */
  async create(input: AgentProfileCreateInput): Promise<AgentProfile> {
    logger.info({ name: input.name, role: input.role }, 'Creating agent profile');

    // Check for duplicate name
    const existing = Array.from(this.profiles.values()).find(
      (p) => p.name === input.name
    );
    if (existing) {
      throw new Error(`Agent profile with name "${input.name}" already exists`);
    }

    const profile = createAgentProfile(input);
    this.profiles.set(profile.id, profile);

    logger.info({ id: profile.id }, 'Agent profile created');
    return profile;
  }

  /**
   * 获取 Agent Profile 列表
   */
  async list(options?: {
    roleFilter?: string;
    enabledOnly?: boolean;
  }): Promise<AgentProfile[]> {
    let profiles = Array.from(this.profiles.values());

    if (options?.roleFilter) {
      profiles = profiles.filter((p) => p.role === options.roleFilter);
    }

    if (options?.enabledOnly) {
      profiles = profiles.filter((p) => p.enabled);
    }

    return profiles;
  }

  /**
   * 获取 Agent Profile 详情
   */
  async getById(id: string): Promise<AgentProfile> {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`Agent profile "${id}" not found`);
    }
    return profile;
  }

  /**
   * 更新 Agent Profile
   */
  async update(id: string, input: AgentProfileUpdateInput): Promise<AgentProfile> {
    logger.info({ id }, 'Updating agent profile');

    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error(`Agent profile "${id}" not found`);
    }

    const updated = updateAgentProfile(existing, input);
    this.profiles.set(id, updated);

    logger.info({ id }, 'Agent profile updated');
    return updated;
  }

  /**
   * 删除 Agent Profile
   */
  async delete(id: string): Promise<void> {
    logger.info({ id }, 'Deleting agent profile');

    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error(`Agent profile "${id}" not found`);
    }

    this.profiles.delete(id);
    logger.info({ id }, 'Agent profile deleted');
  }

  /**
   * 启用/禁用 Agent
   */
  async toggle(id: string): Promise<AgentProfile> {
    const existing = this.profiles.get(id);
    if (!existing) {
      throw new Error(`Agent profile "${id}" not found`);
    }

    const updated = updateAgentProfile(existing, { enabled: !existing.enabled });
    this.profiles.set(id, updated);

    logger.info({ id, enabled: updated.enabled }, 'Agent profile toggled');
    return updated;
  }

  /**
   * 按名称获取（用于工作流引用）
   */
  async getByName(name: string): Promise<AgentProfile> {
    const profile = Array.from(this.profiles.values()).find(
      (p) => p.name === name
    );
    if (!profile) {
      throw new Error(`Agent profile "${name}" not found`);
    }
    return profile;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/services/agent-profile-service.ts
git commit -m "feat(agent): add AgentProfileService with CRUD operations"
```

---

### Task 4: Agent Profile Controller

**Files:**
- Create: `orion-platform-service/src/api/controllers/AgentProfileController.ts`

- [ ] **Step 1: Create the AgentProfileController**

```typescript
/**
 * Agent Profile Controller
 *
 * 处理 Agent Profile 相关的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AgentProfileService } from '../../services/agent-profile-service';

export class AgentProfileController {
  private service: AgentProfileService;

  constructor(service: AgentProfileService) {
    this.service = service;
  }

  /**
   * 创建 Agent Profile
   * POST /api/v1/agents
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const profile = await this.service.create({
        name: body.name,
        role: body.role,
        description: body.description,
        tools: body.tools,
        capabilities: body.capabilities,
        constraints: body.constraints,
        llmConfig: body.llmConfig,
      });

      await reply.status(201).send({
        success: true,
        data: profile,
        message: `Agent profile "${profile.name}" created successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create agent profile',
      });
    }
  }

  /**
   * 列出 Agent Profiles
   * GET /api/v1/agents
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const profiles = await this.service.list({
        roleFilter: query.role,
        enabledOnly: query.enabledOnly === 'true',
      });

      await reply.send({
        success: true,
        data: profiles,
        total: profiles.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list agent profiles',
      });
    }
  }

  /**
   * 获取 Agent Profile 详情
   * GET /api/v1/agents/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const profile = await this.service.getById(params.id);

      await reply.send({
        success: true,
        data: profile,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Agent profile not found',
      });
    }
  }

  /**
   * 更新 Agent Profile
   * PUT /api/v1/agents/:id
   */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const profile = await this.service.update(params.id, {
        description: body.description,
        tools: body.tools,
        capabilities: body.capabilities,
        constraints: body.constraints,
        llmConfig: body.llmConfig,
        enabled: body.enabled,
      });

      await reply.send({
        success: true,
        data: profile,
        message: `Agent profile "${profile.name}" updated successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update agent profile',
      });
    }
  }

  /**
   * 删除 Agent Profile
   * DELETE /api/v1/agents/:id
   */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      await this.service.delete(params.id);

      await reply.send({
        success: true,
        message: 'Agent profile deleted successfully',
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete agent profile',
      });
    }
  }

  /**
   * 启用/禁用 Agent
   * PATCH /api/v1/agents/:id/toggle
   */
  async toggle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const profile = await this.service.toggle(params.id);

      await reply.send({
        success: true,
        data: profile,
        message: `Agent profile "${profile.name}" ${profile.enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle agent',
      });
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/api/controllers/AgentProfileController.ts
git commit -m "feat(agent): add AgentProfileController with HTTP handlers"
```

---

### Task 5: Agent Run Service

**Files:**
- Create: `orion-platform-service/src/services/agent-run-service.ts`

- [ ] **Step 1: Create the AgentRunService with execution and decision logging**

```typescript
/**
 * Agent Run Service
 *
 * 负责 Agent 工作流的执行：
 * - 手动触发 Agent 运行
 * - 执行 Agent 步骤（read_file, run_command）
 * - 记录决策日志
 * - 返回运行结果
 */

import pino from 'pino';
import { AgentProfileService } from './agent-profile-service';
import { EventBusService } from './event-bus-service';
import {
  AgentRun,
  AgentRunCreateInput,
  AgentRunStatus,
  AgentAction,
  AgentDecision,
  createAgentRun,
  addDecision,
  completeDecision,
  failDecision,
  completeRun,
  failRun,
  cancelRun,
} from '../models/AgentRun';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AgentRunService {
  private runs: Map<string, AgentRun> = new Map();
  private agentProfileService: AgentProfileService;
  private eventBus?: EventBusService;

  constructor(options: {
    agentProfileService: AgentProfileService;
    eventBus?: EventBusService;
  }) {
    this.agentProfileService = options.agentProfileService;
    this.eventBus = options.eventBus;
  }

  /**
   * 手动触发 Agent 运行
   */
  async triggerRun(input: AgentRunCreateInput): Promise<AgentRun> {
    logger.info({
      agentProfileId: input.agentProfileId,
      triggerPayload: input.triggerPayload,
    }, 'Triggering agent run');

    // Validate agent profile exists and is enabled
    const profile = await this.agentProfileService.getById(input.agentProfileId);
    if (!profile.enabled) {
      throw new Error(`Agent profile "${profile.name}" is disabled`);
    }

    const run = createAgentRun({
      ...input,
      agentProfileName: profile.name,
      timeoutSec: profile.capabilities.timeoutSec,
    });

    this.runs.set(run.id, run);

    // Publish event
    await this.publishEvent('agent.run.started', {
      runId: run.id,
      agentProfileId: run.agentProfileId,
      agentProfileName: run.agentProfileName,
    });

    logger.info({ runId: run.id }, 'Agent run started');
    return run;
  }

  /**
   * 执行 Agent 步骤 (MVP: 只执行一步)
   */
  async executeStep(
    runId: string,
    action: AgentAction,
    actionInput: Record<string, unknown>
  ): Promise<AgentDecision> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Agent run "${runId}" not found`);
    }

    if (run.status !== 'running') {
      throw new Error(`Agent run "${runId}" is not running (status: ${run.status})`);
    }

    // Check timeout
    if (new Date() > run.timeoutAt) {
      failRun(run, 'Agent run timed out');
      throw new Error('Agent run timed out');
    }

    // Get agent profile for constraints
    const profile = await this.agentProfileService.getById(run.agentProfileId);
    const stepNumber = run.currentStep + 1;

    // Create decision record
    const decision = addDecision(
      run,
      profile.id,
      stepNumber,
      action,
      actionInput,
      `Executing ${action} as part of agent workflow`
    );

    logger.info(
      { runId, step: stepNumber, action },
      'Executing agent step'
    );

    try {
      // Execute the actual tool
      const toolResult = await this.executeTool(action, actionInput, profile);

      completeDecision(decision, toolResult, {
        step: stepNumber,
        status: 'completed',
        timestamp: new Date().toISOString(),
      });

      // Check if this was the last step
      if (stepNumber >= run.totalSteps) {
        completeRun(run, {
          finalStep: stepNumber,
          decisions: run.decisions.map((d) => ({
            action: d.action,
            status: d.error ? 'failed' : 'completed',
            toolResult: d.toolResult,
          })),
          completedAt: new Date().toISOString(),
        });

        await this.publishEvent('agent.run.completed', {
          runId: run.id,
          result: run.result,
        });
      }

      logger.info(
        { runId, step: stepNumber, action },
        'Agent step completed'
      );
      return decision;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      failDecision(decision, errorMsg);
      failRun(run, `Step ${stepNumber} failed: ${errorMsg}`);

      await this.publishEvent('agent.run.failed', {
        runId: run.id,
        error: errorMsg,
        step: stepNumber,
      });

      throw error;
    }
  }

  /**
   * 执行工具 (MVP: 模拟 read_file 和 run_command)
   */
  private async executeTool(
    action: AgentAction,
    actionInput: Record<string, unknown>,
    profile: any
  ): Promise<Record<string, unknown>> {
    // Check if tool is allowed by profile
    const allowedTool = profile.tools.find(
      (t: any) => t.toolName === action && (t.permission === 'read' || t.permission === 'execute')
    );

    if (!allowedTool) {
      throw new Error(`Tool "${action}" is not allowed for agent profile`);
    }

    switch (action) {
      case 'read_file': {
        const filePath = actionInput.filePath as string || '/dev/null';
        return {
          success: true,
          filePath,
          content: `# Simulated file content for ${filePath}\n# In MVP, this returns mock content`,
          lines: 2,
          timestamp: new Date().toISOString(),
        };
      }

      case 'run_command': {
        const command = actionInput.command as string || 'echo hello';
        // Block dangerous commands
        const blocked = ['rm -rf /', 'DROP TABLE', 'sudo rm', 'chmod 777 /'];
        if (blocked.some((b) => command.includes(b))) {
          throw new Error(`Command "${command}" is forbidden`);
        }

        return {
          success: true,
          command,
          stdout: `[MVP] Simulated output for: ${command}`,
          stderr: '',
          exitCode: 0,
          durationMs: 50,
          timestamp: new Date().toISOString(),
        };
      }

      case 'write_code': {
        const filePath = actionInput.filePath as string || '/tmp/agent_output.ts';
        const content = actionInput.content as string || '// Agent generated code';
        return {
          success: true,
          filePath,
          linesWritten: content.split('\n').length,
          timestamp: new Date().toISOString(),
        };
      }

      case 'create_pr': {
        return {
          success: true,
          prUrl: 'https://github.com/org/repo/pull/1',
          prNumber: 1,
          timestamp: new Date().toISOString(),
        };
      }

      case 'request_approval': {
        return {
          success: true,
          approvalId: `approval-${Date.now()}`,
          status: 'pending',
          timestamp: new Date().toISOString(),
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * 获取 Agent 运行列表
   */
  async list(options?: {
    agentProfileId?: string;
    statusFilter?: AgentRunStatus;
  }): Promise<AgentRun[]> {
    let runs = Array.from(this.runs.values());

    if (options?.agentProfileId) {
      runs = runs.filter((r) => r.agentProfileId === options.agentProfileId);
    }

    if (options?.statusFilter) {
      runs = runs.filter((r) => r.status === options.statusFilter);
    }

    // Sort by startedAt descending
    runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return runs;
  }

  /**
   * 获取 Agent 运行详情
   */
  async getById(id: string): Promise<AgentRun> {
    const run = this.runs.get(id);
    if (!run) {
      throw new Error(`Agent run "${id}" not found`);
    }
    return run;
  }

  /**
   * 取消 Agent 运行
   */
  async cancel(id: string): Promise<AgentRun> {
    const run = this.runs.get(id);
    if (!run) {
      throw new Error(`Agent run "${id}" not found`);
    }

    if (run.status !== 'running') {
      throw new Error(`Agent run "${id}" is not running (status: ${run.status})`);
    }

    cancelRun(run);

    await this.publishEvent('agent.run.cancelled', { runId: run.id });
    logger.info({ runId: run.id }, 'Agent run cancelled');
    return run;
  }

  /**
   * 重试 Agent 运行
   */
  async retry(id: string): Promise<AgentRun> {
    const existing = this.runs.get(id);
    if (!existing) {
      throw new Error(`Agent run "${id}" not found`);
    }

    // Create a new run with same parameters
    const newRun = createAgentRun({
      agentProfileId: existing.agentProfileId,
      agentProfileName: existing.agentProfileName,
      triggerPayload: existing.triggerPayload,
      totalSteps: existing.totalSteps,
      tenantId: existing.tenantId,
    });

    this.runs.set(newRun.id, newRun);

    await this.publishEvent('agent.run.retried', {
      originalRunId: id,
      newRunId: newRun.id,
    });

    logger.info({ originalRunId: id, newRunId: newRun.id }, 'Agent run retried');
    return newRun;
  }

  /**
   * 发布事件
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventBus) {
      try {
        await this.eventBus.publish(type, data, { source: 'agent-run-service' });
      } catch (err) {
        logger.error({ err }, 'Failed to publish agent event');
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/services/agent-run-service.ts
git commit -m "feat(agent): add AgentRunService with step execution and decision logging"
```

---

### Task 6: Agent Run Controller

**Files:**
- Create: `orion-platform-service/src/api/controllers/AgentRunController.ts`

- [ ] **Step 1: Create the AgentRunController**

```typescript
/**
 * Agent Run Controller
 *
 * 处理 Agent 运行相关的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AgentRunService } from '../../services/agent-run-service';
import { AgentAction } from '../../models/AgentRun';

export class AgentRunController {
  private service: AgentRunService;

  constructor(service: AgentRunService) {
    this.service = service;
  }

  /**
   * 手动触发 Agent 运行
   * POST /api/v1/agent-runs
   */
  async triggerRun(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;

      if (!body.agentProfileId) {
        await reply.status(400).send({
          success: false,
          error: 'agentProfileId is required',
        });
        return;
      }

      const run = await this.service.triggerRun({
        agentProfileId: body.agentProfileId,
        triggerPayload: body.triggerPayload || {},
        totalSteps: body.totalSteps,
        tenantId: body.tenantId,
      });

      await reply.status(201).send({
        success: true,
        data: run,
        message: `Agent run "${run.id}" started`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to trigger agent run',
      });
    }
  }

  /**
   * 执行 Agent 步骤
   * POST /api/v1/agent-runs/:id/step
   */
  async executeStep(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;

      if (!body.action) {
        await reply.status(400).send({
          success: false,
          error: 'action is required (read_file, run_command, write_code, create_pr, request_approval)',
        });
        return;
      }

      const decision = await this.service.executeStep(
        params.id,
        body.action as AgentAction,
        body.actionInput || {}
      );

      await reply.send({
        success: true,
        data: decision,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to execute agent step',
      });
    }
  }

  /**
   * 列出 Agent 运行
   * GET /api/v1/agent-runs
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const runs = await this.service.list({
        agentProfileId: query.agentProfileId,
        statusFilter: query.status,
      });

      await reply.send({
        success: true,
        data: runs,
        total: runs.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list agent runs',
      });
    }
  }

  /**
   * 获取 Agent 运行详情
   * GET /api/v1/agent-runs/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const run = await this.service.getById(params.id);

      await reply.send({
        success: true,
        data: run,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Agent run not found',
      });
    }
  }

  /**
   * 取消 Agent 运行
   * POST /api/v1/agent-runs/:id/cancel
   */
  async cancel(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const run = await this.service.cancel(params.id);

      await reply.send({
        success: true,
        data: run,
        message: 'Agent run cancelled',
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cancel agent run',
      });
    }
  }

  /**
   * 重试 Agent 运行
   * POST /api/v1/agent-runs/:id/retry
   */
  async retry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const run = await this.service.retry(params.id);

      await reply.status(201).send({
        success: true,
        data: run,
        message: 'Agent run retried',
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retry agent run',
      });
    }
  }

  /**
   * 获取运行决策日志
   * GET /api/v1/agent-runs/:id/decisions
   */
  async getDecisions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const run = await this.service.getById(params.id);

      await reply.send({
        success: true,
        data: run.decisions,
        total: run.decisions.length,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Agent run not found',
      });
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/api/controllers/AgentRunController.ts
git commit -m "feat(agent): add AgentRunController with HTTP handlers for execution"
```

---

### Task 7: Agent Route Registration

**Files:**
- Create: `orion-platform-service/src/routes-agent.ts`

- [ ] **Step 1: Create the route registration file**

```typescript
/**
 * Agent Orchestration API Routes (Fastify 版本)
 *
 * Agent Profile 和 Agent Run 相关的 API 路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AgentProfileService } from './services/agent-profile-service';
import { AgentRunService } from './services/agent-run-service';
import { AgentProfileController } from './api/controllers/AgentProfileController';
import { AgentRunController } from './api/controllers/AgentRunController';
import { EventBusService } from './services/event-bus-service';

export interface AgentRoutesOptions {
  eventBus?: EventBusService;
}

/**
 * 注册 Agent 路由
 */
export default async function registerAgentRoutes(
  app: FastifyInstance,
  options: AgentRoutesOptions
): Promise<void> {
  // 初始化服务
  const agentProfileService = new AgentProfileService();
  const agentRunService = new AgentRunService({
    agentProfileService,
    eventBus: options.eventBus,
  });

  // 初始化控制器
  const agentProfileController = new AgentProfileController(agentProfileService);
  const agentRunController = new AgentRunController(agentRunService);

  // ==================== Agent Profile 路由 ====================

  // POST /api/v1/agents - 创建 Agent Profile
  app.post('/agents', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.create(request, reply)
  );

  // GET /api/v1/agents - Agent Profile 列表
  app.get('/agents', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.list(request, reply)
  );

  // GET /api/v1/agents/:id - Agent Profile 详情
  app.get('/agents/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.getById(request, reply)
  );

  // PUT /api/v1/agents/:id - 更新 Agent Profile
  app.put('/agents/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.update(request, reply)
  );

  // DELETE /api/v1/agents/:id - 删除 Agent Profile
  app.delete('/agents/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.delete(request, reply)
  );

  // PATCH /api/v1/agents/:id/toggle - 启用/禁用 Agent
  app.patch('/agents/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) =>
    agentProfileController.toggle(request, reply)
  );

  // ==================== Agent Run 路由 ====================

  // POST /api/v1/agent-runs - 手动触发 Agent 运行
  app.post('/agent-runs', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.triggerRun(request, reply)
  );

  // GET /api/v1/agent-runs - Agent 运行列表
  app.get('/agent-runs', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.list(request, reply)
  );

  // GET /api/v1/agent-runs/:id - Agent 运行详情
  app.get('/agent-runs/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.getById(request, reply)
  );

  // POST /api/v1/agent-runs/:id/step - 执行 Agent 步骤
  app.post('/agent-runs/:id/step', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.executeStep(request, reply)
  );

  // POST /api/v1/agent-runs/:id/cancel - 取消运行
  app.post('/agent-runs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.cancel(request, reply)
  );

  // POST /api/v1/agent-runs/:id/retry - 重试
  app.post('/agent-runs/:id/retry', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.retry(request, reply)
  );

  // GET /api/v1/agent-runs/:id/decisions - 决策日志
  app.get('/agent-runs/:id/decisions', async (request: FastifyRequest, reply: FastifyReply) =>
    agentRunController.getDecisions(request, reply)
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/routes-agent.ts
git commit -m "feat(agent): register Agent Profile and Agent Run API routes"
```

---

### Task 8: Agent DB Migration

**Files:**
- Create: `orion-platform-service/src/db/migrations/024_create_agent_orchestration_tables.sql`

- [ ] **Step 1: Create the migration file**

First create the directory.

```bash
mkdir -p orion-platform-service/src/db/migrations
```

```sql
-- Migration 024: AI Agent Orchestration Tables
-- Creates tables for Agent profiles, runs, decisions, and approvals

-- Agent 定义
CREATE TABLE IF NOT EXISTS agent_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL UNIQUE,
  role            VARCHAR(50) NOT NULL,
  description     TEXT,
  tools           JSONB NOT NULL,
  capabilities    JSONB,
  constraints     JSONB,
  llm_config      JSONB,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent 运行记录
CREATE TABLE IF NOT EXISTS agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id UUID NOT NULL REFERENCES agent_profiles(id),
  trigger_payload JSONB NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  current_step    INT DEFAULT 0,
  total_steps     INT NOT NULL DEFAULT 1,
  result          JSONB,
  error           TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  timeout_at      TIMESTAMPTZ NOT NULL,
  tenant_id       UUID
);
CREATE INDEX idx_agent_runs_profile ON agent_runs(agent_profile_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);

-- Agent 决策日志
CREATE TABLE IF NOT EXISTS agent_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES agent_profiles(id),
  step_number     INT NOT NULL,
  action          VARCHAR(50) NOT NULL,
  action_input    JSONB NOT NULL,
  action_output   JSONB,
  reasoning       TEXT,
  tool_result     JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_decisions_run ON agent_decisions(run_id);

-- Agent 审批记录
CREATE TABLE IF NOT EXISTS agent_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES agent_runs(id),
  agent_id        UUID NOT NULL REFERENCES agent_profiles(id),
  action          VARCHAR(50) NOT NULL,
  action_input    JSONB NOT NULL,
  reason          TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_approvals_run ON agent_approvals(run_id);
CREATE INDEX idx_agent_approvals_status ON agent_approvals(status);

-- Rollback:
-- DROP TABLE IF EXISTS agent_approvals, agent_decisions, agent_runs, agent_profiles;
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/db/migrations/024_create_agent_orchestration_tables.sql
git commit -m "feat(db): add migrations for agent orchestration tables"
```

---

### Task 9: Agent Frontend API Client

**Files:**
- Create: `orion-frontend/src/api/agents.ts`

- [ ] **Step 1: Create the frontend API client**

```typescript
/**
 * Agent API Service
 * AI Agent Workflow Orchestration (Agentic CI)
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export type AgentRole =
  | 'bug_fixer'
  | 'code_fixer'
  | 'test_writer'
  | 'pr_submitter'
  | 'security_patcher'
  | 'doc_writer';

export type AgentRunStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting_approval';

export type AgentAction =
  | 'read_file'
  | 'write_code'
  | 'run_command'
  | 'create_pr'
  | 'request_approval';

export interface AgentToolConfig {
  toolName: string;
  permission: 'read' | 'write' | 'execute';
  config?: Record<string, unknown>;
}

export interface AgentCapabilities {
  maxSteps: number;
  timeoutSec: number;
  retryCount: number;
}

export interface AgentConstraints {
  maxTokens: number;
  allowedBranches: string[];
  forbiddenOperations: string[];
}

export interface AgentLLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  tools: AgentToolConfig[];
  capabilities: AgentCapabilities;
  constraints: AgentConstraints;
  llmConfig: AgentLLMConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDecision {
  id: string;
  runId: string;
  agentId: string;
  stepNumber: number;
  action: AgentAction;
  actionInput: Record<string, unknown>;
  actionOutput?: Record<string, unknown>;
  reasoning: string;
  toolResult?: Record<string, unknown>;
  error?: string;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  agentProfileId: string;
  agentProfileName: string;
  triggerPayload: Record<string, unknown>;
  status: AgentRunStatus;
  currentStep: number;
  totalSteps: number;
  result?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  timeoutAt: string;
  decisions: AgentDecision[];
}

export interface CreateAgentInput {
  name: string;
  role: AgentRole;
  description?: string;
  tools?: AgentToolConfig[];
  capabilities?: Partial<AgentCapabilities>;
  constraints?: Partial<AgentConstraints>;
  llmConfig?: Partial<AgentLLMConfig>;
}

export interface UpdateAgentInput {
  description?: string;
  tools?: AgentToolConfig[];
  capabilities?: Partial<AgentCapabilities>;
  constraints?: Partial<AgentConstraints>;
  llmConfig?: Partial<AgentLLMConfig>;
  enabled?: boolean;
}

export interface TriggerAgentRunInput {
  agentProfileId: string;
  triggerPayload: Record<string, unknown>;
  totalSteps?: number;
}

export interface ExecuteStepInput {
  action: AgentAction;
  actionInput: Record<string, unknown>;
}

// ============================================================================
// Agent Profile APIs
// ============================================================================

/**
 * 创建 Agent Profile
 */
export function createAgent(data: CreateAgentInput) {
  return api.post<AgentProfile>('/agents', data);
}

/**
 * 列出 Agent Profiles
 */
export function getAgents(params?: { role?: string; enabledOnly?: boolean }) {
  return api.get<AgentProfile[]>('/agents', { params });
}

/**
 * 获取 Agent Profile 详情
 */
export function getAgent(id: string) {
  return api.get<AgentProfile>(`/agents/${id}`);
}

/**
 * 更新 Agent Profile
 */
export function updateAgent(id: string, data: UpdateAgentInput) {
  return api.put<AgentProfile>(`/agents/${id}`, data);
}

/**
 * 删除 Agent Profile
 */
export function deleteAgent(id: string) {
  return api.delete(`/agents/${id}`);
}

/**
 * 启用/禁用 Agent
 */
export function toggleAgent(id: string) {
  return api.patch<AgentProfile>(`/agents/${id}/toggle`);
}

// ============================================================================
// Agent Run APIs
// ============================================================================

/**
 * 手动触发 Agent 运行
 */
export function triggerAgentRun(data: TriggerAgentRunInput) {
  return api.post<AgentRun>('/agent-runs', data);
}

/**
 * 执行 Agent 步骤
 */
export function executeAgentStep(runId: string, data: ExecuteStepInput) {
  return api.post<AgentDecision>(`/agent-runs/${runId}/step`, data);
}

/**
 * 列出 Agent 运行
 */
export function getAgentRuns(params?: { agentProfileId?: string; status?: AgentRunStatus }) {
  return api.get<AgentRun[]>('/agent-runs', { params });
}

/**
 * 获取 Agent 运行详情
 */
export function getAgentRun(id: string) {
  return api.get<AgentRun>(`/agent-runs/${id}`);
}

/**
 * 取消 Agent 运行
 */
export function cancelAgentRun(id: string) {
  return api.post<AgentRun>(`/agent-runs/${id}/cancel`);
}

/**
 * 重试 Agent 运行
 */
export function retryAgentRun(id: string) {
  return api.post<AgentRun>(`/agent-runs/${id}/retry`);
}

/**
 * 获取运行决策日志
 */
export function getAgentDecisions(runId: string) {
  return api.get<AgentDecision[]>(`/agent-runs/${runId}/decisions`);
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/api/agents.ts
git commit -m "feat(frontend): add Agent API client with types and functions"
```

---

### Task 10: Agent Dashboard Page

**Files:**
- Create: `orion-frontend/src/pages/AgentDashboard/index.tsx`

- [ ] **Step 1: Create the Agent Dashboard page**

```typescript
/**
 * Agent Dashboard Page
 * - Agent profile list table
 * - Create agent modal
 * - Trigger agent run
 * - Run history
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Table,
  message,
  Card,
  Descriptions,
  Drawer,
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  getAgents,
  createAgent,
  deleteAgent,
  toggleAgent,
  triggerAgentRun,
  getAgentRuns,
  type AgentProfile,
  type AgentRole,
  type AgentRun,
  type AgentRunStatus,
  type CreateAgentInput,
} from '@/api/agents';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const roleLabels: Record<AgentRole, string> = {
  bug_fixer: 'Bug Fixer',
  code_fixer: 'Code Fixer',
  test_writer: 'Test Writer',
  pr_submitter: 'PR Submitter',
  security_patcher: 'Security Patcher',
  doc_writer: 'Doc Writer',
};

const runStatusColors: Record<AgentRunStatus, string> = {
  running: 'blue',
  completed: 'green',
  failed: 'red',
  cancelled: 'default',
  waiting_approval: 'orange',
};

const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({
  value,
  label,
}));

const AgentDashboard: React.FC = () => {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [agentsRes, runsRes] = await Promise.all([
        getAgents(),
        getAgentRuns(),
      ]);
      setAgents(agentsRes.data.data || []);
      setRuns(runsRes.data.data || []);
    } catch (err) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: CreateAgentInput) => {
    try {
      await createAgent({
        name: values.name,
        role: values.role,
        description: values.description || '',
        tools: [
          { toolName: 'read_file', permission: 'read' },
          { toolName: 'run_command', permission: 'execute' },
        ],
      });
      message.success('Agent created');
      setCreateModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create agent');
    }
  };

  const handleToggle = async (agent: AgentProfile) => {
    try {
      await toggleAgent(agent.id);
      message.success(`Agent ${agent.enabled ? 'disabled' : 'enabled'}`);
      fetchData();
    } catch (err) {
      message.error('Failed to toggle agent');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAgent(id);
      message.success('Agent deleted');
      fetchData();
    } catch (err) {
      message.error('Failed to delete agent');
    }
  };

  const handleTriggerRun = async (agent: AgentProfile) => {
    try {
      await triggerAgentRun({
        agentProfileId: agent.id,
        triggerPayload: { manual: true, triggeredAt: new Date().toISOString() },
        totalSteps: 1,
      });
      message.success('Agent run triggered');
      fetchData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to trigger run');
    }
  };

  const agentColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: AgentRole) => <Tag>{roleLabels[role]}</Tag>,
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: AgentProfile) => (
        <Switch checked={enabled} onChange={() => handleToggle(record)} />
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: AgentProfile) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleTriggerRun(record)}
          >
            Run
          </Button>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedAgent(record);
              setDetailDrawerVisible(true);
            }}
          >
            Detail
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const runColumns = [
    {
      title: 'Agent',
      dataIndex: 'agentProfileName',
      key: 'agentProfileName',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: AgentRunStatus) => (
        <Tag color={runStatusColors[status]}>{status}</Tag>
      ),
    },
    {
      title: 'Step',
      key: 'step',
      render: (_: unknown, record: AgentRun) => (
        <Text>{record.currentStep}/{record.totalSteps}</Text>
      ),
    },
    {
      title: 'Started',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3}>AI Agent Orchestration</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            Create Agent
          </Button>
        </div>

        <Card title="Agent Profiles" extra={
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Refresh
          </Button>
        }>
          <Table
            columns={agentColumns}
            dataSource={agents}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </Card>

        <Card title="Recent Runs">
          <Table
            columns={runColumns}
            dataSource={runs.slice(0, 10)}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </Card>
      </Space>

      {/* Create Agent Modal */}
      <Modal
        title="Create Agent Profile"
        open={createModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setCreateModalVisible(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., BugFixer" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={roleOptions} placeholder="Select role" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="What does this agent do?" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Agent Detail Drawer */}
      <Drawer
        title="Agent Profile Details"
        width={500}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {selectedAgent && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Name">{selectedAgent.name}</Descriptions.Item>
            <Descriptions.Item label="Role">{roleLabels[selectedAgent.role]}</Descriptions.Item>
            <Descriptions.Item label="Description">{selectedAgent.description}</Descriptions.Item>
            <Descriptions.Item label="LLM Model">{selectedAgent.llmConfig.model}</Descriptions.Item>
            <Descriptions.Item label="Temperature">{selectedAgent.llmConfig.temperature}</Descriptions.Item>
            <Descriptions.Item label="Max Steps">{selectedAgent.capabilities.maxSteps}</Descriptions.Item>
            <Descriptions.Item label="Timeout">{selectedAgent.capabilities.timeoutSec}s</Descriptions.Item>
            <Descriptions.Item label="Tools">
              {selectedAgent.tools.map((t) => (
                <Tag key={t.toolName}>{t.toolName} ({t.permission})</Tag>
              ))}
            </Descriptions.Item>
            <Descriptions.Item label="Forbidden Operations">
              {selectedAgent.constraints.forbiddenOperations.map((op) => (
                <Tag key={op} color="red">{op}</Tag>
              ))}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default AgentDashboard;
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/pages/AgentDashboard/index.tsx
git commit -m "feat(frontend): add Agent Dashboard page with CRUD and run triggering"
```

---

### Task 11: Agent Run Detail Page

**Files:**
- Create: `orion-frontend/src/pages/AgentRunDetail/index.tsx`

- [ ] **Step 1: Create the Agent Run Detail page with decision timeline**

```typescript
/**
 * Agent Run Detail Page
 * - Run status and metadata
 * - Decision timeline
 * - Actions (cancel, retry)
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  Descriptions,
  Tag,
  Space,
  Button,
  Timeline,
  Empty,
  message,
  Spin,
} from 'antd';
import {
  StopOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {
  getAgentRun,
  cancelAgentRun,
  retryAgentRun,
  type AgentRun,
  type AgentRunStatus,
  type AgentDecision,
  type AgentAction,
} from '@/api/agents';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const statusIcons: Record<AgentRunStatus, React.ReactNode> = {
  running: <LoadingOutlined style={{ color: '#1890ff' }} />,
  completed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  failed: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  cancelled: <CloseCircleOutlined style={{ color: '#8c8c8c' }} />,
  waiting_approval: <LoadingOutlined style={{ color: '#faad14' }} />,
};

const statusColors: Record<AgentRunStatus, string> = {
  running: 'blue',
  completed: 'green',
  failed: 'red',
  cancelled: 'default',
  waiting_approval: 'orange',
};

const actionLabels: Record<AgentAction, string> = {
  read_file: 'Read File',
  write_code: 'Write Code',
  run_command: 'Run Command',
  create_pr: 'Create PR',
  request_approval: 'Request Approval',
};

const AgentRunDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) fetchRun();
  }, [id]);

  const fetchRun = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getAgentRun(id);
      setRun(res.data.data);
    } catch (err) {
      message.error('Failed to fetch run details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelAgentRun(id);
      message.success('Run cancelled');
      fetchRun();
    } catch (err) {
      message.error('Failed to cancel run');
    }
  };

  const handleRetry = async () => {
    if (!id) return;
    try {
      const res = await retryAgentRun(id);
      message.success('Run retried');
      navigate(`/agent-runs/${res.data.data.id}`);
    } catch (err) {
      message.error('Failed to retry');
    }
  };

  if (!id) return <Empty description="No run ID provided" />;

  return (
    <div style={{ padding: 24 }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        Back
      </Button>

      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card
            title={
              <Space>
                {run && statusIcons[run.status]}
                <Title level={4} style={{ margin: 0 }}>
                  Agent Run: {id}
                </Title>
                <Tag color={run ? statusColors[run.status] : 'default'}>
                  {run?.status}
                </Tag>
              </Space>
            }
            extra={
              run && (
                <Space>
                  {run.status === 'running' && (
                    <Button danger icon={<StopOutlined />} onClick={handleCancel}>
                      Cancel
                    </Button>
                  )}
                  {(run.status === 'failed' || run.status === 'cancelled') && (
                    <Button icon={<ReloadOutlined />} onClick={handleRetry}>
                      Retry
                    </Button>
                  )}
                </Space>
              )
            }
          >
            {run && (
              <Descriptions column={2} bordered>
                <Descriptions.Item label="Agent">{run.agentProfileName}</Descriptions.Item>
                <Descriptions.Item label="Steps">{run.currentStep}/{run.totalSteps}</Descriptions.Item>
                <Descriptions.Item label="Started">{dayjs(run.startedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                <Descriptions.Item label="Timeout">{dayjs(run.timeoutAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                {run.completedAt && (
                  <Descriptions.Item label="Completed">{dayjs(run.completedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                )}
                {run.error && (
                  <Descriptions.Item label="Error" span={2}>
                    <Text type="danger">{run.error}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}
          </Card>

          <Card title="Decision Timeline">
            {run && run.decisions.length > 0 ? (
              <Timeline
                items={run.decisions.map((d: AgentDecision) => ({
                  color: d.error ? 'red' : 'blue',
                  children: (
                    <Card size="small" style={{ marginBottom: 8 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space>
                          <Tag>{actionLabels[d.action]}</Tag>
                          <Text type="secondary">Step {d.stepNumber}</Text>
                          <Text type="secondary">{dayjs(d.createdAt).format('HH:mm:ss')}</Text>
                          {d.error && <Tag color="red">Failed</Tag>}
                          {!d.error && d.toolResult && <Tag color="green">Completed</Tag>}
                        </Space>
                        <Paragraph ellipsis={{ rows: 2 }}>{d.reasoning}</Paragraph>
                        {d.toolResult && (
                          <Card size="small" title="Tool Result" style={{ background: '#f5f5f5' }}>
                            <pre style={{ margin: 0, fontSize: 12, maxHeight: 100, overflow: 'auto' }}>
                              {JSON.stringify(d.toolResult, null, 2)}
                            </pre>
                          </Card>
                        )}
                        {d.error && (
                          <Text type="danger">Error: {d.error}</Text>
                        )}
                      </Space>
                    </Card>
                  ),
                }))}
              />
            ) : (
              <Empty description="No decisions recorded yet" />
            )}
          </Card>
        </Space>
      </Spin>
    </div>
  );
};

export default AgentRunDetail;
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/pages/AgentRunDetail/index.tsx
git commit -m "feat(frontend): add Agent Run Detail page with decision timeline"
```

---

### Task 12: Agent Frontend Route Registration

**Files:**
- Modify: `orion-frontend/src/router/routes.ts`

- [ ] **Step 1: Add agent routes to the router**

Read the current `routes.ts` and add these entries before the 404 catch-all (`{ path: '*', ... }`):

```typescript
  // AI Agent Orchestration
  {
    path: '/agents',
    element: React.lazy(() => import('@/pages/AgentDashboard')),
    protected: true,
  },
  {
    path: '/agents/:id',
    element: React.lazy(() => import('@/pages/AgentRunDetail')),
    protected: true,
  },
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/router/routes.ts
git commit -m "feat(frontend): register Agent Dashboard and Run Detail routes"
```

---

## FEATURE 2: Ephemeral Development Environments

### Task 13: Ephemeral Environment Model

**Files:**
- Create: `orion-platform-service/src/models/EphemeralEnvironment.ts`

- [ ] **Step 1: Create the EphemeralEnvironment model**

```typescript
/**
 * Ephemeral Environment 数据模型
 *
 * 定义临时开发环境的生命周期：
 * - Namespace 创建、服务部署、Preview URL 生成
 * - 环境状态管理和自动销毁
 */

import { v4 as uuidv4 } from 'uuid';

export type EphemeralEnvStatus =
  | 'provisioning'
  | 'running'
  | 'idle'
  | 'tearing_down'
  | 'destroyed';

export interface EphemeralResourceConfig {
  cpu: string;
  memory: string;
  storage: string;
}

export interface EphemeralService {
  name: string;
  image: string;
  replicas: number;
  healthy: boolean;
}

export interface EphemeralEnvironment {
  id: string;
  prId: string;
  repoId: string;
  branchName: string;
  namespace: string;
  status: EphemeralEnvStatus;
  previewUrl?: string;
  commitSha?: string;
  resources: EphemeralResourceConfig;
  services: EphemeralService[];
  createdBy?: string;
  createdAt: Date;
  idleSince?: Date;
  autoDestroyAt?: Date;
  destroyedAt?: Date;
  destroyReason?: string;
}

export interface EphemeralEnvCreateInput {
  prId: string;
  repoId: string;
  branchName: string;
  commitSha?: string;
  templateId?: string;
  createdBy?: string;
}

const DEFAULT_RESOURCES: EphemeralResourceConfig = {
  cpu: '2',
  memory: '4Gi',
  storage: '10Gi',
};

function generateNamespace(prId: string, repoId: string): string {
  const sanitizedRepo = repoId.replace(/[^a-z0-9-]/g, '').substring(0, 30);
  const sanitizedPr = prId.replace(/[^a-z0-9-]/g, '').substring(0, 20);
  const hash = uuidv4().substring(0, 6);
  return `eph-${sanitizedRepo}-${sanitizedPr}-${hash}`.substring(0, 63);
}

function generatePreviewUrl(namespace: string): string {
  return `https://${namespace}.dev.orion.internal`;
}

export function createEphemeralEnvironment(
  input: EphemeralEnvCreateInput
): EphemeralEnvironment {
  const now = new Date();
  const namespace = generateNamespace(input.prId, input.repoId);

  return {
    id: uuidv4(),
    prId: input.prId,
    repoId: input.repoId,
    branchName: input.branchName,
    namespace,
    status: 'provisioning',
    previewUrl: generatePreviewUrl(namespace),
    commitSha: input.commitSha,
    resources: DEFAULT_RESOURCES,
    services: [],
    createdBy: input.createdBy,
    createdAt: now,
    autoDestroyAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24h default
  };
}

export function markRunning(env: EphemeralEnvironment, services: EphemeralService[]): void {
  env.status = 'running';
  env.services = services;
}

export function markIdle(env: EphemeralEnvironment): void {
  env.status = 'idle';
  env.idleSince = new Date();
}

export function markTearingDown(env: EphemeralEnvironment, reason: string): void {
  env.status = 'tearing_down';
  env.destroyReason = reason;
}

export function markDestroyed(env: EphemeralEnvironment, reason: string): void {
  env.status = 'destroyed';
  env.destroyReason = reason;
  env.destroyedAt = new Date();
}

export function wakeEnvironment(env: EphemeralEnvironment): void {
  env.status = 'running';
  env.idleSince = undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/models/EphemeralEnvironment.ts
git commit -m "feat(ephemeral): add EphemeralEnvironment model with lifecycle management"
```

---

### Task 14: K8s Provisioner Service (Mock MVP)

**Files:**
- Create: `orion-platform-service/src/services/k8s-provisioner-service.ts`

- [ ] **Step 1: Create the K8s provisioner with mock namespace/deployment/teardown**

```typescript
/**
 * K8s Provisioner Service
 *
 * 负责 K8s Namespace 创建、服务部署、销毁
 *
 * MVP: 模拟实现，返回模拟结果。实际实现需要 @kubernetes/client-node
 */

import pino from 'pino';
import { EphemeralEnvironment, EphemeralService } from '../models/EphemeralEnvironment';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ProvisionResult {
  namespace: string;
  services: EphemeralService[];
  previewUrl: string;
}

export class K8sProvisionerService {
  private namespaces: Map<string, boolean> = new Map();

  /**
   * 创建 Namespace 并部署服务
   */
  async provision(env: EphemeralEnvironment): Promise<ProvisionResult> {
    logger.info(
      { namespace: env.namespace, prId: env.prId },
      'Provisioning ephemeral environment'
    );

    // Create namespace
    this.namespaces.set(env.namespace, true);
    logger.info({ namespace: env.namespace }, 'Namespace created');

    // Deploy services (MVP: mock frontend + backend)
    const services: EphemeralService[] = [
      {
        name: 'frontend',
        image: `orion-frontend:${env.branchName}`,
        replicas: 1,
        healthy: true,
      },
      {
        name: 'backend',
        image: `orion-backend:${env.branchName}`,
        replicas: 1,
        healthy: true,
      },
    ];

    // Simulate deployment time
    await new Promise((r) => setTimeout(r, 100));

    logger.info(
      { namespace: env.namespace, services: services.map((s) => s.name) },
      'Services deployed'
    );

    return {
      namespace: env.namespace,
      services,
      previewUrl: env.previewUrl || `https://${env.namespace}.dev.orion.internal`,
    };
  }

  /**
   * 检查环境健康状态
   */
  async checkHealth(namespace: string): Promise<boolean> {
    return this.namespaces.get(namespace) || false;
  }

  /**
   * 销毁 Namespace 和所有资源
   */
  async teardown(namespace: string): Promise<void> {
    logger.info({ namespace }, 'Tearing down ephemeral environment');

    // Simulate teardown time
    await new Promise((r) => setTimeout(r, 100));

    this.namespaces.delete(namespace);
    logger.info({ namespace }, 'Namespace and resources destroyed');
  }

  /**
   * 列出所有活跃 namespace
   */
  listActiveNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/services/k8s-provisioner-service.ts
git commit -m "feat(ephemeral): add K8sProvisionerService with mock namespace management"
```

---

### Task 15: Ephemeral Environment Service

**Files:**
- Create: `orion-platform-service/src/services/ephemeral-env-service.ts`

- [ ] **Step 1: Create the EphemeralEnvironmentService**

```typescript
/**
 * Ephemeral Environment Service
 *
 * 负责临时开发环境的完整生命周期：
 * - 创建环境（Namespace + 服务部署）
 * - 查询环境列表和详情
 * - 唤醒空闲环境
 * - 销毁环境
 */

import pino from 'pino';
import {
  EphemeralEnvironment,
  EphemeralEnvCreateInput,
  EphemeralEnvStatus,
  createEphemeralEnvironment,
  markRunning,
  markIdle,
  markTearingDown,
  markDestroyed,
  wakeEnvironment,
} from '../models/EphemeralEnvironment';
import { K8sProvisionerService } from './k8s-provisioner-service';
import { EventBusService } from './event-bus-service';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class EphemeralEnvService {
  private environments: Map<string, EphemeralEnvironment> = new Map();
  private k8sProvisioner: K8sProvisionerService;
  private eventBus?: EventBusService;

  constructor(options: {
    k8sProvisioner: K8sProvisionerService;
    eventBus?: EventBusService;
  }) {
    this.k8sProvisioner = options.k8sProvisioner;
    this.eventBus = options.eventBus;
  }

  /**
   * 创建临时环境
   */
  async create(input: EphemeralEnvCreateInput): Promise<EphemeralEnvironment> {
    logger.info(
      { prId: input.prId, repoId: input.repoId, branch: input.branchName },
      'Creating ephemeral environment'
    );

    // Check for duplicate PR
    const existing = Array.from(this.environments.values()).find(
      (e) => e.prId === input.prId && e.repoId === input.repoId && e.status !== 'destroyed'
    );
    if (existing) {
      throw new Error(
        `Ephemeral environment already exists for PR ${input.prId} in ${input.repoId} (status: ${existing.status})`
      );
    }

    const env = createEphemeralEnvironment(input);
    this.environments.set(env.id, env);

    await this.publishEvent('ephemeral-env.created', {
      envId: env.id,
      prId: env.prId,
      namespace: env.namespace,
    });

    // Provision K8s resources
    try {
      const result = await this.k8sProvisioner.provision(env);
      markRunning(env, result.services);
      env.previewUrl = result.previewUrl;

      await this.publishEvent('ephemeral-env.provisioned', {
        envId: env.id,
        previewUrl: env.previewUrl,
      });

      logger.info(
        { envId: env.id, previewUrl: env.previewUrl },
        'Ephemeral environment provisioned'
      );
    } catch (error) {
      logger.error({ envId: env.id, error }, 'Provisioning failed');
      markTearingDown(env, 'provisioning_failed');
      markDestroyed(env, 'provisioning_failed');
      throw error;
    }

    return env;
  }

  /**
   * 列出环境
   */
  async list(options?: {
    prId?: string;
    repoId?: string;
    statusFilter?: EphemeralEnvStatus;
  }): Promise<EphemeralEnvironment[]> {
    let envs = Array.from(this.environments.values());

    if (options?.prId) {
      envs = envs.filter((e) => e.prId === options.prId);
    }

    if (options?.repoId) {
      envs = envs.filter((e) => e.repoId === options.repoId);
    }

    if (options?.statusFilter) {
      envs = envs.filter((e) => e.status === options.statusFilter);
    }

    envs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return envs;
  }

  /**
   * 获取环境详情
   */
  async getById(id: string): Promise<EphemeralEnvironment> {
    const env = this.environments.get(id);
    if (!env) {
      throw new Error(`Ephemeral environment "${id}" not found`);
    }
    return env;
  }

  /**
   * 唤醒空闲环境
   */
  async wake(id: string): Promise<EphemeralEnvironment> {
    const env = this.environments.get(id);
    if (!env) {
      throw new Error(`Ephemeral environment "${id}" not found`);
    }

    if (env.status !== 'idle') {
      throw new Error(`Environment is not idle (status: ${env.status})`);
    }

    wakeEnvironment(env);

    await this.publishEvent('ephemeral-env.woken', { envId: env.id });
    logger.info({ envId: env.id }, 'Environment woken up');
    return env;
  }

  /**
   * 销毁环境
   */
  async teardown(id: string, reason: string = 'manual'): Promise<EphemeralEnvironment> {
    const env = this.environments.get(id);
    if (!env) {
      throw new Error(`Ephemeral environment "${id}" not found`);
    }

    if (env.status === 'destroyed') {
      throw new Error(`Environment already destroyed`);
    }

    markTearingDown(env, reason);

    // Teardown K8s resources
    await this.k8sProvisioner.teardown(env.namespace);

    markDestroyed(env, reason);

    await this.publishEvent('ephemeral-env.destroyed', {
      envId: env.id,
      reason,
      namespace: env.namespace,
    });

    logger.info({ envId: env.id, reason }, 'Environment destroyed');
    return env;
  }

  /**
   * 自动销毁空闲超时的环境
   */
  async cleanupIdleEnvironments(maxIdleHours: number = 2): Promise<string[]> {
    const idleEnvs = Array.from(this.environments.values()).filter(
      (e) => e.status === 'idle' && e.idleSince
    );

    const cutoff = new Date(Date.now() - maxIdleHours * 60 * 60 * 1000);
    const toDestroy = idleEnvs.filter((e) => e.idleSince! < cutoff);

    const destroyed: string[] = [];
    for (const env of toDestroy) {
      try {
        await this.teardown(env.id, 'idle_timeout');
        destroyed.push(env.id);
      } catch (error) {
        logger.error({ envId: env.id, error }, 'Failed to cleanup idle environment');
      }
    }

    return destroyed;
  }

  /**
   * 获取 Preview URL
   */
  async getPreviewUrl(id: string): Promise<string> {
    const env = await this.getById(id);
    if (!env.previewUrl) {
      throw new Error('Preview URL not available');
    }
    return env.previewUrl;
  }

  /**
   * 检查环境健康
   */
  async checkHealth(id: string): Promise<{ healthy: boolean; message: string }> {
    const env = await this.getById(id);
    const nsHealthy = await this.k8sProvisioner.checkHealth(env.namespace);

    return {
      healthy: nsHealthy && env.status === 'running',
      message: nsHealthy ? 'All services healthy' : 'Namespace not found',
    };
  }

  /**
   * 发布事件
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventBus) {
      try {
        await this.eventBus.publish(type, data, { source: 'ephemeral-env-service' });
      } catch (err) {
        logger.error({ err }, 'Failed to publish ephemeral-env event');
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/services/ephemeral-env-service.ts
git commit -m "feat(ephemeral): add EphemeralEnvService with full lifecycle management"
```

---

### Task 16: Ephemeral Environment Controller

**Files:**
- Create: `orion-platform-service/src/api/controllers/EphemeralEnvController.ts`

- [ ] **Step 1: Create the EphemeralEnvController**

```typescript
/**
 * Ephemeral Environment Controller
 *
 * 处理临时开发环境相关的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { EphemeralEnvService } from '../../services/ephemeral-env-service';
import { EphemeralEnvStatus } from '../../models/EphemeralEnvironment';

export class EphemeralEnvController {
  private service: EphemeralEnvService;

  constructor(service: EphemeralEnvService) {
    this.service = service;
  }

  /**
   * 创建临时环境
   * POST /api/v1/ephemeral-envs
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;

      if (!body.prId || !body.repoId || !body.branchName) {
        await reply.status(400).send({
          success: false,
          error: 'prId, repoId, and branchName are required',
        });
        return;
      }

      const env = await this.service.create({
        prId: body.prId,
        repoId: body.repoId,
        branchName: body.branchName,
        commitSha: body.commitSha,
        templateId: body.templateId,
        createdBy: body.createdBy,
      });

      await reply.status(201).send({
        success: true,
        data: env,
        message: `Ephemeral environment created: ${env.previewUrl}`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create environment',
      });
    }
  }

  /**
   * 列出环境
   * GET /api/v1/ephemeral-envs
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const envs = await this.service.list({
        prId: query.prId,
        repoId: query.repoId,
        statusFilter: query.status as EphemeralEnvStatus | undefined,
      });

      await reply.send({
        success: true,
        data: envs,
        total: envs.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list environments',
      });
    }
  }

  /**
   * 获取环境详情
   * GET /api/v1/ephemeral-envs/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const env = await this.service.getById(params.id);

      await reply.send({
        success: true,
        data: env,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Environment not found',
      });
    }
  }

  /**
   * 唤醒空闲环境
   * POST /api/v1/ephemeral-envs/:id/wake
   */
  async wake(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const env = await this.service.wake(params.id);

      await reply.send({
        success: true,
        data: env,
        message: 'Environment woken up',
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to wake environment',
      });
    }
  }

  /**
   * 销毁环境
   * POST /api/v1/ephemeral-envs/:id/teardown
   */
  async teardown(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const env = await this.service.teardown(params.id, body?.reason || 'manual');

      await reply.send({
        success: true,
        data: env,
        message: 'Environment destroyed',
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to destroy environment',
      });
    }
  }

  /**
   * 获取 Preview URL
   * GET /api/v1/ephemeral-envs/:id/preview
   */
  async getPreviewUrl(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const url = await this.service.getPreviewUrl(params.id);

      await reply.send({
        success: true,
        data: { url },
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Preview URL not available',
      });
    }
  }

  /**
   * 健康检查
   * GET /api/v1/ephemeral-envs/:id/status
   */
  async checkHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const health = await this.service.checkHealth(params.id);

      await reply.send({
        success: true,
        data: health,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Environment not found',
      });
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/api/controllers/EphemeralEnvController.ts
git commit -m "feat(ephemeral): add EphemeralEnvController with HTTP handlers"
```

---

### Task 17: Ephemeral Environment Route Registration

**Files:**
- Create: `orion-platform-service/src/routes-ephemeral-env.ts`

- [ ] **Step 1: Create the route registration file**

```typescript
/**
 * Ephemeral Development Environments API Routes (Fastify 版本)
 *
 * 临时开发环境相关的 API 路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { K8sProvisionerService } from './services/k8s-provisioner-service';
import { EphemeralEnvService } from './services/ephemeral-env-service';
import { EphemeralEnvController } from './api/controllers/EphemeralEnvController';
import { EventBusService } from './services/event-bus-service';

export interface EphemeralEnvRoutesOptions {
  eventBus?: EventBusService;
}

/**
 * 注册 Ephemeral Environment 路由
 */
export default async function registerEphemeralEnvRoutes(
  app: FastifyInstance,
  options: EphemeralEnvRoutesOptions
): Promise<void> {
  // 初始化服务
  const k8sProvisioner = new K8sProvisionerService();
  const ephemeralEnvService = new EphemeralEnvService({
    k8sProvisioner,
    eventBus: options.eventBus,
  });

  // 初始化控制器
  const controller = new EphemeralEnvController(ephemeralEnvService);

  // ==================== Ephemeral Environment 路由 ====================

  // POST /api/v1/ephemeral-envs - 创建环境
  app.post('/ephemeral-envs', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.create(request, reply)
  );

  // GET /api/v1/ephemeral-envs - 环境列表
  app.get('/ephemeral-envs', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.list(request, reply)
  );

  // GET /api/v1/ephemeral-envs/:id - 环境详情
  app.get('/ephemeral-envs/:id', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.getById(request, reply)
  );

  // POST /api/v1/ephemeral-envs/:id/wake - 唤醒空闲环境
  app.post('/ephemeral-envs/:id/wake', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.wake(request, reply)
  );

  // POST /api/v1/ephemeral-envs/:id/teardown - 销毁环境
  app.post('/ephemeral-envs/:id/teardown', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.teardown(request, reply)
  );

  // GET /api/v1/ephemeral-envs/:id/preview - 获取 Preview URL
  app.get('/ephemeral-envs/:id/preview', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.getPreviewUrl(request, reply)
  );

  // GET /api/v1/ephemeral-envs/:id/status - 健康检查
  app.get('/ephemeral-envs/:id/status', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.checkHealth(request, reply)
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/routes-ephemeral-env.ts
git commit -m "feat(ephemeral): register Ephemeral Environment API routes"
```

---

### Task 18: Ephemeral Environment DB Migration

**Files:**
- Create: `orion-platform-service/src/db/migrations/025_create_ephemeral_env_tables.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 025: Ephemeral Development Environments Tables
-- Creates tables for ephemeral environment management, templates, and data seeding

-- 临时环境
CREATE TABLE IF NOT EXISTS ephemeral_environments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id           VARCHAR(100) NOT NULL,
  repo_id         VARCHAR(100) NOT NULL,
  branch_name     VARCHAR(255) NOT NULL,
  namespace       VARCHAR(63) NOT NULL UNIQUE,
  template_id     UUID,
  status          VARCHAR(20) NOT NULL DEFAULT 'provisioning',
  preview_url     VARCHAR(255),
  commit_sha      VARCHAR(40),
  resources       JSONB,
  services        JSONB DEFAULT '[]',
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  idle_since      TIMESTAMPTZ,
  auto_destroy_at TIMESTAMPTZ,
  destroyed_at    TIMESTAMPTZ,
  destroy_reason  VARCHAR(100)
);
CREATE INDEX idx_eph_env_pr ON ephemeral_environments(pr_id, repo_id);
CREATE INDEX idx_eph_env_status ON ephemeral_environments(status);

-- 环境模板
CREATE TABLE IF NOT EXISTS environment_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL UNIQUE,
  description      TEXT,
  services         JSONB NOT NULL,
  dependencies     JSONB,
  data_seed_config JSONB,
  network_policies JSONB,
  resource_limits  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rollback:
-- DROP TABLE IF EXISTS environment_templates, ephemeral_environments;
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/db/migrations/025_create_ephemeral_env_tables.sql
git commit -m "feat(db): add migrations for ephemeral environments tables"
```

---

### Task 19: Ephemeral Environment Frontend API Client

**Files:**
- Create: `orion-frontend/src/api/ephemeral-envs.ts`

- [ ] **Step 1: Create the frontend API client**

```typescript
/**
 * Ephemeral Environments API Service
 * Automatic PR-based development environments
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export type EphemeralEnvStatus =
  | 'provisioning'
  | 'running'
  | 'idle'
  | 'tearing_down'
  | 'destroyed';

export interface EphemeralResourceConfig {
  cpu: string;
  memory: string;
  storage: string;
}

export interface EphemeralService {
  name: string;
  image: string;
  replicas: number;
  healthy: boolean;
}

export interface EphemeralEnvironment {
  id: string;
  prId: string;
  repoId: string;
  branchName: string;
  namespace: string;
  status: EphemeralEnvStatus;
  previewUrl?: string;
  commitSha?: string;
  resources: EphemeralResourceConfig;
  services: EphemeralService[];
  createdBy?: string;
  createdAt: string;
  idleSince?: string;
  autoDestroyAt?: string;
  destroyedAt?: string;
  destroyReason?: string;
}

export interface CreateEphemeralEnvInput {
  prId: string;
  repoId: string;
  branchName: string;
  commitSha?: string;
  templateId?: string;
}

// ============================================================================
// Ephemeral Environment APIs
// ============================================================================

/**
 * 创建临时环境
 */
export function createEphemeralEnv(data: CreateEphemeralEnvInput) {
  return api.post<EphemeralEnvironment>('/ephemeral-envs', data);
}

/**
 * 列出环境
 */
export function getEphemeralEnvs(params?: {
  prId?: string;
  repoId?: string;
  status?: EphemeralEnvStatus;
}) {
  return api.get<EphemeralEnvironment[]>('/ephemeral-envs', { params });
}

/**
 * 获取环境详情
 */
export function getEphemeralEnv(id: string) {
  return api.get<EphemeralEnvironment>(`/ephemeral-envs/${id}`);
}

/**
 * 唤醒空闲环境
 */
export function wakeEphemeralEnv(id: string) {
  return api.post<EphemeralEnvironment>(`/ephemeral-envs/${id}/wake`);
}

/**
 * 销毁环境
 */
export function teardownEphemeralEnv(id: string, reason?: string) {
  return api.post<EphemeralEnvironment>(`/ephemeral-envs/${id}/teardown`, { reason });
}

/**
 * 获取 Preview URL
 */
export function getPreviewUrl(id: string) {
  return api.get<{ url: string }>(`/ephemeral-envs/${id}/preview`);
}

/**
 * 健康检查
 */
export function checkEnvHealth(id: string) {
  return api.get<{ healthy: boolean; message: string }>(`/ephemeral-envs/${id}/status`);
}
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/api/ephemeral-envs.ts
git commit -m "feat(frontend): add Ephemeral Environments API client"
```

---

### Task 20: Ephemeral Environment List Page

**Files:**
- Create: `orion-frontend/src/pages/EphemeralEnvList/index.tsx`

- [ ] **Step 1: Create the Ephemeral Environment List page**

```typescript
/**
 * Ephemeral Environment List Page
 * - Table of environments with PR, repo, status, preview URL, actions
 * - Create environment modal
 * - Status filtering
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Table,
  message,
  Card,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PoweroffOutlined,
  ThunderboltOutlined,
  LinkOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  getEphemeralEnvs,
  createEphemeralEnv,
  teardownEphemeralEnv,
  wakeEphemeralEnv,
  type EphemeralEnvironment,
  type EphemeralEnvStatus,
  type CreateEphemeralEnvInput,
} from '@/api/ephemeral-envs';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const statusColors: Record<EphemeralEnvStatus, string> = {
  provisioning: 'processing',
  running: 'success',
  idle: 'warning',
  tearing_down: 'default',
  destroyed: 'error',
};

const EphemeralEnvList: React.FC = () => {
  const navigate = useNavigate();
  const [envs, setEnvs] = useState<EphemeralEnvironment[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EphemeralEnvStatus | undefined>(undefined);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getEphemeralEnvs({ status: statusFilter });
      setEnvs(res.data.data || []);
    } catch (err) {
      message.error('Failed to fetch environments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: CreateEphemeralEnvInput) => {
    try {
      await createEphemeralEnv(values);
      message.success('Environment created');
      setCreateModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create environment');
    }
  };

  const handleTeardown = async (id: string) => {
    Modal.confirm({
      title: 'Destroy Environment',
      content: 'This will permanently destroy the ephemeral environment. Continue?',
      okText: 'Destroy',
      okType: 'danger',
      onOk: async () => {
        try {
          await teardownEphemeralEnv(id);
          message.success('Environment destroyed');
          fetchData();
        } catch (err) {
          message.error('Failed to destroy environment');
        }
      },
    });
  };

  const handleWake = async (id: string) => {
    try {
      await wakeEphemeralEnv(id);
      message.success('Environment woken up');
      fetchData();
    } catch (err) {
      message.error('Failed to wake environment');
    }
  };

  const columns = [
    {
      title: 'PR',
      dataIndex: 'prId',
      key: 'prId',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Repo',
      dataIndex: 'repoId',
      key: 'repoId',
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: EphemeralEnvStatus) => (
        <Tag color={statusColors[status]}>{status}</Tag>
      ),
    },
    {
      title: 'Preview URL',
      dataIndex: 'previewUrl',
      key: 'previewUrl',
      render: (url: string) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <LinkOutlined /> {url}
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: EphemeralEnvironment) => (
        <Space>
          {record.status === 'running' && (
            <Button
              type="link"
              icon={<LinkOutlined />}
              href={record.previewUrl}
              target="_blank"
            >
              Open
            </Button>
          )}
          {record.status === 'idle' && (
            <Button
              type="link"
              icon={<ThunderboltOutlined />}
              onClick={() => handleWake(record.id)}
            >
              Wake
            </Button>
          )}
          {record.status !== 'destroyed' && record.status !== 'tearing_down' && (
            <Button
              type="link"
              danger
              icon={<PoweroffOutlined />}
              onClick={() => handleTeardown(record.id)}
            >
              Destroy
            </Button>
          )}
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/ephemeral-envs/${record.id}`)}
          >
            Detail
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={<Title level={4}>Ephemeral Development Environments</Title>}
        extra={
          <Space>
            <Select
              style={{ width: 150 }}
              placeholder="Filter by status"
              allowClear
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              options={[
                { value: 'provisioning', label: 'Provisioning' },
                { value: 'running', label: 'Running' },
                { value: 'idle', label: 'Idle' },
                { value: 'destroyed', label: 'Destroyed' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Create Environment
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={envs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* Create Environment Modal */}
      <Modal
        title="Create Ephemeral Environment"
        open={createModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setCreateModalVisible(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="prId" label="PR ID" rules={[{ required: true }]}>
            <Input placeholder="e.g., PR-123" />
          </Form.Item>
          <Form.Item name="repoId" label="Repository ID" rules={[{ required: true }]}>
            <Input placeholder="e.g., org/my-repo" />
          </Form.Item>
          <Form.Item name="branchName" label="Branch Name" rules={[{ required: true }]}>
            <Input placeholder="e.g., feature/new-endpoint" />
          </Form.Item>
          <Form.Item name="commitSha" label="Commit SHA (optional)">
            <Input placeholder="e.g., abc1234" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EphemeralEnvList;
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/pages/EphemeralEnvList/index.tsx
git commit -m "feat(frontend): add Ephemeral Environment List page with CRUD"
```

---

### Task 21: Ephemeral Environment Detail Page

**Files:**
- Create: `orion-frontend/src/pages/EphemeralEnvDetail/index.tsx`

- [ ] **Step 1: Create the Ephemeral Environment Detail page**

```typescript
/**
 * Ephemeral Environment Detail Page
 * - Environment status and metadata
 * - Services list with health
 * - Preview URL with copy button
 * - Action buttons (wake, teardown)
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Card,
  Descriptions,
  Tag,
  Space,
  Button,
  Table,
  message,
  Spin,
  Empty,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  LinkOutlined,
  PoweroffOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import {
  getEphemeralEnv,
  teardownEphemeralEnv,
  wakeEphemeralEnv,
  checkEnvHealth,
  type EphemeralEnvironment,
  type EphemeralEnvStatus,
  type EphemeralService,
} from '@/api/ephemeral-envs';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const statusColors: Record<EphemeralEnvStatus, string> = {
  provisioning: 'processing',
  running: 'success',
  idle: 'warning',
  tearing_down: 'default',
  destroyed: 'error',
};

const EphemeralEnvDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [env, setEnv] = useState<EphemeralEnvironment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) fetchEnv();
  }, [id]);

  const fetchEnv = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getEphemeralEnv(id);
      setEnv(res.data.data);
    } catch (err) {
      message.error('Failed to fetch environment details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (env?.previewUrl) {
      navigator.clipboard.writeText(env.previewUrl);
      message.success('Preview URL copied to clipboard');
    }
  };

  const handleTeardown = async () => {
    if (!id) return;
    try {
      await teardownEphemeralEnv(id);
      message.success('Environment destroyed');
      navigate('/ephemeral-envs');
    } catch (err) {
      message.error('Failed to destroy environment');
    }
  };

  const handleWake = async () => {
    if (!id) return;
    try {
      await wakeEphemeralEnv(id);
      message.success('Environment woken up');
      fetchEnv();
    } catch (err) {
      message.error('Failed to wake environment');
    }
  };

  const handleHealthCheck = async () => {
    if (!id) return;
    try {
      const res = await checkEnvHealth(id);
      message.info(res.data.data.healthy ? 'Environment is healthy' : res.data.data.message);
    } catch (err) {
      message.error('Health check failed');
    }
  };

  if (!id) return <Empty description="No environment ID provided" />;

  const serviceColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Image', dataIndex: 'image', key: 'image' },
    { title: 'Replicas', dataIndex: 'replicas', key: 'replicas' },
    {
      title: 'Health',
      dataIndex: 'healthy',
      key: 'healthy',
      render: (healthy: boolean) => (
        <Tag color={healthy ? 'green' : 'red'}>{healthy ? 'Healthy' : 'Unhealthy'}</Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        Back
      </Button>

      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {env && env.status === 'destroyed' && (
            <Alert
              message="Environment Destroyed"
              description={`Reason: ${env.destroyReason || 'Unknown'}`}
              type="error"
              showIcon
            />
          )}

          <Card
            title={
              <Space>
                <Title level={4} style={{ margin: 0 }}>
                  Environment: {env?.namespace}
                </Title>
                <Tag color={env ? statusColors[env.status] : 'default'}>
                  {env?.status}
                </Tag>
              </Space>
            }
            extra={
              env && (
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={handleHealthCheck}>
                    Health Check
                  </Button>
                  {env.status === 'idle' && (
                    <Button icon={<ThunderboltOutlined />} onClick={handleWake}>
                      Wake Up
                    </Button>
                  )}
                  {env.status !== 'destroyed' && env.status !== 'tearing_down' && (
                    <Button danger icon={<PoweroffOutlined />} onClick={handleTeardown}>
                      Destroy
                    </Button>
                  )}
                </Space>
              )
            }
          >
            {env && (
              <Descriptions column={2} bordered>
                <Descriptions.Item label="PR ID">{env.prId}</Descriptions.Item>
                <Descriptions.Item label="Repository">{env.repoId}</Descriptions.Item>
                <Descriptions.Item label="Branch">{env.branchName}</Descriptions.Item>
                <Descriptions.Item label="Commit">{env.commitSha || '-'}</Descriptions.Item>
                <Descriptions.Item label="Namespace">{env.namespace}</Descriptions.Item>
                <Descriptions.Item label="Preview URL">
                  {env.previewUrl ? (
                    <Space>
                      <a href={env.previewUrl} target="_blank" rel="noopener noreferrer">
                        <LinkOutlined /> {env.previewUrl}
                      </a>
                      <Button type="link" size="small" icon={<CopyOutlined />} onClick={handleCopyUrl}>
                        Copy
                      </Button>
                    </Space>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="CPU">{env.resources.cpu}</Descriptions.Item>
                <Descriptions.Item label="Memory">{env.resources.memory}</Descriptions.Item>
                <Descriptions.Item label="Created">
                  {dayjs(env.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="Auto Destroy At">
                  {env.autoDestroyAt ? dayjs(env.autoDestroyAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                {env.destroyedAt && (
                  <Descriptions.Item label="Destroyed At">
                    {dayjs(env.destroyedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}
          </Card>

          <Card title="Deployed Services">
            {env && env.services.length > 0 ? (
              <Table
                columns={serviceColumns}
                dataSource={env.services}
                rowKey="name"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="No services deployed" />
            )}
          </Card>
        </Space>
      </Spin>
    </div>
  );
};

export default EphemeralEnvDetail;
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/pages/EphemeralEnvDetail/index.tsx
git commit -m "feat(frontend): add Ephemeral Environment Detail page with services list"
```

---

### Task 22: Ephemeral Environment Frontend Route Registration

**Files:**
- Modify: `orion-frontend/src/router/routes.ts`

- [ ] **Step 1: Add ephemeral env routes to the router**

Add these entries before the 404 catch-all (`{ path: '*', ... }`):

```typescript
  // Ephemeral Development Environments
  {
    path: '/ephemeral-envs',
    element: React.lazy(() => import('@/pages/EphemeralEnvList')),
    protected: true,
  },
  {
    path: '/ephemeral-envs/:id',
    element: React.lazy(() => import('@/pages/EphemeralEnvDetail')),
    protected: true,
  },
```

- [ ] **Step 2: Commit**

```bash
git add orion-frontend/src/router/routes.ts
git commit -m "feat(frontend): register Ephemeral Environment list and detail routes"
```

---

## Final Integration Commit

After both features are complete, register the new route modules in the main Fastify app.

**Files:**
- Modify: `orion-platform-service/src/app.ts` (or the main server entry file)

- [ ] **Step 1: Register agent and ephemeral-env routes in the main app**

Find the existing route registrations in `app.ts` (likely where `registerPluginRoutes` and `buildRoutes` are registered). Add:

```typescript
import registerAgentRoutes from './routes-agent';
import registerEphemeralEnvRoutes from './routes-ephemeral-env';

// In the app setup / server initialization:
await app.register(registerAgentRoutes, { prefix: '/api/v1' });
await app.register(registerEphemeralEnvRoutes, { prefix: '/api/v1' });
```

- [ ] **Step 2: Commit**

```bash
git add orion-platform-service/src/app.ts
git commit -m "feat(backend): register Agent and Ephemeral Environment route modules"
```

---

## Summary

| Task | Feature | Deliverable | Estimated Effort |
|------|---------|-------------|------------------|
| Task 1 | Agent | AgentProfile model | 3 min |
| Task 2 | Agent | AgentRun model | 3 min |
| Task 3 | Agent | AgentProfileService | 5 min |
| Task 4 | Agent | AgentProfileController | 5 min |
| Task 5 | Agent | AgentRunService | 7 min |
| Task 6 | Agent | AgentRunController | 5 min |
| Task 7 | Agent | routes-agent.ts | 3 min |
| Task 8 | Agent | DB migration 024 | 3 min |
| Task 9 | Agent | Frontend API client | 5 min |
| Task 10 | Agent | AgentDashboard page | 7 min |
| Task 11 | Agent | AgentRunDetail page | 7 min |
| Task 12 | Agent | Route registration | 2 min |
| Task 13 | Ephemeral | EphemeralEnvironment model | 3 min |
| Task 14 | Ephemeral | K8sProvisionerService | 5 min |
| Task 15 | Ephemeral | EphemeralEnvService | 7 min |
| Task 16 | Ephemeral | EphemeralEnvController | 5 min |
| Task 17 | Ephemeral | routes-ephemeral-env.ts | 3 min |
| Task 18 | Ephemeral | DB migration 025 | 3 min |
| Task 19 | Ephemeral | Frontend API client | 5 min |
| Task 20 | Ephemeral | EphemeralEnvList page | 7 min |
| Task 21 | Ephemeral | EphemeralEnvDetail page | 7 min |
| Task 22 | Ephemeral | Route registration | 2 min |
| Final | Both | Main app integration | 3 min |

**Total: ~22 tasks, ~110 minutes, ~23 commits, ~23 new files + 2 modifications**

**MVP Capabilities Delivered:**

1. **AI Agent Orchestration:** Create agent profiles with tools, trigger runs manually via API, execute one agent step (read_file, run_command), return results with full decision timeline, cancel/retry runs, view in dashboard and detail pages.

2. **Ephemeral Dev Environments:** Create namespace for PR, deploy mock services, generate preview URL, list/filter environments, wake idle environments, teardown on demand, view environment details with service health.
