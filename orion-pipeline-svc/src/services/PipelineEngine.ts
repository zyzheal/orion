// src/services/PipelineEngine.ts
// Pipeline 执行引擎 — 实现 DAG 拓扑排序、阶段调度、状态机流转

import type { FastifyBaseLogger } from 'fastify';
import type { Pipeline, PipelineRun, PipelineStage, StageRunResult, PipelineRunStatus } from '../types/pipeline';

export interface PipelineEngineOptions {
  logger: FastifyBaseLogger;
  maxConcurrentRuns?: number;
  defaultTimeoutMs?: number;
}

// In-memory run store
const runStore = new Map<string, PipelineRun>();

// Internal extended run state for execution tracking
interface ExtendedRunState {
  run: PipelineRun;
  stageStates: Map<string, {
    stageId: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';
    dependsOn: string[];
    startedAt?: string;
    completedAt?: string;
  }>;
}

const extendedStore = new Map<string, ExtendedRunState>();

// TTL cleanup for completed runs (prevent memory leak)
const MAX_RUN_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, run] of runStore) {
    const terminalStatuses = ['success', 'failed', 'cancelled'];
    if (run.status && terminalStatuses.includes(run.status) && run.finishedAt) {
      const age = now - new Date(run.finishedAt).getTime();
      if (age > MAX_RUN_AGE_MS) {
        runStore.delete(id);
        extendedStore.delete(id);
      }
    }
  }
}, CLEANUP_INTERVAL_MS);
cleanupInterval.unref(); // Don't block process exit

export class PipelineEngine {
  private logger: FastifyBaseLogger;
  private maxConcurrentRuns: number;
  private defaultTimeoutMs: number;

  constructor(options: PipelineEngineOptions) {
    this.logger = options.logger.child({ service: 'PipelineEngine' });
    this.maxConcurrentRuns = options.maxConcurrentRuns ?? 10;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 3600000;
  }

  /**
   * 运行 Pipeline
   * 解析 stage 依赖图，按拓扑顺序调度执行
   */
  async runPipeline(
    pipeline: Pipeline,
    triggerType: 'manual' | 'schedule' | 'webhook' | 'event',
    options?: {
      envOverrides?: Record<string, string>;
      stageIds?: string[];
      triggeredByUserId?: string;
    }
  ): Promise<PipelineRun> {
    this.logger.info(
      { pipelineId: pipeline.id, triggerType },
      'Running pipeline'
    );

    // Validate DAG
    const dagValidation = PipelineEngine.validateDag(pipeline.stages);
    if (!dagValidation.valid) {
      throw new Error(`Invalid pipeline DAG: ${dagValidation.error}`);
    }

    // Create PipelineRun record
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const run: PipelineRun = {
      runId,
      pipelineId: pipeline.id,
      tenantId: pipeline.tenantId,
      status: 'running',
      stageResults: {},
      startedAt: now,
      triggeredBy: triggerType,
      triggeredByUserId: options?.triggeredByUserId,
    };

    // Create extended state for execution tracking
    const stagesToRun = options?.stageIds
      ? pipeline.stages.filter(s => options.stageIds!.includes(s.id))
      : pipeline.stages;

    const stageStates = new Map();
    for (const s of stagesToRun) {
      stageStates.set(s.id, {
        stageId: s.id,
        name: s.name,
        status: 'pending' as const,
        dependsOn: s.dependsOn || [],
      });
    }

    const extState: ExtendedRunState = { run, stageStates };
    runStore.set(runId, run);
    extendedStore.set(runId, extState);

    // Schedule first stages (those with no dependencies)
    await this.scheduleNextStages(runId, pipeline, '', run.stageResults);

    return run;
  }

  /**
   * 执行单个阶段
   */
  async executeStage(
    runId: string,
    pipelineId: string,
    stage: PipelineStage,
    env: Record<string, string>
  ): Promise<StageRunResult> {
    this.logger.info({ runId, stageId: stage.id }, 'Executing stage');

    const extState = extendedStore.get(runId);
    if (!extState) {
      throw new Error(`Run ${runId} not found`);
    }

    const { run, stageStates } = extState;
    const stageState = stageStates.get(stage.id);
    if (!stageState) {
      throw new Error(`Stage ${stage.id} not found in run ${runId}`);
    }

    // Update stage status to running
    stageState.status = 'running';
    stageState.startedAt = new Date().toISOString();
    run.currentStage = stage.id;

    try {
      // TODO: In production, dispatch to agent/Tekton for actual execution
      // For now, simulate stage execution
      const result: StageRunResult = {
        stageId: stage.id,
        status: 'success',
        startedAt: stageState.startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: 0,
      };

      run.stageResults[stage.id] = result;
      stageState.status = 'success';
      stageState.completedAt = result.finishedAt;

      return result;
    } catch (error: any) {
      const result: StageRunResult = {
        stageId: stage.id,
        status: 'failed',
        startedAt: stageState.startedAt || new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 1,
      };

      run.stageResults[stage.id] = result;
      stageState.status = 'failed';
      stageState.completedAt = result.finishedAt;

      // Mark run as failed
      run.status = 'failed';
      run.finishedAt = result.finishedAt;

      throw error;
    }
  }

  /**
   * 取消运行
   */
  async cancelRun(runId: string, pipelineId: string): Promise<void> {
    this.logger.info({ runId, pipelineId }, 'Cancelling pipeline run');

    const extState = extendedStore.get(runId);
    if (!extState) {
      throw new Error(`Run ${runId} not found`);
    }

    const { run, stageStates } = extState;

    if (run.status !== 'running' && run.status !== 'pending') {
      throw new Error(`Run ${runId} cannot be cancelled (status: ${run.status})`);
    }

    const now = new Date().toISOString();

    // Cancel all running/pending stages
    for (const [, state] of stageStates) {
      if (state.status === 'running' || state.status === 'pending') {
        state.status = 'cancelled';
        state.completedAt = now;
      }
    }

    run.status = 'cancelled';
    run.finishedAt = now;
  }

  /**
   * Execute a pipeline by ID (used by SCM webhook triggers).
   * Creates a minimal pipeline from the given ID and context.
   */
  async execute(
    pipelineId: string,
    triggerType: string,
    triggeredBy: string,
    context: Record<string, unknown> = {}
  ): Promise<PipelineRun> {
    this.logger.info({ pipelineId, triggerType, triggeredBy }, 'Executing pipeline from trigger');

    // Create a minimal pipeline for webhook-triggered execution
    const pipeline: Pipeline = {
      id: pipelineId,
      tenantId: '00000000-0000-0000-0000-000000000000',
      projectId: '00000000-0000-0000-0000-000000000000',
      name: pipelineId,
      status: 'active',
      stages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
    };

    return this.runPipeline(pipeline, triggerType as any, {
      triggeredByUserId: triggeredBy,
      envOverrides: context as any,
    });
  }

  /**
   * 获取实时日志流 (SSE)
   */
  async *getLogStream(runId: string): AsyncIterableIterator<string> {
    const run = runStore.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    yield JSON.stringify({
      type: 'run',
      runId: run.runId,
      status: run.status,
      stageResults: run.stageResults,
    });

    // TODO: In production, subscribe to Redis pub/sub for real-time updates
    yield JSON.stringify({
      type: 'info',
      message: 'Real-time streaming requires Redis pub/sub integration',
    });
  }

  /**
   * 处理阶段完成后的下一阶段调度
   */
  private async scheduleNextStages(
    runId: string,
    pipeline: Pipeline,
    completedStageId: string,
    stageResults: Record<string, StageRunResult>
  ): Promise<void> {
    const extState = extendedStore.get(runId);
    if (!extState || extState.run.status !== 'running') return;

    const { run, stageStates } = extState;

    // Find all stages whose dependencies are satisfied
    const readyStages = pipeline.stages.filter(stage => {
      if (!stage.dependsOn || stage.dependsOn.length === 0) {
        const state = stageStates.get(stage.id);
        return state?.status === 'pending';
      }

      const allDepsDone = stage.dependsOn.every(depId => {
        const result = stageResults[depId];
        return result && result.status === 'success';
      });

      const state = stageStates.get(stage.id);
      return allDepsDone && state?.status === 'pending';
    });

    // Execute ready stages
    for (const stage of readyStages) {
      try {
        await this.executeStage(runId, pipeline.id, stage, {});
        await this.scheduleNextStages(runId, pipeline, stage.id, run.stageResults);
      } catch {
        return;
      }
    }

    // Check if all stages are done
    const allDone = Array.from(stageStates.values()).every(
      s => s.status === 'success' || s.status === 'failed' || s.status === 'skipped' || s.status === 'cancelled'
    );

    if (allDone) {
      const hasFailure = Array.from(stageStates.values()).some(s => s.status === 'failed');
      run.status = hasFailure ? 'failed' : 'success';
      run.finishedAt = new Date().toISOString();
    }
  }

  /**
   * 检查 stage DAG 是否有环
   */
  static validateDag(stages: PipelineStage[]): { valid: boolean; error?: string } {
    const stageIds = new Set(stages.map(s => s.id));

    // Check all references exist
    for (const stage of stages) {
      for (const dep of stage.dependsOn || []) {
        if (!stageIds.has(dep)) {
          return { valid: false, error: `Stage "${stage.id}" depends on non-existent stage "${dep}"` };
        }
      }
    }

    // Topological sort with cycle detection (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const stage of stages) {
      inDegree.set(stage.id, 0);
      adjacency.set(stage.id, []);
    }

    for (const stage of stages) {
      for (const dep of stage.dependsOn || []) {
        adjacency.get(dep)!.push(stage.id);
        inDegree.set(stage.id, (inDegree.get(stage.id) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    let visited = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visited++;
      for (const neighbor of adjacency.get(current) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (visited !== stages.length) {
      return { valid: false, error: 'Cycle detected in pipeline DAG' };
    }

    return { valid: true };
  }
}
