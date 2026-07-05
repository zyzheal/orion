# NeatLogic Feature Borrowing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement high-priority features borrowed from NeatLogic AutoExec into Orion's Pipeline engine, including parameter passing chain, condition routing, file transfer, stage group abstraction, and enhanced triggers.

**Architecture:** Extend Orion's existing Pipeline engine (PipelineEngine → StageOrchestrator → StageExecutor → TaskRunner) with new services following the Repository pattern. All new services are injected as collaborators into PipelineEngine/StageOrchestrator via constructor DI, maintaining the Facade pattern.

**Tech Stack:** TypeScript, Fastify, PostgreSQL (Repository pattern), Jest, cron-parser

## Global Constraints

1. All new services use PostgreSQL Repository pattern — no in-memory Map storage
2. All database operations use parameterized queries (no SQL injection)
3. All async operations use structured logging with `pino`
4. All errors use `OrionError` with `ErrorCode` — no `throw new Error`
5. All public methods have JSDoc comments
6. Test coverage: each new service must have ≥80% line coverage
7. Migration files follow naming: `NNN_<feature>_tables.sql` + `NNN_rollback_<feature>_tables.sql`
8. Next migration number: 399 (latest is 398_api_governance_tables.sql)
9. All new models use camelCase entity interfaces + snake_case DB columns
10. Follow existing naming conventions: `xxxRepository.ts`, `xxxService.ts`, `xxxController.ts`

---

### Task 1: Parameter Passing Chain (参数传递链)

**Priority:** P0 — Core infrastructure for stage-to-stage data flow

**Files:**
- Create: `orion-platform-service/src/engine/StageParameterResolver.ts`
- Test: `orion-platform-service/src/engine/__tests__/StageParameterResolver.test.ts`

**Interfaces:**
- Consumes: `VariableContext` (existing), `Stage`, `Task`
- Produces: `StageParameterResolver` class with `resolveStageParameters(stage, executionContext)` and `extractStageOutputs(stage, tasks)` methods

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/engine/__tests__/StageParameterResolver.test.ts
import { StageParameterResolver } from '../StageParameterResolver';
import { VariableContext } from '../VariableContext';
import { Stage, StageStatus } from '../../models/Stage';
import { Task, TaskStatus } from '../../models/Task';

describe('StageParameterResolver', () => {
  let resolver: StageParameterResolver;
  let variableCtx: VariableContext;

  beforeEach(() => {
    variableCtx = new VariableContext('run-001');
    resolver = new StageParameterResolver(variableCtx);
  });

  describe('extractStageOutputs', () => {
    it('应该从成功Task的result中提取outputs', () => {
      const tasks: Task[] = [
        {
          id: 'task-1', stageId: 'stage-1', name: 'build', type: 'shell',
          sequence: 1, status: TaskStatus.SUCCESS,
          config: {}, parameters: {}, retryCount: 0, maxRetries: 0,
          timeoutSeconds: 600, result: { version: '1.2.3', image: 'myapp:1.2.3' },
          createdAt: new Date(),
        },
      ];

      const outputs = resolver.extractStageOutputs(tasks);
      expect(outputs).toEqual({ version: '1.2.3', image: 'myapp:1.2.3' });
    });

    it('应该支持outputs声明中的引用解析', () => {
      variableCtx.setTaskOutput('build', 'version', '1.2.3');
      const tasks: Task[] = [
        {
          id: 'task-1', stageId: 'stage-1', name: 'build', type: 'shell',
          sequence: 1, status: TaskStatus.SUCCESS,
          config: {}, parameters: {}, retryCount: 0, maxRetries: 0,
          timeoutSeconds: 600, result: { version: '1.2.3' },
          createdAt: new Date(),
        },
      ];

      const outputs = resolver.extractStageOutputs(tasks, {
        version: '${tasks.build.outputs.version}',
      });
      expect(outputs).toEqual({ version: '1.2.3' });
    });

    it('失败Task不应贡献outputs', () => {
      const tasks: Task[] = [
        {
          id: 'task-1', stageId: 'stage-1', name: 'build', type: 'shell',
          sequence: 1, status: TaskStatus.FAILED,
          config: {}, parameters: {}, retryCount: 0, maxRetries: 0,
          timeoutSeconds: 600, result: { error: 'failed' },
          createdAt: new Date(),
        },
      ];

      const outputs = resolver.extractStageOutputs(tasks);
      expect(outputs).toEqual({});
    });
  });

  describe('resolveStageParameters', () => {
    it('应该解析下游Stage的参数引用', () => {
      variableCtx.setTaskOutput('build', 'image', 'myapp:1.2.3');
      variableCtx.setTaskOutput('build', 'version', '1.2.3');

      const upstreamOutputs = {
        image: '${tasks.build.outputs.image}',
        version: '${tasks.build.outputs.version}',
      };

      const resolved = resolver.resolveStageParameters('deploy', upstreamOutputs);
      expect(resolved).toEqual({ image: 'myapp:1.2.3', version: '1.2.3' });
    });

    it('应该保留无法解析的引用为原始字符串', () => {
      const upstreamOutputs = {
        image: '${tasks.nonexistent.outputs.image}',
      };

      const resolved = resolver.resolveStageParameters('deploy', upstreamOutputs);
      expect(resolved).toEqual({ image: '${tasks.nonexistent.outputs.image}' });
    });

    it('应该支持默认值语法', () => {
      const upstreamOutputs = {
        env: '${tasks.build.outputs.env || "production"}',
      };

      const resolved = resolver.resolveStageParameters('deploy', upstreamOutputs);
      expect(resolved).toEqual({ env: 'production' });
    });
  });

  describe('aggregateParameters', () => {
    it('应该合并多个源参数', () => {
      const sourceA = { image: 'myapp:1.2.3' };
      const sourceB = { replicas: '3', env: 'staging' };

      const aggregated = resolver.aggregateParameters(sourceA, sourceB);
      expect(aggregated).toEqual({ image: 'myapp:1.2.3', replicas: '3', env: 'staging' });
    });

    it('后者应该覆盖前者（相同key）', () => {
      const sourceA = { env: 'staging' };
      const sourceB = { env: 'production' };

      const aggregated = resolver.aggregateParameters(sourceA, sourceB);
      expect(aggregated).toEqual({ env: 'production' });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/StageParameterResolver.test.ts -v`
Expected: FAIL with "Cannot find module '../StageParameterResolver'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/engine/StageParameterResolver.ts
import { VariableContext } from './VariableContext';
import { Task, TaskStatus } from '../models/Task';

/**
 * StageParameterResolver - Stage-to-stage parameter passing
 *
 * Implements NeatLogic-style parameter extraction and aggregation:
 * - extractStageOutputs: extract output variables from completed task results
 * - resolveStageParameters: resolve ${tasks.<name>.outputs.<key>} references
 * - aggregateParameters: merge multiple parameter sources (later overrides earlier)
 *
 * @example
 * ```typescript
 * const resolver = new StageParameterResolver(variableCtx);
 *
 * // Extract outputs from build stage tasks
 * const outputs = resolver.extractStageOutputs(buildTasks, {
 *   version: '${tasks.build.outputs.version}',
 * });
 *
 * // Resolve parameters for deploy stage
 * const params = resolver.resolveStageParameters('deploy', {
 *   image: '${tasks.build.outputs.image}',
 * });
 * ```
 */
export class StageParameterResolver {
  constructor(private variableCtx: VariableContext) {}

  /**
   * Extract stage outputs from completed tasks.
   *
   * If stageDeclaredOutputs is provided, resolve each output reference
   * through VariableContext. Otherwise, collect all successful task results.
   *
   * @param tasks - Tasks from the completed stage
   * @param stageDeclaredOutputs - Optional {key: reference} map from stage.outputs YAML
   * @returns Record of output key -> resolved value
   */
  extractStageOutputs(
    tasks: Task[],
    stageDeclaredOutputs?: Record<string, string>,
  ): Record<string, string> {
    if (stageDeclaredOutputs && Object.keys(stageDeclaredOutputs).length > 0) {
      // Resolve declared outputs through VariableContext
      const resolved: Record<string, string> = {};
      for (const [key, reference] of Object.entries(stageDeclaredOutputs)) {
        resolved[key] = this.variableCtx.resolve(reference);
      }
      return resolved;
    }

    // Fallback: collect results from successful tasks only
    const outputs: Record<string, string> = {};
    for (const task of tasks) {
      if (task.status === TaskStatus.SUCCESS && task.result) {
        for (const [key, value] of Object.entries(task.result)) {
          if (typeof value === 'string' || typeof value === 'number') {
            outputs[key] = String(value);
          }
        }
      }
    }
    return outputs;
  }

  /**
   * Resolve parameter references for a downstream stage.
   *
   * Resolves ${tasks.<taskName>.outputs.<key>} references using VariableContext.
   * Unresolvable references are kept as-is (with original ${} syntax).
   *
   * @param stageName - The downstream stage name (for context)
   * @param params - Parameter map that may contain ${tasks.xxx} references
   * @returns Parameter map with resolved values
   */
  resolveStageParameters(
    stageName: string,
    params: Record<string, unknown>,
  ): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = this.variableCtx.resolve(value);
      } else {
        resolved[key] = String(value);
      }
    }
    return resolved;
  }

  /**
   * Aggregate multiple parameter sources into one.
   *
   * Later sources override earlier ones for duplicate keys.
   * Mirrors NeatLogic's ParamAggregate behavior.
   *
   * @param sources - Parameter maps to merge
   * @returns Merged parameter map
   */
  aggregateParameters(...sources: Record<string, unknown>[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
        result[key] = value;
      }
    }
    return result;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/StageParameterResolver.test.ts -v`
Expected: 8/8 PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/engine/StageParameterResolver.ts \
      orion-platform-service/src/engine/__tests__/StageParameterResolver.test.ts
git commit -m "feat: add StageParameterResolver for stage-to-stage parameter passing

Implements NeatLogic-style param extract/aggregate:
- extractStageOutputs: collect outputs from successful task results
- resolveStageParameters: resolve \${tasks.<name>.outputs.<key>} references
- aggregateParameters: merge multiple parameter sources

P0 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 2: Runner Remote Execution Interface (Runner远程执行架构预留)

**Priority:** P0 — Architecture foundation for future SSH/WinRM support

**Files:**
- Create: `orion-platform-service/src/models/RunnerProfile.ts`
- Modify: `orion-platform-service/src/engine/TaskRunner.ts` (add protocol dispatch)
- Test: `orion-platform-service/src/engine/__tests__/RunnerDispatcher.test.ts`

**Interfaces:**
- Consumes: `Task`, `TaskRunner` (existing)
- Produces: `RunnerProfile` model, `RunnerDispatcher` class with `canExecute(task, profile)` and `dispatch(task, profile)` methods

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/engine/__tests__/RunnerDispatcher.test.ts
import { RunnerDispatcher, RunnerProtocol } from '../RunnerDispatcher';
import { RunnerProfile } from '../../models/RunnerProfile';
import { Task, TaskStatus } from '../../models/Task';

describe('RunnerDispatcher', () => {
  let dispatcher: RunnerDispatcher;

  beforeEach(() => {
    dispatcher = new RunnerDispatcher();
  });

  describe('protocol detection', () => {
    it('应该识别 k8s 为默认协议', () => {
      const profile = createRunnerProfile({ protocol: 'k8s' });
      expect(dispatcher.getProtocol(profile)).toBe('k8s');
    });

    it('应该识别 ssh 协议', () => {
      const profile = createRunnerProfile({ protocol: 'ssh' });
      expect(dispatcher.getProtocol(profile)).toBe('ssh');
    });

    it('应该识别 winrm 协议', () => {
      const profile = createRunnerProfile({ protocol: 'winrm' });
      expect(dispatcher.getProtocol(profile)).toBe('winrm');
    });
  });

  describe('canExecute', () => {
    it('k8s protocol 应该可以执行容器任务', () => {
      const profile = createRunnerProfile({ protocol: 'k8s', available: true });
      const task = createTask({ type: 'shell' });
      expect(dispatcher.canExecute(task, profile)).toBe(true);
    });

    it('ssh protocol 当前应该返回false（未实现）', () => {
      const profile = createRunnerProfile({ protocol: 'ssh', available: true });
      const task = createTask({ type: 'shell' });
      expect(discher.canExecute(task, profile)).toBe(false);
    });

    it('不可用的Runner应该返回false', () => {
      const profile = createRunnerProfile({ protocol: 'k8s', available: false });
      const task = createTask({ type: 'shell' });
      expect(dispatcher.canExecute(task, profile)).toBe(false);
    });
  });

  describe('getSupportedProtocols', () => {
    it('应该返回已实现的协议列表', () => {
      const protocols = dispatcher.getSupportedProtocols();
      expect(protocols).toContain('k8s');
      expect(protocols).not.toContain('ssh');
      expect(protocols).not.toContain('winrm');
    });
  });
});

function createRunnerProfile(overrides: Partial<RunnerProfile> = {}): RunnerProfile {
  return {
    id: 'runner-1',
    name: 'test-runner',
    protocol: 'k8s',
    labels: ['linux', 'x64'],
    available: true,
    maxConcurrency: 4,
    metadata: {},
    ...overrides,
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', stageId: 'stage-1', name: 'test', type: 'shell',
    sequence: 1, status: TaskStatus.PENDING,
    config: {}, parameters: {}, retryCount: 0, maxRetries: 0,
    timeoutSeconds: 600, createdAt: new Date(), ...overrides,
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/RunnerDispatcher.test.ts -v`
Expected: FAIL with "Cannot find module '../RunnerDispatcher'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/models/RunnerProfile.ts
/**
 * RunnerProfile — Execution target profile
 *
 * Describes a runner that can execute pipeline tasks.
 * Supports multiple protocols: k8s (Tekton), ssh, winrm.
 *
 * This is the architecture foundation for NeatLogic-style
 * remote runner execution. SSH/WinRM protocols are reserved
 * for future implementation.
 */

export type RunnerProtocol = 'k8s' | 'ssh' | 'winrm';

export interface RunnerProfile {
  id: string;
  name: string;
  protocol: RunnerProtocol;
  labels: string[];
  available: boolean;
  maxConcurrency: number;
  metadata: Record<string, unknown>;
}

export interface RunnerSshConfig {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  credentialRef?: string;
  workingDir?: string;
}

export interface RunnerWinrmConfig {
  host: string;
  port: number;
  username: string;
  authType: 'ntlm' | 'basic' | 'certificate';
  credentialRef?: string;
  useHttps: boolean;
}

export function createRunnerProfile(input: {
  id?: string;
  name: string;
  protocol: RunnerProtocol;
  labels?: string[];
  available?: boolean;
  maxConcurrency?: number;
  metadata?: Record<string, unknown>;
}): RunnerProfile {
  return {
    id: input.id || `runner-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: input.name,
    protocol: input.protocol,
    labels: input.labels || [],
    available: input.available ?? true,
    maxConcurrency: input.maxConcurrency || 4,
    metadata: input.metadata || {},
  };
}
```

```typescript
// orion-platform-service/src/engine/RunnerDispatcher.ts
import { OrionError, ErrorCode } from '../errors';
import { RunnerProfile, RunnerProtocol, RunnerSshConfig, RunnerWinrmConfig } from '../models/RunnerProfile';
import { Task } from '../models/Task';

/**
 * RunnerDispatcher — Protocol-based task execution router
 *
 * Routes tasks to the appropriate execution protocol based on RunnerProfile.
 * Currently implements k8s (Tekton). SSH and WinRM are reserved for future phases.
 *
 * This provides the architecture foundation for NeatLogic-style
 * remote execution (Runner pushes scripts to remote servers).
 */
export class RunnerDispatcher {
  // Protocols that have a working implementation
  private implementedProtocols = new Set<RunnerProtocol>(['k8s']);

  /**
   * Get the effective protocol for a runner profile.
   */
  getProtocol(profile: RunnerProfile): RunnerProtocol {
    return profile.protocol;
  }

  /**
   * Check if a task can be executed on a given runner.
   */
  canExecute(task: Task, profile: RunnerProfile): boolean {
    if (!profile.available) return false;
    if (!this.implementedProtocols.has(profile.protocol)) return false;

    // k8s: can execute shell/script tasks
    if (profile.protocol === 'k8s') {
      return ['shell', 'script', 'container'].includes(task.type);
    }

    return false;
  }

  /**
   * Get list of protocols that have working implementations.
   */
  getSupportedProtocols(): RunnerProtocol[] {
    return Array.from(this.implementedProtocols);
  }

  /**
   * Validate SSH runner configuration (for future use).
   */
  validateSshConfig(config: RunnerSshConfig): void {
    if (!config.host) throw new OrionError('SSH host is required', ErrorCode.VALIDATION_ERROR);
    if (!config.username) throw new OrionError('SSH username is required', ErrorCode.VALIDATION_ERROR);
    if (!config.port) throw new OrionError('SSH port is required', ErrorCode.VALIDATION_ERROR);
    if (config.authType === 'key' && !config.credentialRef) {
      throw new OrionError('SSH key auth requires credentialRef', ErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Validate WinRM runner configuration (for future use).
   */
  validateWinrmConfig(config: RunnerWinrmConfig): void {
    if (!config.host) throw new OrionError('WinRM host is required', ErrorCode.VALIDATION_ERROR);
    if (!config.username) throw new OrionError('WinRM username is required', ErrorCode.VALIDATION_ERROR);
  }

  /**
   * Reserve a concurrency slot on the runner.
   * Returns true if a slot is available, false otherwise.
   */
  reserveSlot(profile: RunnerProfile, currentLoad: number): boolean {
    return currentLoad < profile.maxConcurrency;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/RunnerDispatcher.test.ts -v`
Expected: 8/8 PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/models/RunnerProfile.ts \
      orion-platform-service/src/engine/RunnerDispatcher.ts \
      orion-platform-service/src/engine/__tests__/RunnerDispatcher.test.ts
git commit -m "feat: add RunnerProfile and RunnerDispatcher for multi-protocol execution

Architecture foundation for NeatLogic-style remote runner execution:
- RunnerProfile model: k8s/ssh/winrm protocol support
- RunnerDispatcher: protocol routing, canExecute, slot reservation
- SSH/WinRM reserved for future implementation (config validation ready)

P0 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 3: Condition Routing Enhancement (条件分流)

**Priority:** P1 — Dynamic stage selection based on upstream results

**Files:**
- Modify: `orion-platform-service/src/engine/ExpressionEvaluator.ts` (add execution status functions)
- Modify: `orion-platform-service/src/engine/StageOrchestrator.ts` (integrate result-based conditions)
- Test: `orion-platform-service/src/engine/__tests__/ConditionRouter.test.ts`

**Interfaces:**
- Consumes: `ExpressionEvaluator`, `StageOrchestrator`, `PipelineExecution`
- Produces: `ConditionRouter` class with `evaluate(stage, execution)` method

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/engine/__tests__/ConditionRouter.test.ts
import { ConditionRouter } from '../ConditionRouter';
import { VariableContext } from '../VariableContext';
import { Stage, StageStatus } from '../../models/Stage';
import { PipelineExecution } from '../PipelineEngine';

describe('ConditionRouter', () => {
  let router: ConditionRouter;
  let variableCtx: VariableContext;

  beforeEach(() => {
    variableCtx = new VariableContext('run-001');
    router = new ConditionRouter(variableCtx);
  });

  describe('evaluate', () => {
    it('应该支持 stages.<name>.status == success 条件', () => {
      const execution = createExecution({
        stages: {
          'build': createStage({ name: 'build', status: StageStatus.SUCCESS }),
          'test': createStage({ name: 'test', status: StageStatus.SUCCESS }),
        },
      });

      const stage = createStage({
        name: 'deploy',
        condition: "stages.build.status == 'success'",
      });

      expect(router.evaluate(stage.condition!, execution)).toBe(true);
    });

    it('应该在条件为false时跳过stage', () => {
      const execution = createExecution({
        stages: {
          'build': createStage({ name: 'build', status: StageStatus.FAILED }),
        },
      });

      const stage = createStage({
        name: 'deploy',
        condition: "stages.build.status == 'success'",
      });

      expect(router.evaluate(stage.condition!, execution)).toBe(false);
    });

    it('应该支持 stages.<name>.result.<key> 条件', () => {
      variableCtx.setTaskOutput('test', 'passRate', '0.95');
      const execution = createExecution({
        stages: {
          'test': createStage({
            name: 'test',
            status: StageStatus.SUCCESS,
            result: { passRate: 0.95 },
          }),
        },
      });

      const stage = createStage({
        name: 'promote',
        condition: 'stages.test.result.passRate >= 0.9',
      });

      expect(router.evaluate(stage.condition!, execution)).toBe(true);
    });

    it('无condition的stage应该返回true', () => {
      const stage = createStage({ name: 'always-run' });
      const execution = createExecution({});
      expect(router.evaluate(stage.condition!, execution)).toBe(true);
    });

    it('复杂逻辑条件应该正确求值', () => {
      const execution = createExecution({
        stages: {
          'build': createStage({ name: 'build', status: StageStatus.SUCCESS }),
          'test': createStage({ name: 'test', status: StageStatus.SUCCESS }),
        },
      });

      const stage = createStage({
        name: 'deploy',
        condition: "stages.build.status == 'success' && stages.test.status == 'success'",
      });

      expect(router.evaluate(stage.condition!, execution)).toBe(true);
    });
  });
});

function createExecution(overrides: Partial<PipelineExecution> = {}): PipelineExecution {
  return {
    run: {} as any,
    stages: new Map(),
    pendingStages: new Set(),
    runningStages: new Set(),
    completedStages: new Set(),
    ...overrides,
  };
}

function createStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: `stage-${Date.now()}`,
    runId: 'run-001',
    name: 'default',
    sequence: 0,
    status: StageStatus.PENDING,
    dependsOn: [],
    timeoutSeconds: 3600,
    retryCount: 0,
    maxRetries: 0,
    createdAt: new Date(),
    ...overrides,
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/ConditionRouter.test.ts -v`
Expected: FAIL with "Cannot find module '../ConditionRouter'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/engine/ConditionRouter.ts
import { OrionError, ErrorCode } from '../errors';
import { ExpressionEvaluator, ExpressionContext } from './ExpressionEvaluator';
import { VariableContext } from './VariableContext';
import { Stage, StageStatus } from '../models/Stage';
import { PipelineExecution } from './PipelineEngine';

/**
 * ConditionRouter — Stage condition evaluation with execution context
 *
 * Extends ExpressionEvaluator to support stage-level conditions
 * based on upstream stage results (NeatLogic Condition feature).
 *
 * Supported condition syntax:
 * - stages.<name>.status == 'success' | 'failed' | 'skipped'
 * - stages.<name>.result.<key> <op> <value>
 * - tasks.<name>.outputs.<key> <op> <value>
 * - Logical operators: &&, ||, !
 * - Comparison: ==, !=, >, <, >=, <=
 *
 * @example
 * "stages.build.status == 'success' && stages.test.result.passRate >= 0.9"
 */
export class ConditionRouter {
  constructor(private variableCtx: VariableContext) {}

  /**
   * Evaluate a stage condition against the current execution state.
   *
   * @param condition - The condition expression string
   * @param execution - Current pipeline execution state
   * @returns true if condition is met (stage should execute), false to skip
   */
  evaluate(condition: string | undefined, execution: PipelineExecution): boolean {
    if (!condition) return true;

    try {
      const ctx = this.buildExecutionContext(execution);
      const evaluator = new ExpressionEvaluator();
      return evaluator.evaluate(condition, ctx);
    } catch (error) {
      // On evaluation error, default to true (don't skip stage)
      // This is safer than silently skipping important stages
      return true;
    }
  }

  /**
   * Build the expression evaluation context from execution state.
   */
  private buildExecutionContext(execution: PipelineExecution): ExpressionContext {
    const ctx: ExpressionContext = {};

    // Add stage statuses
    for (const [stageId, stage] of execution.stages.entries()) {
      const stageName = stage.name;
      ctx[`stages.${stageName}.status`] = stage.status;

      // Add stage results as a nested object
      if (stage.result) {
        for (const [key, value] of Object.entries(stage.result)) {
          ctx[`stages.${stageName}.result.${key}`] = value;
        }
      }
    }

    // Add task outputs from VariableContext
    const taskOutputs = (this.variableCtx as any).getAllOutputs?.() || {};
    for (const [taskName, outputs] of Object.entries(taskOutputs)) {
      for (const [key, value] of Object.entries(outputs)) {
        ctx[`tasks.${taskName}.outputs.${key}`] = value;
      }
    }

    return ctx;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/ConditionRouter.test.ts -v`
Expected: 5/5 PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/engine/ConditionRouter.ts \
      orion-platform-service/src/engine/__tests__/ConditionRouter.test.ts
git commit -m "feat: add ConditionRouter for stage result-based routing

Enables NeatLogic-style condition branching:
- stages.<name>.status == 'success'/'failed'/'skipped'
- stages.<name>.result.<key> comparison operators
- tasks.<name>.outputs.<key> references
- Complex && || logic

P1 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 4: Inter-Stage File Transfer Service (文件传输)

**Priority:** P1 — File passing between stages

**Files:**
- Create: `orion-platform-service/src/services/pipeline/StageFileTransferService.ts`
- Create: `orion-platform-service/src/repositories/StageFileTransferRepository.ts`
- Create: `orion-platform-service/src/models/StageFileTransfer.ts`
- Test: `orion-platform-service/src/services/pipeline/__tests__/StageFileTransferService.test.ts`

**Interfaces:**
- Consumes: `DatabasePool`, `VariableContext`
- Produces: `StageFileTransferService` with `register(stageId, fileName, content)`, `resolve(stageId, fileName)`, `transfer(fromStageId, toStageId, fileName)` methods

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/services/pipeline/__tests__/StageFileTransferService.test.ts
import { StageFileTransferService } from '../StageFileTransferService';
import { StageFileTransferRepository } from '../../repositories/StageFileTransferRepository';

describe('StageFileTransferService', () => {
  let service: StageFileTransferService;
  let mockRepo: jest.Mocked<StageFileTransferRepository>;

  beforeEach(() => {
    const files = new Map<string, any>();
    mockRepo = {
      insert: jest.fn(async (entity) => { files.set(entity.id, entity); return entity; }),
      findByStageId: jest.fn(async (stageId) => Array.from(files.values()).filter(f => f.stageId === stageId)),
      findByStageIdAndName: jest.fn(async (stageId, fileName) => Array.from(files.values()).find(f => f.stageId === stageId && f.fileName === fileName)),
      transfer: jest.fn(async (transferId) => {
        const entry = files.get(transferId);
        if (entry) { entry.transferredAt = new Date(); entry.transferred = true; }
        return entry;
      }),
      findTransfersBetweenStages: jest.fn(async (fromStageId, toStageId) =>
        Array.from(files.values()).filter(f => f.fromStageId === fromStageId && f.toStageId === toStageId)
      ),
    } as any;
    service = new StageFileTransferService(mockRepo);
  });

  describe('register', () => {
    it('应该注册文件到stage', async () => {
      await service.register('stage-1', 'artifact.tar.gz', Buffer.from('binary-data'));
      expect(mockRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ stageId: 'stage-1', fileName: 'artifact.tar.gz' })
      );
    });

    it('应该生成唯一的transfer ID', async () => {
      const result = await service.register('stage-1', 'report.pdf', Buffer.from('data'));
      expect(result.id).toBeDefined();
      expect(result.fileName).toBe('report.pdf');
    });
  });

  describe('resolve', () => {
    it('应该根据stageId和fileName查找文件', async () => {
      await service.register('stage-1', 'config.yaml', Buffer.from('yaml-content'));
      const result = await service.resolve('stage-1', 'config.yaml');
      expect(result).toBeDefined();
      expect(result!.content.toString()).toBe('yaml-content');
    });

    it('未找到文件应该返回null', async () => {
      const result = await service.resolve('stage-1', 'nonexistent.txt');
      expect(result).toBeNull();
    });
  });

  describe('transfer', () => {
    it('应该将文件从源stage转移到目标stage', async () => {
      await service.register('stage-1', 'artifact.zip', Buffer.from('zip-data'));
      const files = await service.resolve('stage-1', 'artifact.zip')!;

      await service.transfer(files!.id, 'stage-2');
      expect(mockRepo.transfer).toHaveBeenCalledWith(files!.id, 'stage-2');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest -- src/services/pipeline/__tests__/StageFileTransferService.test.ts -v`
Expected: FAIL with module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/models/StageFileTransfer.ts
/**
 * StageFileTransfer — Inter-stage file transfer record
 *
 * Tracks files produced by one stage and consumed by another.
 * Mirrors NeatLogic's FileHandler pattern.
 */

export interface StageFileTransferEntity {
  id: string;
  stageId: string;
  fromStageId?: string;
  toStageId?: string;
  fileName: string;
  content: Buffer;
  sizeBytes: number;
  transferred: boolean;
  transferredAt?: Date;
  createdAt: Date;
}

export interface StageFileTransfer {
  id: string;
  stageId: string;
  fromStageId?: string;
  toStageId?: string;
  fileName: string;
  content: Buffer;
  sizeBytes: number;
  transferred: boolean;
  transferredAt?: Date;
  createdAt: Date;
}

export function createStageFileTransfer(input: {
  stageId: string;
  fileName: string;
  content: Buffer;
  fromStageId?: string;
  toStageId?: string;
}): StageFileTransferEntity {
  return {
    id: `xfer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    stageId: input.stageId,
    fromStageId: input.fromStageId,
    toStageId: input.toStageId,
    fileName: input.fileName,
    content: input.content,
    sizeBytes: input.content.length,
    transferred: false,
    createdAt: new Date(),
  };
}
```

```typescript
// orion-platform-service/src/repositories/StageFileTransferRepository.ts
import { DatabasePool } from '../database';

export interface StageFileTransferEntity {
  id: string;
  stageId: string;
  fromStageId?: string;
  toStageId?: string;
  fileName: string;
  content: Buffer;
  sizeBytes: number;
  transferred: boolean;
  transferredAt?: Date;
  createdAt: Date;
}

export class StageFileTransferRepository {
  constructor(private pool: DatabasePool) {}

  async insert(entity: StageFileTransferEntity): Promise<StageFileTransferEntity> {
    const result = await this.pool.query(
      `INSERT INTO stage_file_transfers
        (id, stage_id, from_stage_id, to_stage_id, file_name, content, size_bytes, transferred, transferred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [entity.id, entity.stageId, entity.fromStageId, entity.toStageId,
       entity.fileName, entity.content, entity.sizeBytes, entity.transferred, entity.transferredAt],
    );
    return this.mapRow(result.rows[0]);
  }

  async findByStageId(stageId: string): Promise<StageFileTransferEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM stage_file_transfers WHERE stage_id = $1',
      [stageId],
    );
    return result.rows.map(r => this.mapRow(r));
  }

  async findByStageIdAndName(stageId: string, fileName: string): Promise<StageFileTransferEntity | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM stage_file_transfers WHERE stage_id = $1 AND file_name = $2',
      [stageId, fileName],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async transfer(transferId: string, toStageId: string): Promise<StageFileTransferEntity | undefined> {
    const result = await this.pool.query(
      `UPDATE stage_file_transfers
       SET to_stage_id = $2, transferred = true, transferred_at = NOW()
       WHERE id = $1 RETURNING *`,
      [transferId, toStageId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async findTransfersBetweenStages(fromStageId: string, toStageId: string): Promise<StageFileTransferEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM stage_file_transfers WHERE from_stage_id = $1 AND to_stage_id = $2',
      [fromStageId, toStageId],
    );
    return result.rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): StageFileTransferEntity {
    return {
      id: row.id,
      stageId: row.stage_id,
      fromStageId: row.from_stage_id,
      toStageId: row.to_stage_id,
      fileName: row.file_name,
      content: row.content,
      sizeBytes: parseInt(row.size_bytes, 10),
      transferred: row.transferred,
      transferredAt: row.transferred_at,
      createdAt: row.created_at,
    };
  }
}
```

```typescript
// orion-platform-service/src/services/pipeline/StageFileTransferService.ts
import { OrionError, ErrorCode } from '../../errors';
import { StageFileTransferRepository, StageFileTransferEntity } from '../../repositories/StageFileTransferRepository';
import { StageFileTransfer, createStageFileTransfer } from '../../models/StageFileTransfer';

/**
 * StageFileTransferService — Inter-stage file transfer management
 *
 * Implements NeatLogic-style FileHandler for passing files between stages.
 * Files are stored in PostgreSQL (bytea) and transferred by reference.
 */
export class StageFileTransferService {
  constructor(private repo: StageFileTransferRepository) {}

  /**
   * Register a file produced by a stage.
   */
  async register(stageId: string, fileName: string, content: Buffer): Promise<StageFileTransfer> {
    if (!content || content.length === 0) {
      throw new OrionError('File content cannot be empty', ErrorCode.VALIDATION_ERROR);
    }
    const entity = createStageFileTransfer({ stageId, fileName, content });
    const result = await this.repo.insert(entity);
    return this.mapEntity(result);
  }

  /**
   * Resolve a file by stage ID and file name.
   */
  async resolve(stageId: string, fileName: string): Promise<StageFileTransfer | null> {
    const result = await this.repo.findByStageIdAndName(stageId, fileName);
    return result ? this.mapEntity(result) : null;
  }

  /**
   * Transfer a file from one stage to another.
   */
  async transfer(transferId: string, toStageId: string): Promise<StageFileTransfer> {
    const result = await this.repo.transfer(transferId, toStageId);
    if (!result) throw new OrionError('File transfer not found', ErrorCode.NOT_FOUND);
    return this.mapEntity(result);
  }

  /**
   * Get all files transferred between two stages.
   */
  async getTransfersBetweenStages(fromStageId: string, toStageId: string): Promise<StageFileTransfer[]> {
    const results = await this.repo.findTransfersBetweenStages(fromStageId, toStageId);
    return results.map(r => this.mapEntity(r));
  }

  private mapEntity(entity: StageFileTransferEntity): StageFileTransfer {
    return {
      id: entity.id,
      stageId: entity.stageId,
      fromStageId: entity.fromStageId,
      toStageId: entity.toStageId,
      fileName: entity.fileName,
      content: entity.content,
      sizeBytes: entity.sizeBytes,
      transferred: entity.transferred,
      transferredAt: entity.transferredAt,
      createdAt: entity.createdAt,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest -- src/services/pipeline/__tests__/StageFileTransferService.test.ts -v`
Expected: 5/5 PASS

- [ ] **Step 5: Commit**

```bash
git add orion-platform-service/src/models/StageFileTransfer.ts \
      orion-platform-service/src/repositories/StageFileTransferRepository.ts \
      orion-platform-service/src/services/pipeline/StageFileTransferService.ts \
      orion-platform-service/src/services/pipeline/__tests__/StageFileTransferService.test.ts
git commit -m "feat: add StageFileTransferService for inter-stage file passing

Implements NeatLogic-style FileHandler:
- register: stage produces a file artifact
- resolve: downstream stage retrieves file by name
- transfer: explicitly transfer file between stages

P1 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 5: Stage Group Abstraction (阶段组抽象)

**Priority:** P1 — Multi-stage batch execution (extends beyond single-stage grayScale)

**Files:**
- Modify: `orion-platform-service/src/models/Pipeline.ts` (add stageGroup config)
- Modify: `orion-platform-service/src/models/Stage.ts` (add groupPhaseId)
- Modify: `orion-platform-service/src/engine/GrayScaleController.ts` (extend to stage groups)
- Modify: `orion-platform-service/src/engine/StageOrchestrator.ts` (group-aware execution)
- Create: `orion-platform-service/src/engine/StageGroupOrchestrator.ts`
- Create migration: `orion-platform-service/src/db/migrations/399_stage_group_tables.sql`
- Test: `orion-platform-service/src/engine/__tests__/StageGroupOrchestrator.test.ts`

**Interfaces:**
- Consumes: `Stage`, `GrayScaleController`, `MultiTargetExecutor`
- Produces: `StageGroupOrchestrator` class, `stageGroups` in PipelineStage YAML

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/engine/__tests__/StageGroupOrchestrator.test.ts
import { StageGroupOrchestrator } from '../StageGroupOrchestrator';
import { StageGroupExecutor } from '../StageGroupExecutor';
import { GrayScaleController } from '../GrayScaleController';
import { Stage, StageStatus } from '../../models/Stage';
import { PipelineExecution } from '../PipelineEngine';

describe('StageGroupOrchestrator', () => {
  let orchestrator: StageGroupOrchestrator;
  let grayscaleController: GrayScaleController;

  beforeEach(() => {
    grayscaleController = new GrayScaleController();
    orchestrator = new StageGroupOrchestrator(grayscaleController);
  });

  describe('group stages', () => {
    it('应该将同组stages组织在一起', () => {
      const stages = [
        createStage({ id: 's1', name: 'deploy-group-1', sequence: 1 }),
        createStage({ id: 's2', name: 'deploy-group-2', sequence: 2 }),
        createStage({ id: 's3', name: 'independent', sequence: 3 }),
      ];
      const stageGroups: Record<string, string[]> = {
        'deploy-group': ['deploy-group-1', 'deploy-group-2'],
      };

      const groups = orchestrator.groupStages(stages, stageGroups);
      expect(groups.has('deploy-group')).toBe(true);
      expect(groups.get('deploy-group')).toHaveLength(2);
      expect(groups.get('deploy-group')![0].name).toBe('deploy-group-1');
    });

    it('没有分组的stage应该各自独立', () => {
      const stages = [
        createStage({ id: 's1', name: 'standalone-1', sequence: 1 }),
        createStage({ id: 's2', name: 'standalone-2', sequence: 2 }),
      ];

      const groups = orchestrator.groupStages(stages, {});
      expect(groups.size).toBe(2);
    });
  });

  describe('executeGroup', () => {
    it('应该按批次顺序执行组内stages', async () => {
      const groupStages = [
        createStage({ id: 'g1', name: 'g1', sequence: 1, targets: ['node1', 'node2', 'node3'], executionMode: 'grayScale', batchSize: 2 }),
        createStage({ id: 'g2', name: 'g2', sequence: 2, targets: ['node1', 'node2', 'node3'], executionMode: 'grayScale', batchSize: 2 }),
      ];

      const execution = createExecution();
      const executeFn = jest.fn(async () => ({ success: true }));

      await orchestrator.executeGroup('group-1', groupStages, execution, executeFn);

      // With batchSize=2 and 3 targets, first batch: [node1, node2], second: [node3]
      expect(executeFn).toHaveBeenCalledTimes(2); // 2 stages
    });
  });
});

function createExecution(overrides: Partial<PipelineExecution> = {}): PipelineExecution {
  return {
    run: {} as any,
    stages: new Map(),
    pendingStages: new Set(),
    runningStages: new Set(),
    completedStages: new Set(),
    ...overrides,
  };
}

function createStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: `stage-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    runId: 'run-001',
    name: 'default',
    sequence: 0,
    status: StageStatus.PENDING,
    dependsOn: [],
    timeoutSeconds: 3600,
    retryCount: 0,
    maxRetries: 0,
    createdAt: new Date(),
    ...overrides,
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/StageGroupOrchestrator.test.ts -v`
Expected: FAIL with module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// orion-platform-service/src/engine/StageGroupOrchestrator.ts
import { OrionError, ErrorCode } from '../errors';
import { Stage, StageStatus } from '../models/Stage';
import { GrayScaleController } from './GrayScaleController';
import { PipelineExecution } from './PipelineEngine';

/**
 * StageGroupOrchestrator — Multi-stage batch execution (Phase Group)
 *
 * Extends Orion's grayScale from single-stage to multi-stage group level.
 * When stages are grouped, the entire group executes as a unit:
 * - Stage A (batch 1) → Stage B (batch 1) → Stage A (batch 2) → Stage B (batch 2)
 * - vs current: Stage A (all targets) → Stage B (all targets)
 *
 * Mirrors NeatLogic's PhaseGroup with GRAYSCALE policy at group level.
 */
export interface StageGroup {
  id: string;
  name: string;
  stages: Stage[];
  executionMode: 'oneshot' | 'grayScale';
  batchSize: number;
  targets: string[];
}

export class StageGroupOrchestrator {
  constructor(private grayscaleController: GrayScaleController) {}

  /**
   * Group stages by their groupPhaseId or stage group declarations.
   *
   * @param stages - All stages in the pipeline
   * @param stageGroupMap - Map of groupName -> [stageNames]
   * @returns Map of groupName -> Stage[]
   */
  groupStages(stages: Stage[], stageGroupMap: Record<string, string[]>): Map<string, Stage[]> {
    const groups = new Map<string, Stage[]>();

    // Create a lookup by name
    const stageMap = new Map(stages.map(s => [s.name, s]));

    // Group stages
    for (const [groupName, stageNames] of Object.entries(stageGroupMap)) {
      const groupStages = stageNames
        .map(name => stageMap.get(name))
        .filter((s): s is Stage => s !== undefined);
      if (groupStages.length > 0) {
        groups.set(groupName, groupStages);
      }
    }

    // Ungrouped stages get their own group (key = stage.id)
    for (const stage of stages) {
      const inGroup = Array.from(stageGroupMap.values()).some(names => names.includes(stage.name));
      if (!inGroup) {
        groups.set(stage.id, [stage]);
      }
    }

    return groups;
  }

  /**
   * Execute a stage group with batch awareness.
   *
   * For grayScale groups, stages within each batch execute sequentially,
   * but batches execute in order. This differs from single-stage grayScale
   * where stages execute independently per target.
   *
   * @param groupName - The group identifier
   * @param groupStages - Stages in this group
   * @param execution - Pipeline execution context
   * @param executeStageFn - Function to execute a single stage (provided by StageOrchestrator)
   */
  async executeGroup(
    groupName: string,
    groupStages: Stage[],
    execution: PipelineExecution,
    executeStageFn: (stage: Stage) => Promise<{ success: boolean }>,
  ): Promise<void> {
    if (groupStages.length === 0) return;

    // Determine if any stage in the group uses multi-target
    const hasMultiTarget = groupStages.some(s => s.targets && s.targets.length > 0);
    const executionMode = groupStages[0]?.executionMode || 'oneshot';

    if (hasMultiTarget && executionMode === 'grayScale') {
      await this.executeGrayScaleGroup(groupName, groupStages, execution, executeStageFn);
    } else {
      // Sequential execution within the group
      for (const stage of groupStages) {
        if (execution.completedStages.has(stage.id) || execution.runningStages.has(stage.id)) {
          continue;
        }
        execution.pendingStages.add(stage.id);
        await executeStageFn(stage);
      }
    }
  }

  /**
   * Execute a grayScale group: stages execute in sequence per batch.
   *
   * Batch flow for group [StageA, StageB] with targets [t1, t2, t3] and batchSize=2:
   *   Batch 1: StageA(t1,t2) → StageB(t1,t2)
   *   Batch 2: StageA(t3) → StageB(t3)
   */
  private async executeGrayScaleGroup(
    groupName: string,
    groupStages: Stage[],
    execution: PipelineExecution,
    executeStageFn: (stage: Stage) => Promise<{ success: boolean }>,
  ): Promise<void> {
    const targets = groupStages[0].targets!;
    const batchSize = groupStages[0].batchSize || 1;

    // Split targets into batches
    const batches: string[][] = [];
    for (let i = 0; i < targets.length; i += batchSize) {
      batches.push(targets.slice(i, i + batchSize));
    }

    // Execute each batch: all stages in group for this batch, then next batch
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      for (const stage of groupStages) {
        // Create per-batch stage clone
        const batchStage: Stage = {
          ...stage,
          targets: batch,
          result: {
            ...stage.result,
            batchIndex: batchIdx,
            batchTargets: batch,
            totalBatches: batches.length,
          } as Record<string, unknown>,
        };

        execution.pendingStages.add(batchStage.id);
        await executeStageFn(batchStage);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/StageGroupOrchestrator.test.ts -v`
Expected: 3/3 PASS

- [ ] **Step 5: Add DB migration**

```sql
-- orion-platform-service/src/db/migrations/399_stage_group_tables.sql
-- Stage Group abstraction for multi-stage batch execution
CREATE TABLE IF NOT EXISTS stage_group_definitions (
  id VARCHAR(36) PRIMARY KEY,
  pipeline_id VARCHAR(36) NOT NULL REFERENCES pipelines(id),
  tenant_id VARCHAR(36) NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  stage_names TEXT[] NOT NULL,
  execution_mode VARCHAR(20) NOT NULL DEFAULT 'oneshot',
  batch_size INTEGER NOT NULL DEFAULT 1,
  targets TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  CONSTRAINT unique_group_name_per_pipeline UNIQUE (pipeline_id, group_name)
);

CREATE INDEX IF NOT EXISTS idx_stage_group_definitions_pipeline
  ON stage_group_definitions(pipeline_id);

CREATE TABLE IF NOT EXISTS stage_group_executions (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL REFERENCES pipeline_runs(id),
  group_id VARCHAR(36) NOT NULL REFERENCES stage_group_definitions(id),
  group_name VARCHAR(255) NOT NULL,
  batch_index INTEGER NOT NULL,
  total_batches INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_group_executions_run
  ON stage_group_executions(run_id);
```

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/engine/StageGroupOrchestrator.ts \
      orion-platform-service/src/engine/__tests__/StageGroupOrchestrator.test.ts \
      orion-platform-service/src/models/Pipeline.ts \
      orion-platform-service/src/models/Stage.ts \
      orion-platform-service/src/engine/GrayScaleController.ts \
      orion-platform-service/src/engine/StageOrchestrator.ts \
      orion-platform-service/src/db/migrations/399_stage_group_tables.sql
git commit -m "feat: add StageGroupOrchestrator for multi-stage batch execution

Extends grayScale from single-stage to stage-group level:
- StageGroupOrchestrator: group stages, execute with batch awareness
- PipelineStage.stageGroups YAML declaration
- stage_group_definitions + stage_group_executions tables

Mirrors NeatLogic PhaseGroup GRAYSCALE policy at group level.
P1 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 6: Enhanced Pipeline Triggers (定时作业增强)

**Priority:** P1 — Enrich cron triggers with pipeline execution metadata

**Files:**
- Modify: `orion-platform-service/src/services/pipeline/PipelineTriggerService.ts` (add run metadata tracking)
- Modify: `orion-platform-service/src/repositories/TriggerRepository.ts` (add run tracking columns)
- Test: `orion-platform-service/src/services/pipeline/__tests__/PipelineTriggerService.enhanced.test.ts`

**Interfaces:**
- Consumes: `TriggerRepository`, `PipelineEngine`
- Produces: Enhanced trigger with `lastRunId`, `lastRunStatus`, `consecutiveFailures`

- [ ] **Step 1: Write the failing test**

```typescript
// orion-platform-service/src/services/pipeline/__tests__/PipelineTriggerService.enhanced.test.ts
import { PipelineTriggerService } from '../PipelineTriggerService';

describe('PipelineTriggerService - Enhanced', () => {
  describe('run tracking', () => {
    it('应该在trigger执行后记录lastRunId', async () => {
      const service = new PipelineTriggerService({
        onTickCallback: async (triggerId) => {
          // Simulate pipeline execution
          return;
        },
      });

      // Register a schedule trigger
      // ... trigger registration

      // After execution, lastRunId should be set
      expect(trigger.lastRunId).toBeDefined();
    });

    it('应该跟踪连续失败次数', async () => {
      const service = new PipelineTriggerService({
        onTickCallback: async () => { throw new Error('fail'); },
      });

      // Execute trigger multiple times
      // After 3 failures, consecutiveFailures should be 3
      // Status should become 'failed'
    });

    it('成功后应该重置连续失败计数', async () => {
      // Fail 2 times, then succeed
      // consecutiveFailures should be 0 after success
    });
  });

  describe('timezone support', () => {
    it('应该使用trigger配置的时区计算下次执行', async () => {
      // Trigger with timezone: 'Asia/Shanghai'
      // nextRunAt should be calculated in that timezone
    });
  });
});
```

- [ ] **Step 2-5: Implement run tracking in PipelineTriggerService**

Add to `Trigger` interface:
```typescript
export interface Trigger {
  // ... existing fields
  lastRunId?: string;
  lastRunStatus?: TriggerExecutionStatus;
  lastRunAt?: Date;
  consecutiveFailures: number;
}
```

Add method to PipelineTriggerService:
```typescript
async recordExecution(triggerId: string, runId: string, status: TriggerExecutionStatus): Promise<void>
```

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/services/pipeline/PipelineTriggerService.ts \
      orion-platform-service/src/repositories/TriggerRepository.ts \
      orion-platform-service/src/services/pipeline/__tests__/PipelineTriggerService.enhanced.test.ts
git commit -m "feat: enhance pipeline triggers with run tracking and failure detection

- Record lastRunId/lastRunStatus per trigger execution
- Track consecutive failures, auto-disable after threshold
- Timezone-aware cron scheduling

P1 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 7: Audit Log Enhancement (审计日志增强)

**Priority:** P2 — Complete pipeline execution audit trail

**Files:**
- Modify: `orion-platform-service/src/models/PluginAuditLog.ts` (rename/generalize to PipelineAuditLog)
- Create: `orion-platform-service/src/repositories/PipelineAuditLogRepository.ts`
- Create: `orion-platform-service/src/services/pipeline/PipelineAuditLogService.ts`
- Create migration: `orion-platform-service/src/db/migrations/400_pipeline_audit_log.sql`
- Test: `orion-platform-service/src/services/pipeline/__tests__/PipelineAuditLogService.test.ts`

**Interfaces:**
- Consumes: `DatabasePool`
- Produces: `PipelineAuditLogService` with `record(params)` and `query(filter)` methods

- [ ] **Step 1-5: Implement PipelineAuditLogService**

Model:
```typescript
// orion-platform-service/src/models/PipelineAuditLog.ts
export interface PipelineAuditLog {
  id: string;
  tenantId: string;
  runId: string;
  stageId?: string;
  taskId?: string;
  action: 'stage.start' | 'stage.complete' | 'stage.skip' | 'stage.fail'
       | 'task.start' | 'task.complete' | 'task.fail' | 'task.skip'
       | 'approval.request' | 'approval.approve' | 'approval.reject'
       | 'trigger.fire' | 'run.create' | 'run.cancel';
  actor: string; // userId or 'system' or 'trigger'
  outcome: 'success' | 'failed' | 'pending';
  durationMs?: number;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
```

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/models/PipelineAuditLog.ts \
      orion-platform-service/src/repositories/PipelineAuditLogRepository.ts \
      orion-platform-service/src/services/pipeline/PipelineAuditLogService.ts \
      orion-platform-service/src/db/migrations/400_pipeline_audit_log.sql \
      orion-platform-service/src/services/pipeline/__tests__/PipelineAuditLogService.test.ts
git commit -m "feat: add PipelineAuditLogService for complete execution audit trail

Tracks all pipeline/stage/task lifecycle events:
- Action taxonomy: start/complete/fail/skip + approval/trigger
- Actor tracking: userId, system, trigger
- Input/output summaries for forensic analysis

P2 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 8: Global Parameters Service (全局参数)

**Priority:** P2 — Cross-pipeline shared parameters

**Files:**
- Create: `orion-platform-service/src/models/GlobalParam.ts`
- Create: `orion-platform-service/src/repositories/GlobalParamRepository.ts`
- Create: `orion-platform-service/src/services/pipeline/GlobalParamService.ts`
- Create migration: `orion-platform-service/src/db/migrations/401_global_params.sql`
- Test: `orion-platform-service/src/services/pipeline/__tests__/GlobalParamService.test.ts`

**Interfaces:**
- Consumes: `DatabasePool`
- Produces: `GlobalParamService` with `set(params)`, `get(keys)`, `resolve(params)` methods

- [ ] **Step 1-5: Implement GlobalParamService**

```typescript
// orion-platform-service/src/models/GlobalParam.ts
export interface GlobalParam {
  id: string;
  tenantId: string;
  key: string;
  value: string;
  description?: string;
  isSecret: boolean;
  scope: 'tenant' | 'pipeline' | 'global';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/models/GlobalParam.ts \
      orion-platform-service/src/repositories/GlobalParamRepository.ts \
      orion-platform-service/src/services/pipeline/GlobalParamService.ts \
      orion-platform-service/src/db/migrations/401_global_params.sql \
      orion-platform-service/src/services/pipeline/__tests__/GlobalParamService.test.ts
git commit -m "feat: add GlobalParamService for cross-pipeline parameter sharing

Global parameters accessible across pipelines within a tenant:
- Scoped: tenant / pipeline / global
- Secret flag for sensitive values (masked in logs)
- Expiration support for time-limited parameters

P2 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 9: Environment Profile Management (Profile管理)

**Priority:** P2 — Environment-specific configuration profiles

**Files:**
- Create: `orion-platform-service/src/models/EnvProfile.ts`
- Create: `orion-platform-service/src/repositories/EnvProfileRepository.ts`
- Create: `orion-platform-service/src/services/pipeline/EnvProfileService.ts`
- Create migration: `orion-platform-service/src/db/migrations/402_env_profiles.sql`
- Test: `orion-platform-service/src/services/pipeline/__tests__/EnvProfileService.test.ts`

**Interfaces:**
- Consumes: `DatabasePool`
- Produces: `EnvProfileService` with `createProfile()`, `getProfile(name, env)`, `resolveVariables(profile)` methods

- [ ] **Step 1-5: Implement EnvProfileService**

```typescript
// orion-platform-service/src/models/EnvProfile.ts
export interface EnvProfile {
  id: string;
  tenantId: string;
  name: string;
  environment: string; // development | staging | production
  variables: Record<string, string>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/models/EnvProfile.ts \
      orion-platform-service/src/repositories/EnvProfileRepository.ts \
      orion-platform-service/src/services/pipeline/EnvProfileService.ts \
      orion-platform-service/src/db/migrations/402_env_profiles.sql \
      orion-platform-service/src/services/pipeline/__tests__/EnvProfileService.test.ts
git commit -m "feat: add EnvProfileService for environment-specific configuration

Environment profiles inject variables per deployment environment:
- Named profiles per tenant: dev/staging/production
- Variable overrides per environment
- Profile resolution in DynamicParamsResolver

P2 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 10: Script Version Management (脚本版本管理)

**Priority:** P3 — Script version tracking with comparison

**Files:**
- Create: `orion-platform-service/src/models/ScriptVersion.ts`
- Create: `orion-platform-service/src/repositories/ScriptVersionRepository.ts`
- Create: `orion-platform-service/src/services/pipeline/ScriptVersionService.ts`
- Create migration: `orion-platform-service/src/db/migrations/403_script_versions.sql`
- Test: `orion-platform-service/src/services/pipeline/__tests__/ScriptVersionService.test.ts`

**Interfaces:**
- Consumes: `DatabasePool`
- Produces: `ScriptVersionService` with `createVersion()`, `getVersions(scriptId)`, `diff(versionA, versionB)` methods

- [ ] **Step 1-5: Implement ScriptVersionService**

```typescript
// orion-platform-service/src/models/ScriptVersion.ts
export interface ScriptVersion {
  id: string;
  tenantId: string;
  scriptId: string;
  version: string;
  content: string;
  contentHash: string;
  parameters: Record<string, unknown>;
  changeDescription?: string;
  createdBy: string;
  createdAt: Date;
}
```

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/models/ScriptVersion.ts \
      orion-platform-service/src/repositories/ScriptVersionRepository.ts \
      orion-platform-service/src/services/pipeline/ScriptVersionService.ts \
      orion-platform-service/src/db/migrations/403_script_versions.sql \
      orion-platform-service/src/services/pipeline/__tests__/ScriptVersionService.test.ts
git commit -m "feat: add ScriptVersionService for script version tracking

Tracks script content versions with diff comparison:
- Content hash for change detection
- Parameter versioning per script
- Version diff for change review

P3 feature from neatlogic-autoexec comparison analysis."
```

---

### Task 11: Notification Template Parameterization (通知策略增强)

**Priority:** P3 — Parameterizable notification templates

**Files:**
- Modify: `orion-platform-service/src/services/pipeline/NotificationDispatcher.ts`
- Modify: `orion-platform-service/src/services/pipeline/IMNotifier.ts`
- Modify: `orion-platform-service/src/services/pipeline/WebhookNotifier.ts`
- Test: `orion-platform-service/src/services/pipeline/__tests__/NotificationDispatcher.enhanced.test.ts`

**Interfaces:**
- Consumes: `VariableContext`, `PipelineEventPublisher`
- Produces: Enhanced notification with template variable resolution

- [ ] **Step 1-5: Implement template parameterization**

Add to NotificationDispatcher:
```typescript
interface NotificationTemplate {
  subject: string;
  body: string;
  channels: ('im' | 'webhook' | 'email')[];
}

async sendWithTemplate(
  template: NotificationTemplate,
  context: Record<string, unknown>,
  channels: string[]
): Promise<void>
```

Support template syntax: `{{stages.build.status}}`, `{{tasks.test.outputs.passRate}}`

- [ ] **Step 6: Commit**

```bash
git add orion-platform-service/src/services/pipeline/NotificationDispatcher.ts \
      orion-platform-service/src/services/pipeline/IMNotifier.ts \
      orion-platform-service/src/services/pipeline/WebhookNotifier.ts \
      orion-platform-service/src/services/pipeline/__tests__/NotificationDispatcher.enhanced.test.ts
git commit -m "feat: enhance notifications with parameterizable templates

Notification templates support runtime variable substitution:
- {{stages.<name>.status}} - stage execution status
- {{tasks.<name>.outputs.<key>}} - task output values
- {{run.<field>}} - pipeline run metadata
- Multi-channel: IM + Webhook + Email

P3 feature from neatlogic-autoexec comparison analysis."
```

---

## Execution Order

```
Task 1 (P0) → Task 2 (P0)
    ↓
Task 3 (P1) → Task 4 (P1) → Task 5 (P1) → Task 6 (P1)
    ↓
Task 7 (P2) → Task 8 (P2) → Task 9 (P2)
    ↓
Task 10 (P3) → Task 11 (P3)
```

Tasks 1-2 are sequential (P0 core). Tasks 3-6 are sequential (P1 depends on P0 VariableContext). Tasks 7-9 can be parallel within P2. Tasks 10-11 can be parallel within P3.

## Post-Implementation

After all tasks:
1. Update `PipelineEngine` constructor to wire new services
2. Update `StageOrchestrator` to use `StageParameterResolver` and `ConditionRouter`
3. Add YAML schema support for `stageGroups`, `outputs` declarations
4. Run full test suite: `cd orion-platform-service && npm run test`
5. Run type check: `npm run type-check`
6. Update `docs/analysis/neatlogic-autoexec-vs-orion.md` with completion status
