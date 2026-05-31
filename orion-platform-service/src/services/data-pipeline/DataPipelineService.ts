import {
  DataPipeline,
  DataPipelineInput,
  PipelineExecution,
  DataLineage,
} from './types';
import { OrionError, ErrorCode } from '../../errors';

/**
 * DataPipelineService — manages data pipeline CRUD, execution, scheduling, and lineage.
 * Uses in-memory Map storage with tenant isolation.
 */
export class DataPipelineService {
  private pipelines = new Map<string, DataPipeline>();
  private executions = new Map<string, PipelineExecution>();
  private timers = new Map<string, NodeJS.Timeout>();

  // ---- CRUD ----

  createPipeline(tenantId: string, input: DataPipelineInput): DataPipeline {
    const now = new Date().toISOString();
    const id = `dp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pipeline: DataPipeline = {
      id,
      tenantId,
      name: input.name,
      description: input.description,
      stages: input.stages,
      status: input.schedule ? 'scheduled' : 'draft',
      schedule: input.schedule,
      createdAt: now,
      updatedAt: now,
    };
    this.pipelines.set(id, pipeline);

    if (input.schedule) {
      this.schedulePipelineInternal(id, input.schedule);
    }

    return pipeline;
  }

  getPipeline(pipelineId: string): DataPipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  listPipelines(tenantId: string): DataPipeline[] {
    return Array.from(this.pipelines.values()).filter(
      (p) => p.tenantId === tenantId,
    );
  }

  updatePipeline(
    pipelineId: string,
    updates: Partial<Pick<DataPipeline, 'name' | 'description' | 'stages' | 'status'>>,
  ): DataPipeline | undefined {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return undefined;
    Object.assign(pipeline, updates, { updatedAt: new Date().toISOString() });
    return pipeline;
  }

  deletePipeline(pipelineId: string): boolean {
    this.unschedulePipeline(pipelineId);
    return this.pipelines.delete(pipelineId);
  }

  // ---- Execution ----

  async executePipeline(pipelineId: string): Promise<PipelineExecution> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Pipeline ${pipelineId} not found`);
    }

    const execId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const execution: PipelineExecution = {
      id: execId,
      pipelineId,
      tenantId: pipeline.tenantId,
      status: 'running',
      startedAt: new Date().toISOString(),
      stagesResults: pipeline.stages.map((s) => ({
        stageId: s.id,
        stageName: s.name,
        status: 'pending',
        recordsProcessed: 0,
      })),
    };
    this.executions.set(execId, execution);

    pipeline.status = 'running';
    pipeline.lastRunAt = new Date().toISOString();
    pipeline.updatedAt = new Date().toISOString();

    // Execute stages sequentially respecting dependencies
    const stageMap = new Map(pipeline.stages.map((s) => [s.id, s]));
    for (const stage of pipeline.stages) {
      const stageResult = execution.stagesResults.find(
        (r) => r.stageId === stage.id,
      );
      if (!stageResult) continue;

      // Check dependencies
      if (stage.dependsOn && stage.dependsOn.length > 0) {
        const depsCompleted = stage.dependsOn.every((depId) => {
          const depResult = execution.stagesResults.find(
            (r) => r.stageId === depId,
          );
          return depResult?.status === 'completed';
        });
        if (!depsCompleted) {
          stageResult.status = 'failed';
          stageResult.error = 'Dependency not met';
          execution.status = 'failed';
          break;
        }
      }

      stageResult.status = 'running';
      stageResult.startedAt = new Date().toISOString();

      try {
        // Simulate stage execution
        await this.executeStage(stage);
        stageResult.status = 'completed';
        stageResult.recordsProcessed = Math.floor(Math.random() * 1000) + 1;
      } catch (err) {
        stageResult.status = 'failed';
        stageResult.error = err instanceof Error ? err.message : String(err);
        execution.status = 'failed';
        break;
      }

      stageResult.completedAt = new Date().toISOString();
    }

    if (execution.status !== 'failed') {
      execution.status = 'completed';
      pipeline.status = pipeline.schedule ? 'scheduled' : 'completed';
    } else {
      pipeline.status = 'failed';
    }

    execution.completedAt = new Date().toISOString();
    pipeline.updatedAt = new Date().toISOString();

    return execution;
  }

  private async executeStage(stage: {
    type: string;
    config: Record<string, unknown>;
  }): Promise<void> {
    // Simulate async work
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * 100) + 10),
    );
  }

  getExecutions(pipelineId: string): PipelineExecution[] {
    return Array.from(this.executions.values()).filter(
      (e) => e.pipelineId === pipelineId,
    );
  }

  // ---- Scheduling ----

  schedulePipeline(pipelineId: string, cron: string): DataPipeline | undefined {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return undefined;

    pipeline.schedule = cron;
    pipeline.status = 'scheduled';
    pipeline.updatedAt = new Date().toISOString();

    this.schedulePipelineInternal(pipelineId, cron);

    return pipeline;
  }

  private schedulePipelineInternal(pipelineId: string, cron: string): void {
    // Only clear existing timer, don't change status (caller handles status)
    const existingTimer = this.timers.get(pipelineId);
    if (existingTimer) {
      clearInterval(existingTimer);
      this.timers.delete(pipelineId);
    }

    // Simplified cron: execute every minute for demo purposes
    // In production, use a proper cron parser like `cron-parser`
    const intervalMs = this.parseCronToMs(cron);
    const timer = setInterval(async () => {
      const p = this.pipelines.get(pipelineId);
      if (p && p.status === 'scheduled') {
        await this.executePipeline(pipelineId);
      }
    }, intervalMs);

    this.timers.set(pipelineId, timer);
  }

  private parseCronToMs(cron: string): number {
    // Minimal cron parser: returns interval in milliseconds
    // Supports: * * * * * (every minute), */5 * * * * (every 5 min), etc.
    const parts = cron.trim().split(/\s+/);
    if (parts.length >= 2 && parts[1] === '*') {
      if (parts[0].startsWith('*/')) {
        const n = parseInt(parts[0].slice(2), 10);
        return n * 60 * 1000;
      }
      return 60 * 1000; // every minute
    }
    // Default: every 5 minutes
    return 5 * 60 * 1000;
  }

  unschedulePipeline(pipelineId: string): void {
    const timer = this.timers.get(pipelineId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(pipelineId);
    }
    const pipeline = this.pipelines.get(pipelineId);
    if (pipeline && pipeline.status === 'scheduled') {
      pipeline.status = 'draft';
      pipeline.schedule = undefined;
      pipeline.updatedAt = new Date().toISOString();
    }
  }

  // ---- Status & Lineage ----

  getPipelineStatus(pipelineId: string): {
    pipeline: DataPipeline;
    recentExecutions: PipelineExecution[];
  } | undefined {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return undefined;

    const recentExecutions = this.getExecutions(pipelineId)
      .sort(
        (a, b) =>
          new Date(b.startedAt || 0).getTime() -
          new Date(a.startedAt || 0).getTime(),
      )
      .slice(0, 10);

    return { pipeline, recentExecutions };
  }

  getDataLineage(pipelineId: string): DataLineage | undefined {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return undefined;

    const nodes: DataLineage['nodes'] = [];
    const edges: DataLineage['edges'] = [];

    for (const stage of pipeline.stages) {
      nodes.push({
        id: `node_${stage.id}`,
        name: stage.name,
        type:
          stage.type === 'extract'
            ? 'source'
            : stage.type === 'load'
              ? 'sink'
              : 'transform',
        stageId: stage.id,
      });

      if (stage.dependsOn) {
        for (const depId of stage.dependsOn) {
          edges.push({
            from: `node_${depId}`,
            to: `node_${stage.id}`,
            label: `${stage.type}`,
          });
        }
      }
    }

    // If no explicit dependencies, create linear chain
    if (edges.length === 0 && nodes.length > 1) {
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          from: nodes[i].id,
          to: nodes[i + 1].id,
          label: pipeline.stages[i + 1].type,
        });
      }
    }

    return { pipelineId, nodes, edges };
  }

  // ---- Cleanup ----

  destroy(): void {
    for (const timer of Array.from(this.timers.values())) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.pipelines.clear();
    this.executions.clear();
  }
}
