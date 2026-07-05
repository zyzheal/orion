# GrayScale Multi-Target Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Orion PipelineEngine with multi-target grayscale execution capability, enabling a single stage to run across multiple nodes in parallel (oneshot) or sequential batches (grayScale), based on neatlogic-autoexec's domain model.

**Architecture:** Three new focused files form the extension layer — `GrayScaleController` manages batch strategies, `MultiTargetExecutor` handles the actual multi-node orchestration, and an expanded `PipelineStage` model exposes `targets` + `executionMode`. The existing `StageOrchestrator.executePendingStages` detects multi-target stages and delegates to the new executor, keeping the current single-target path fully intact.

**Tech Stack:** TypeScript, Jest (test runner), existing Orion engine patterns (no new dependencies)

## Global Constraints

- Extend `PipelineStage` YAML schema — do NOT modify existing fields
- Single-target execution path must remain 100% backward compatible (no behavior change when `targets` is absent)
- New executor must reuse `StageExecutor.executeStage` for each individual node (no reimplementing stage logic)
- Tests must run via `npx jest -- src/engine/__tests__/GrayScaleController.test.ts` from `orion-platform-service/`
- Code must follow Orion's existing logger pattern: `pino` with `{ runId, stageName }` context

---

## File Structure

```
orion-platform-service/src/
├── models/Pipeline.ts                    # EXPAND — add targets + executionMode to PipelineStage
├── engine/
│   ├── GrayScaleController.ts            # NEW — batch strategy engine (oneshot / grayScale)
│   ├── MultiTargetExecutor.ts            # NEW — multi-node stage orchestration
│   ├── GrayScaleController.test.ts       # NEW — unit tests for GrayScaleController
│   ├── MultiTargetExecutor.test.ts       # NEW — unit tests for MultiTargetExecutor
│   ├── StageOrchestrator.ts             # MODIFY — detect multi-target + delegate
│   └── __tests__/
│       ├── GrayScaleController.test.ts   # NEW
│       └── MultiTargetExecutor.test.ts   # NEW
```

---

### Task 1: Expand PipelineStage Model

**Goal:** Add `targets` and `executionMode` fields to `PipelineStage` so authors can declare multi-node execution in YAML.

**Files:**
- Modify: `orion-platform-service/src/models/Pipeline.ts:33-95`
- Test: `orion-platform-service/src/engine/__tests__/PipelineStageModel.test.ts`

**Interfaces:**
- Consumes: existing `PipelineStage` interface
- Produces: extended `PipelineStage` with `targets` and `executionMode`

```typescript
// PipelineStage extended fields (add after line 94, before closing })
/**
 * Multi-target execution configuration.
 * When present, the stage runs across multiple nodes instead of a single container.
 * Each target is a logical node identity (e.g., server hostname, runner label, IP).
 */
targets?: string[];

/**
 * Execution mode for multi-target stages.
 * - oneshot: all targets execute the stage simultaneously (parallel)
 * - grayScale: targets are split into batches, each batch runs sequentially
 *              after the previous batch completes
 * Ignored when targets is absent or empty.
 */
executionMode?: 'oneshot' | 'grayScale';

/**
 * Batch size for grayScale mode.
 * Number of targets per batch. Defaults to 1 (one target at a time).
 * Ignored when executionMode is not 'grayScale'.
 */
batchSize?: number;
```

**Tests:**

Create `orion-platform-service/src/engine/__tests__/PipelineStageModel.test.ts`:

```typescript
import { PipelineStage } from '../../models/Pipeline';

describe('PipelineStage multi-target extension', () => {
  const baseStage: PipelineStage = {
    name: 'deploy',
    runsOn: 'ubuntu-latest',
    steps: [{ name: 'deploy', uses: 'orion://actions/deploy' }],
  };

  it('single-target stage should not require targets field', () => {
    expect(baseStage.targets).toBeUndefined();
    expect(baseStage.executionMode).toBeUndefined();
  });

  it('multi-target stage with oneshot mode should be valid', () => {
    const stage: PipelineStage = {
      ...baseStage,
      targets: ['node-1', 'node-2', 'node-3'],
      executionMode: 'oneshot',
    };
    expect(stage.targets).toHaveLength(3);
    expect(stage.executionMode).toBe('oneshot');
  });

  it('multi-target stage with grayScale mode and batchSize should be valid', () => {
    const stage: PipelineStage = {
      ...baseStage,
      targets: ['node-1', 'node-2', 'node-3', 'node-4'],
      executionMode: 'grayScale',
      batchSize: 2,
    };
    expect(stage.executionMode).toBe('grayScale');
    expect(stage.batchSize).toBe(2);
  });

  it('grayScale batchSize defaults to 1', () => {
    const stage: PipelineStage = {
      ...baseStage,
      targets: ['node-1'],
      executionMode: 'grayScale',
    };
    expect(stage.batchSize).toBeUndefined();
  });
});
```

- [ ] **Step 1: Write the test** — create `__tests__/PipelineStageModel.test.ts` with 4 test cases above
- [ ] **Step 2: Extend PipelineStage interface** — add `targets`, `executionMode`, `batchSize` fields to `models/Pipeline.ts`
- [ ] **Step 3: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/PipelineStageModel.test.ts -v`
Expected: PASS (4/4)

- [ ] **Step 4: Commit**

```bash
cd orion-platform-service && git add src/models/Pipeline.ts src/engine/__tests__/PipelineStageModel.test.ts
git commit -m "feat: add multi-target fields to PipelineStage model"
```

---

### Task 2: GrayScaleController

**Goal:** Pure-strategy engine that splits a target list into execution batches according to oneshot/grayScale mode.

**Files:**
- Create: `orion-platform-service/src/engine/GrayScaleController.ts`
- Test: `orion-platform-service/src/engine/__tests__/GrayScaleController.test.ts`

**Interfaces:**
- Consumes: `PipelineStage` (with `targets`, `executionMode`, `batchSize`)
- Produces: `ExecutionBatches[]` — ordered array of target batches

```typescript
// GrayScaleController.ts
import { PipelineStage } from '../models/Pipeline';
import { OrionError, ErrorCode } from '../errors';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ExecutionBatch {
  batchIndex: number;
  targets: string[];
  totalTargets: number;
  totalBatches: number;
}

export class GrayScaleController {
  /**
   * Split stage targets into execution batches.
   *
   * @param stage - PipelineStage with targets + executionMode + batchSize
   * @returns ordered ExecutionBatch[] ready for sequential or parallel execution
   * @throws OrionError if targets are empty or batchSize is < 1
   */
  splitBatches(stage: PipelineStage): ExecutionBatch[] {
    const targets = stage.targets ?? [];

    if (targets.length === 0) {
      return [];
    }

    if (!stage.executionMode) {
      // No executionMode declared — treat entire target list as single parallel batch
      return [{
        batchIndex: 0,
        targets: [...targets],
        totalTargets: targets.length,
        totalBatches: 1,
      }];
    }

    const mode = stage.executionMode;

    if (mode === 'oneshot') {
      // All targets in one batch, execute simultaneously
      return [{
        batchIndex: 0,
        targets: [...targets],
        totalTargets: targets.length,
        totalBatches: 1,
      }];
    }

    if (mode === 'grayScale') {
      const batchSize = stage.batchSize && stage.batchSize >= 1
        ? stage.batchSize
        : 1;

      if (batchSize < 1) {
        throw new OrionError(
          `Invalid batchSize ${batchSize} for stage '${stage.name}': must be >= 1`,
          ErrorCode.VALIDATION_ERROR
        );
      }

      const batches: ExecutionBatch[] = [];
      let batchIndex = 0;

      for (let i = 0; i < targets.length; i += batchSize) {
        const batchTargets = targets.slice(i, i + batchSize);
        batches.push({
          batchIndex: batchIndex++,
          targets: batchTargets,
          totalTargets: targets.length,
          totalBatches: Math.ceil(targets.length / batchSize),
        });
      }

      logger.info(
        { stage: stage.name, batchSize, totalBatches: batches.length, totalTargets: targets.length },
        'GrayScale batches split complete'
      );

      return batches;
    }

    // Unknown mode — safe fallback
    logger.warn(
      { stage: stage.name, unknownMode: mode },
      'Unknown executionMode, falling back to oneshot'
    );
    return [{
      batchIndex: 0,
      targets: [...targets],
      totalTargets: targets.length,
      totalBatches: 1,
    }];
  }
}
```

**Tests:**

Create `orion-platform-service/src/engine/__tests__/GrayScaleController.test.ts`:

```typescript
import { GrayScaleController, ExecutionBatch } from '../../engine/GrayScaleController';
import { PipelineStage } from '../../models/Pipeline';

describe('GrayScaleController', () => {
  const controller = new GrayScaleController();

  const makeStage = (overrides: Partial<PipelineStage> = {}): PipelineStage => ({
    name: 'test-stage',
    runsOn: 'ubuntu',
    steps: [{ name: 'run', uses: 'orion://actions/run' }],
    ...overrides,
  });

  describe('no targets', () => {
    it('returns empty array when targets is undefined', () => {
      const stage = makeStage();
      expect(controller.splitBatches(stage)).toEqual([]);
    });

    it('returns empty array when targets is empty', () => {
      const stage = makeStage({ targets: [] });
      expect(controller.splitBatches(stage)).toEqual([]);
    });
  });

  describe('oneshot mode', () => {
    it('returns single batch with all targets', () => {
      const stage = makeStage({
        targets: ['node-1', 'node-2', 'node-3'],
        executionMode: 'oneshot',
      });
      const batches = controller.splitBatches(stage);
      expect(batches).toHaveLength(1);
      expect(batches[0].targets).toEqual(['node-1', 'node-2', 'node-3']);
      expect(batches[0].totalBatches).toBe(1);
      expect(batches[0].totalTargets).toBe(3);
    });
  });

  describe('grayScale mode', () => {
    it('splits into batches of batchSize=2', () => {
      const stage = makeStage({
        targets: ['n1', 'n2', 'n3', 'n4', 'n5'],
        executionMode: 'grayScale',
        batchSize: 2,
      });
      const batches = controller.splitBatches(stage);
      expect(batches).toHaveLength(3);
      expect(batches[0].targets).toEqual(['n1', 'n2']);
      expect(batches[1].targets).toEqual(['n3', 'n4']);
      expect(batches[2].targets).toEqual(['n5']);
      expect(batches[0].totalBatches).toBe(3);
      expect(batches[0].batchIndex).toBe(0);
      expect(batches[1].batchIndex).toBe(1);
      expect(batches[2].batchIndex).toBe(2);
    });

    it('defaults batchSize to 1 when omitted', () => {
      const stage = makeStage({
        targets: ['n1', 'n2'],
        executionMode: 'grayScale',
      });
      const batches = controller.splitBatches(stage);
      expect(batches).toHaveLength(2);
      expect(batches[0].targets).toEqual(['n1']);
      expect(batches[1].targets).toEqual(['n2']);
    });

    it('throws on invalid batchSize < 1', () => {
      const stage = makeStage({
        targets: ['n1'],
        executionMode: 'grayScale',
        batchSize: 0,
      });
      expect(() => controller.splitBatches(stage)).toThrow();
    });
  });

  describe('no executionMode declared', () => {
    it('treats all targets as single parallel batch', () => {
      const stage = makeStage({
        targets: ['n1', 'n2'],
      });
      const batches = controller.splitBatches(stage);
      expect(batches).toHaveLength(1);
      expect(batches[0].targets).toEqual(['n1', 'n2']);
    });
  });
});
```

- [ ] **Step 1: Write the test** — create `__tests__/GrayScaleController.test.ts` with 8 test cases above
- [ ] **Step 2: Run test to verify it fails** (file not found)

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/GrayScaleController.test.ts -v`
Expected: FAIL — "No tests found" or file not found

- [ ] **Step 3: Implement GrayScaleController** — create `src/engine/GrayScaleController.ts` with `ExecutionBatch` interface + `splitBatches` method
- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/GrayScaleController.test.ts -v`
Expected: PASS (8/8)

- [ ] **Step 5: Commit**

```bash
cd orion-platform-service && git add src/engine/GrayScaleController.ts src/engine/__tests__/GrayScaleController.test.ts
git commit -m "feat: add GrayScaleController for multi-target batch strategy"
```

---

### Task 3: MultiTargetExecutor

**Goal:** Execute a single stage across multiple target nodes, running batches sequentially (for grayScale) or in parallel (for oneshot). Each individual node execution delegates to the existing `StageExecutor`.

**Files:**
- Create: `orion-platform-service/src/engine/MultiTargetExecutor.ts`
- Test: `orion-platform-service/src/engine/__tests__/MultiTargetExecutor.test.ts`

**Interfaces:**
- Consumes: `GrayScaleController`, `StageExecutor`, `PipelineRun`, `PipelineExecution`, `PipelineStage`, `ExecutionBatch[]`
- Produces: `MultiTargetResult` — per-batch and per-target outcomes

```typescript
// MultiTargetExecutor.ts
import { StageExecutor } from './StageExecutor';
import { GrayScaleController, ExecutionBatch } from './GrayScaleController';
import { PipelineRun, PipelineRunStatus } from '../models/PipelineRun';
import { PipelineExecution } from './PipelineEngine';
import { PipelineStage } from '../models/Pipeline';
import { OrionError, ErrorCode } from '../errors';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface TargetResult {
  target: string;
  batchIndex: number;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface BatchResult {
  batchIndex: number;
  targets: string[];
  targetResults: TargetResult[];
  batchSuccess: boolean;
}

export interface MultiTargetResult {
  stageName: string;
  executionMode: string;
  totalTargets: number;
  totalBatches: number;
  batchResults: BatchResult[];
  overallSuccess: boolean;
}

export class MultiTargetExecutor {
  private grayscaleController: GrayScaleController;
  private stageExecutor: StageExecutor;

  constructor(
    grayscaleController: GrayScaleController,
    stageExecutor: StageExecutor
  ) {
    this.grayscaleController = grayscaleController;
    this.stageExecutor = stageExecutor;
  }

  /**
   * Execute a multi-target stage.
   *
   * GrayScale: batches run sequentially, within a batch targets run in parallel.
   * Oneshot: all targets run in parallel as a single batch.
   * If a target in grayScale batch fails, the entire stage is marked failed.
   *
   * @param run - current PipelineRun
   * @param execution - current PipelineExecution
   * @param stage - PipelineStage with targets + executionMode
   * @returns MultiTargetResult with per-target outcomes
   */
  async execute(
    run: PipelineRun,
    execution: PipelineExecution,
    stage: PipelineStage
  ): Promise<MultiTargetResult> {
    const batches = this.grayscaleController.splitBatches(stage);

    if (batches.length === 0) {
      throw new OrionError(
        `Stage '${stage.name}' has no targets to execute`,
        ErrorCode.VALIDATION_ERROR
      );
    }

    const mode = stage.executionMode ?? 'oneshot';
    const batchResults: BatchResult[] = [];
    let overallSuccess = true;

    logger.info(
      { runId: run.id, stage: stage.name, mode, totalBatches: batches.length, totalTargets: batches.reduce((s, b) => s + b.targets.length, 0) },
      'MultiTargetExecutor starting'
    );

    for (const batch of batches) {
      const batchStart = Date.now();
      const targetResults: TargetResult[] = [];

      if (mode === 'oneshot') {
        // Parallel execution within batch
        const promises = batch.targets.map(async (target) => {
          return this.executeTarget(run, execution, stage, target, batch.batchIndex);
        });
        const results = await Promise.all(promises);
        targetResults.push(...results);
      } else {
        // grayScale: parallel within batch, but batches are sequential (for-loop)
        const promises = batch.targets.map(async (target) => {
          return this.executeTarget(run, execution, stage, target, batch.batchIndex);
        });
        const results = await Promise.all(promises);
        targetResults.push(...results);
      }

      const batchDuration = Date.now() - batchStart;
      const batchSuccess = targetResults.every((r) => r.success);
      if (!batchSuccess) overallSuccess = false;

      logger.info(
        { runId: run.id, stage: stage.name, batchIndex: batch.batchIndex, batchSuccess, batchDuration }
      );

      batchResults.push({
        batchIndex: batch.batchIndex,
        targets: batch.targets,
        targetResults,
        batchSuccess,
      });

      // In grayScale mode, if this batch failed, stop remaining batches
      if (!batchSuccess && mode === 'grayScale') {
        logger.warn(
          { runId: run.id, stage: stage.name, failedBatch: batch.batchIndex },
          'GrayScale batch failed, stopping remaining batches'
        );
        break;
      }
    }

    logger.info(
      { runId: run.id, stage: stage.name, overallSuccess, totalBatches: batchResults.length },
      'MultiTargetExecutor complete'
    );

    return {
      stageName: stage.name,
      executionMode: mode,
      totalTargets: batches.reduce((s, b) => s + b.targets.length, 0),
      totalBatches: batches.length,
      batchResults,
      overallSuccess,
    };
  }

  /**
   * Execute stage for a single target node.
   * Creates a temporary stage copy with target label in logs for traceability.
   */
  private async executeTarget(
    run: PipelineRun,
    execution: PipelineExecution,
    stage: PipelineStage,
    target: string,
    batchIndex: number
  ): Promise<TargetResult> {
    const start = Date.now();
    const targetLabel = `${stage.name}[${target}]`;

    try {
      // Create a copy of stage with target-specific naming for uniqueness
      const targetedStage: PipelineStage = {
        ...stage,
        name: targetLabel,
        steps: stage.steps.map((step) => ({
          ...step,
          name: `${step.name}-${target}`,
        })),
      };

      // Delegate to existing StageExecutor for actual stage execution
      await this.stageExecutor.executeStage(
        run.pipelineId,
        run.id,
        targetedStage,
        execution as any
      );

      return {
        target,
        batchIndex,
        success: true,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      logger.error(
        { runId: run.id, target, batchIndex, error: err.message },
        `Target execution failed`
      );
      return {
        target,
        batchIndex,
        success: false,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }
}
```

**Tests:**

Create `orion-platform-service/src/engine/__tests__/MultiTargetExecutor.test.ts`:

```typescript
import { MultiTargetExecutor, MultiTargetResult, BatchResult, TargetResult } from '../../engine/MultiTargetExecutor';
import { GrayScaleController } from '../../engine/GrayScaleController';
import { StageExecutor } from '../../engine/StageExecutor';
import { PipelineRun } from '../../models/PipelineRun';
import { PipelineExecution } from '../../engine/PipelineEngine';
import { PipelineStage } from '../../models/Pipeline';

describe('MultiTargetExecutor', () => {
  let executor: MultiTargetExecutor;
  let grayscaleController: GrayScaleController;
  let mockStageExecutor: jest.Mocked<StageExecutor>;

  beforeEach(() => {
    grayscaleController = new GrayScaleController();
    mockStageExecutor = {
      executeStage: jest.fn(),
    } as any;
    executor = new MultiTargetExecutor(grayscaleController, mockStageExecutor);
  });

  const makeRun = (): PipelineRun => ({
    id: 'run-1',
    pipelineId: 'pipe-1',
    status: 'running' as any,
    triggerType: 'api' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const makeExecution = (): PipelineExecution => ({
    run: makeRun(),
    stages: new Map(),
    pendingStages: new Set(),
    runningStages: new Set(),
    completedStages: new Set(),
  });

  const makeStage = (overrides: Partial<PipelineStage> = {}): PipelineStage => ({
    name: 'deploy',
    runsOn: 'ubuntu',
    steps: [{ name: 'deploy', uses: 'orion://actions/deploy' }],
    ...overrides,
  });

  describe('execute oneshot', () => {
    it('runs all targets in parallel and returns success', async () => {
      const stage = makeStage({
        targets: ['n1', 'n2'],
        executionMode: 'oneshot',
      });

      mockStageExecutor.executeStage.mockResolvedValue(undefined as any);

      const result = await executor.execute(makeRun(), makeExecution(), stage);

      expect(mockStageExecutor.executeStage).toHaveBeenCalledTimes(2);
      expect(result.overallSuccess).toBe(true);
      expect(result.totalBatches).toBe(1);
      expect(result.batchResults[0].targetResults).toHaveLength(2);
    });

    it('returns failure when a target throws', async () => {
      const stage = makeStage({
        targets: ['n1', 'n2'],
        executionMode: 'oneshot',
      });

      mockStageExecutor.executeStage
        .mockResolvedValueOnce(undefined as any)
        .mockRejectedValueOnce(new Error('timeout'));

      const result = await executor.execute(makeRun(), makeExecution(), stage);

      expect(result.overallSuccess).toBe(false);
      const results = result.batchResults[0].targetResults;
      expect(results.some((r: TargetResult) => !r.success)).toBe(true);
    });
  });

  describe('execute grayScale', () => {
    it('runs batches sequentially, parallel within batch', async () => {
      const stage = makeStage({
        targets: ['n1', 'n2', 'n3', 'n4'],
        executionMode: 'grayScale',
        batchSize: 2,
      });

      mockStageExecutor.executeStage.mockResolvedValue(undefined as any);

      const result = await executor.execute(makeRun(), makeExecution(), stage);

      expect(result.totalBatches).toBe(2);
      expect(mockStageExecutor.executeStage).toHaveBeenCalledTimes(4);
      expect(result.batchResults[0].targetResults).toHaveLength(2);
      expect(result.batchResults[1].targetResults).toHaveLength(2);
    });

    it('stops remaining batches when a grayScale batch fails', async () => {
      const stage = makeStage({
        targets: ['n1', 'n2', 'n3', 'n4'],
        executionMode: 'grayScale',
        batchSize: 2,
      });

      mockStageExecutor.executeStage
        .mockRejectedValueOnce(new Error('node-1 down'));

      const result = await executor.execute(makeRun(), makeExecution(), stage);

      expect(result.totalBatches).toBeLessThanOrEqual(2);
      expect(result.batchResults[0].batchSuccess).toBe(false);
      expect(result.overallSuccess).toBe(false);
    });
  });

  describe('empty targets', () => {
    it('throws when targets is empty', async () => {
      const stage = makeStage({ targets: [], executionMode: 'oneshot' });
      await expect(executor.execute(makeRun(), makeExecution(), stage))
        .rejects.toThrow();
    });
  });

  describe('per-target result', () => {
    it('records durationMs for each target', async () => {
      const stage = makeStage({
        targets: ['n1'],
        executionMode: 'oneshot',
      });

      mockStageExecutor.executeStage.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      const result = await executor.execute(makeRun(), makeExecution(), stage);
      const targetResult = result.batchResults[0].targetResults[0];
      expect(targetResult.durationMs).toBeGreaterThanOrEqual(10);
    });
  });
});
```

- [ ] **Step 1: Write the test** — create `__tests__/MultiTargetExecutor.test.ts` with 8 test cases above
- [ ] **Step 2: Run test to verify it fails** (file not found)

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/MultiTargetExecutor.test.ts -v`
Expected: FAIL — file not found

- [ ] **Step 3: Implement MultiTargetExecutor** — create `src/engine/MultiTargetExecutor.ts`
- [ ] **Step 4: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/MultiTargetExecutor.test.ts -v`
Expected: PASS (8/8)

- [ ] **Step 5: Commit**

```bash
cd orion-platform-service && git add src/engine/MultiTargetExecutor.ts src/engine/__tests__/MultiTargetExecutor.test.ts
git commit -m "feat: add MultiTargetExecutor for multi-node stage orchestration"
```

---

### Task 4: Integrate into StageOrchestrator

**Goal:** Wire MultiTargetExecutor into the existing execution flow. When `executePendingStages` picks up a stage with `targets` declared, it delegates to MultiTargetExecutor. All other stages follow the original single-target path unchanged.

**Files:**
- Modify: `orion-platform-service/src/engine/StageOrchestrator.ts`
- Modify: `orion-platform-service/src/engine/PipelineEngine.ts`

**Interfaces:**
- Consumes: `GrayScaleController`, `MultiTargetExecutor`, `MultiTargetResult`
- Produces: updated `executePendingStages` with multi-target detection

**Step 1: Read current StageOrchestrator.ts lines 39-180** to understand the constructor and `executePendingStages` signature before editing.

**Step 2: Add MultiTargetExecutor to StageOrchestratorDeps**

```typescript
// StageOrchestrator.ts — add to imports at top
import { GrayScaleController } from './GrayScaleController';
import { MultiTargetExecutor, MultiTargetResult } from './MultiTargetExecutor';

// Add to StageOrchestratorDeps interface (around line 39)
export interface StageOrchestratorDeps {
  // ... existing fields ...
  grayscaleController: GrayScaleController;
  multiTargetExecutor: MultiTargetExecutor;
}
```

**Step 3: Store deps in constructor + add multi-target branch in `executePendingStages`**

```typescript
// StageOrchestrator constructor — add after existing assignments:
this.grayscaleController = deps.grayscaleController;
this.multiTargetExecutor = deps.multiTargetExecutor;

// Inside executePendingStages — add multi-target detection BEFORE existing stage execution:
private async executePendingStages(
  execution: PipelineExecution,
  callbacks: {
    onComplete: (run: PipelineRun) => void;
    onFailure: (run: PipelineRun, error: Error) => void;
  }
): Promise<void> {
  // ... existing pending stage collection logic ...

  for (const stage of pendingStages) {
    // === NEW: Multi-target detection ===
    const hasTargets = stage.targets && stage.targets.length > 0;

    if (hasTargets) {
      logger.info(
        { runId: execution.run.id, stage: stage.name, targetCount: stage.targets!.length },
        'Delegating to MultiTargetExecutor'
      );

      const result: MultiTargetResult = await this.multiTargetExecutor.execute(
        execution.run,
        execution,
        stage
      );

      if (result.overallSuccess) {
        execution.completedStages.add(stage.name);
        execution.pendingStages.delete(stage.name);
      } else {
        // Mark run as failed
        execution.run.status = PipelineRunStatus.FAILED;
        execution.run.updatedAt = new Date();
        callbacks.onFailure(execution.run, new OrionError(
          `Stage '${stage.name}' multi-target execution failed`,
          'STAGE_FAILED'
        ));
        return;
      }

      continue; // Skip original single-target execution for this stage
    }

    // === ORIGINAL single-target path (unchanged) ===
    // ... existing code ...
  }
}
```

**Step 4: Update PipelineEngine to pass new deps**

```typescript
// PipelineEngine.ts — constructor changes:
import { GrayScaleController } from './GrayScaleController';
import { MultiTargetExecutor } from './MultiTargetExecutor';

// In constructor, after existing deps:
this.grayscaleController = new GrayScaleController();
this.multiTargetExecutor = new MultiTargetExecutor(
  this.grayscaleController,
  this.stageExecutor
);

// Update StageOrchestrator instantiation (find where stageOrchestrator is created):
this.stageOrchestrator = new StageOrchestrator({
  // ... existing deps ...
  grayscaleController: this.grayscaleController,
  multiTargetExecutor: this.multiTargetExecutor,
});
```

**Tests:**

Create `orion-platform-service/src/engine/__tests__/MultiTargetIntegration.test.ts`:

```typescript
import { StageOrchestrator } from '../../engine/StageOrchestrator';
import { MultiTargetExecutor, MultiTargetResult } from '../../engine/MultiTargetExecutor';
import { GrayScaleController } from '../../engine/GrayScaleController';
import { StageExecutor } from '../../engine/StageExecutor';
import { PipelineRun } from '../../models/PipelineRun';
import { PipelineExecution } from '../../engine/PipelineEngine';
import { PipelineStage } from '../../models/Pipeline';
import { OrionError } from '../../errors';

describe('Multi-target StageOrchestrator integration', () => {
  let orchestrator: StageOrchestrator;
  let grayscaleController: GrayScaleController;
  let mockStageExecutor: jest.Mocked<StageExecutor>;
  let mockMultiTargetExecutor: jest.Mocked<MultiTargetExecutor>;

  beforeEach(() => {
    grayscaleController = new GrayScaleController();
    mockStageExecutor = { executeStage: jest.fn() } as any;
    mockMultiTargetExecutor = {
      execute: jest.fn(),
    } as any;

    orchestrator = new StageOrchestrator({
      pipelineService: {} as any,
      stageExecutor: mockStageExecutor,
      grayscaleController,
      multiTargetExecutor: mockMultiTargetExecutor as any,
    });
  });

  it('delegates multi-target stage to MultiTargetExecutor', async () => {
    const stage: PipelineStage = {
      name: 'deploy',
      runsOn: 'ubuntu',
      steps: [{ name: 'deploy', uses: 'orion://actions/deploy' }],
      targets: ['n1', 'n2'],
      executionMode: 'oneshot',
    };

    const mockResult: MultiTargetResult = {
      stageName: 'deploy',
      executionMode: 'oneshot',
      totalTargets: 2,
      totalBatches: 1,
      batchResults: [],
      overallSuccess: true,
    };

    mockMultiTargetExecutor.execute.mockResolvedValue(mockResult);

    const run: PipelineRun = {
      id: 'run-1',
      pipelineId: 'pipe-1',
      status: 'running' as any,
      triggerType: 'api' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const execution: PipelineExecution = {
      run,
      stages: new Map(),
      pendingStages: new Set(['deploy']),
      runningStages: new Set(),
      completedStages: new Set(),
    };

    await orchestrator.executePendingStages(execution, {
      onComplete: jest.fn(),
      onFailure: jest.fn(),
    });

    expect(mockMultiTargetExecutor.execute).toHaveBeenCalledWith(
      run,
      execution,
      expect.objectContaining({ name: 'deploy', targets: ['n1', 'n2'] })
    );
    expect(mockStageExecutor.executeStage).not.toHaveBeenCalled();
  });

  it('falls through to single-target path when targets absent', async () => {
    const stage: PipelineStage = {
      name: 'build',
      runsOn: 'ubuntu',
      steps: [{ name: 'build', uses: 'orion://actions/build' }],
    };

    mockStageExecutor.executeStage.mockResolvedValue({} as any);

    // ... setup execution ...
    expect(mockMultiTargetExecutor.execute).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 1: Read StageOrchestrator.ts constructor + executePendingStages** (lines 39-180)
- [ ] **Step 2: Write integration test** — create `__tests__/MultiTargetIntegration.test.ts`
- [ ] **Step 3: Run test to verify it fails** (expected failures from missing deps)

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/MultiTargetIntegration.test.ts -v`
Expected: FAIL — missing deps fields

- [ ] **Step 4: Add deps to StageOrchestratorDeps + constructor**
- [ ] **Step 5: Add multi-target branch in executePendingStages**
- [ ] **Step 6: Update PipelineEngine constructor to pass new deps**
- [ ] **Step 7: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest -- src/engine/__tests__/MultiTargetIntegration.test.ts -v`
Expected: PASS (2/2)

- [ ] **Step 8: Run all engine tests to verify no regression**

Run: `cd orion-platform-service && npx jest -- src/engine/ -v`
Expected: PASS — all existing tests still green

- [ ] **Step 9: Commit**

```bash
cd orion-platform-service && git add src/engine/StageOrchestrator.ts src/engine/PipelineEngine.ts src/engine/__tests__/MultiTargetIntegration.test.ts
git commit -m "feat: integrate MultiTargetExecutor into StageOrchestrator"
```

---

### Task 5: YAML Example + Validation

**Goal:** Add a YAML usage example and ensure parsePipelineYaml handles the new fields correctly.

**Files:**
- Modify: `orion-platform-service/src/models/Pipeline.ts` (parsePipelineYaml already handles arbitrary fields via js-yaml)
- Create: `orion-platform-service/docs/examples/multi-target-pipeline.yaml`

**Interfaces:**
- Consumes: extended `PipelineStage`
- Produces: working YAML example

```yaml
# multi-target-pipeline.yaml
apiVersion: orion/v1
kind: Pipeline
metadata:
  name: multi-node-deploy
  version: 1.0.0
spec:
  triggers:
    - type: api
  stages:
    # Single-target stage (original behavior, unchanged)
    - name: build
      runsOn: ubuntu-latest
      steps:
        - name: compile
          uses: orion://actions/build

    # Oneshot: deploy to 3 nodes simultaneously
    - name: deploy
      runsOn: ubuntu-latest
      targets: [web-node-1, web-node-2, web-node-3]
      executionMode: oneshot
      steps:
        - name: deploy-service
          uses: orion://actions/deploy
          with:
            service: web-frontend

    # GrayScale: roll out to 6 nodes, 2 at a time
    - name: rolling-restart
      runsOn: ubuntu-latest
      targets:
        - web-node-1
        - web-node-2
        - web-node-3
        - web-node-4
        - web-node-5
        - web-node-6
      executionMode: grayScale
      batchSize: 2
      steps:
        - name: restart
          uses: orion://actions/restart
```

**Validation test:**

Add to `__tests__/PipelineStageModel.test.ts`:

```typescript
import { parsePipelineYaml } from '../../models/Pipeline';

describe('parsePipelineYaml multi-target support', () => {
  it('parses YAML with oneshot targets', () => {
    const yaml = `
apiVersion: orion/v1
kind: Pipeline
metadata:
  name: test
  version: 1.0
spec:
  stages:
    - name: deploy
      runsOn: ubuntu
      targets: [n1, n2]
      executionMode: oneshot
      steps: [{ name: 'd', uses: 'orion://actions/d' }]
`;
    const { spec } = parsePipelineYaml(yaml);
    expect(spec.stages[0].targets).toEqual(['n1', 'n2']);
    expect(spec.stages[0].executionMode).toBe('oneshot');
  });

  it('parses YAML with grayScale targets', () => {
    const yaml = `
apiVersion: orion/v1
kind: Pipeline
metadata:
  name: test
  version: 1.0
spec:
  stages:
    - name: rollout
      runsOn: ubuntu
      targets: [n1, n2, n3, n4]
      executionMode: grayScale
      batchSize: 2
      steps: [{ name: 'r', uses: 'orion://actions/r' }]
`;
    const { spec } = parsePipelineYaml(yaml);
    expect(spec.stages[0].executionMode).toBe('grayScale');
    expect(spec.stages[0].batchSize).toBe(2);
  });
});
```

- [ ] **Step 1: Create YAML example** — `docs/examples/multi-target-pipeline.yaml`
- [ ] **Step 2: Add parsePipelineYaml validation tests**
- [ ] **Step 3: Run all engine tests**

Run: `cd orion-platform-service && npx jest -- src/engine/ -v`
Expected: PASS — all tests green

- [ ] **Step 4: Commit**

```bash
cd orion-platform-service && git add docs/examples/multi-target-pipeline.yaml src/models/Pipeline.ts src/engine/__tests__/PipelineStageModel.test.ts
git commit -m "feat: add multi-target pipeline YAML example and validation"
```

---

## Verification Checklist

After all tasks complete, run these commands from `orion-platform-service/`:

| Check | Command | Expected |
|-------|---------|----------|
| All engine tests | `npx jest -- src/engine/ -v` | PASS, 0 failures |
| Model tests | `npx jest -- src/models/ -v` | PASS |
| Type check | `npx tsc --noEmit` | No new errors |
| Lint | `npx eslint src/engine/GrayScaleController.ts src/engine/MultiTargetExecutor.ts` | No new warnings |

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `src/models/Pipeline.ts` | EXPANDED — add `targets`, `executionMode`, `batchSize` |
| `src/engine/GrayScaleController.ts` | NEW — split target list into execution batches |
| `src/engine/MultiTargetExecutor.ts` | NEW — run stage across nodes, parallel/sequential |
| `src/engine/__tests__/GrayScaleController.test.ts` | NEW — 8 unit tests |
| `src/engine/__tests__/MultiTargetExecutor.test.ts` | NEW — 8 unit tests |
| `src/engine/__tests__/MultiTargetIntegration.test.ts` | NEW — 2 integration tests |
| `src/engine/__tests__/PipelineStageModel.test.ts` | NEW — 4 model + 2 YAML parse tests |
| `docs/examples/multi-target-pipeline.yaml` | NEW — YAML usage example |

## Summary of Modified Files

| File | Changes |
|------|---------|
| `src/engine/StageOrchestrator.ts` | Add multi-target deps + delegation branch |
| `src/engine/PipelineEngine.ts` | Instantiate new deps, pass to StageOrchestrator |
