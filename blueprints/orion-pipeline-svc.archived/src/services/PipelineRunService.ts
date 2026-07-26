/**
 * PipelineRun Service - PipelineRun 管理
 *
 * Migrated from Map() in-memory storage to PostgreSQL Repository pattern.
 * Maintains backward-compatible API for controllers and engine.
 */

import {
  PipelineRun,
  PipelineRunStatus,
  TriggerType,
  PipelineRunCreateInput,
  PipelineRunFilter,
  createPipelineRun,
  startPipelineRun,
  completePipelineRun,
  cancelPipelineRun,
} from '../models/PipelineRun';
import { Stage, StageStatus } from '../models/Stage';
import { Task, TaskStatus } from '../models/Task';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import {
  PipelineRunRepository,
  PipelineRunRecord,
  StageExecutionRecord,
  TaskExecutionRecord,
  CreateRunInput,
} from './PipelineRunRepository';
import { EnvironmentService, ResolvedVariables } from './EnvironmentService';
import { v4 as uuidv4 } from 'uuid';

export class PipelineRunService {
  private eventPublisher: PipelineEventPublisher;
  private repository: PipelineRunRepository | null = null;
  private environmentService: EnvironmentService | null = null;

  constructor(eventPublisher?: PipelineEventPublisher, repository?: PipelineRunRepository, environmentService?: EnvironmentService) {
    this.eventPublisher = eventPublisher || new PipelineEventPublisher();
    this.repository = repository || null;
    this.environmentService = environmentService || null;
  }

  /**
   * Set event publisher (for dependency injection)
   */
  setEventPublisher(eventPublisher: PipelineEventPublisher): void {
    this.eventPublisher = eventPublisher;
  }

  // ==================== Mapping helpers ====================

  /**
   * Map database PipelineRunRecord to domain PipelineRun model
   */
  private mapRun(record: PipelineRunRecord): PipelineRun {
    return {
      id: record.id,
      pipelineId: record.pipeline_id,
      pipelineVersion: (record.config_snapshot as any)?.version || '1',
      triggerType: record.trigger_type as TriggerType,
      triggerBy: record.trigger_by || undefined,
      environment: record.environment_name || undefined,
      status: record.status as PipelineRunStatus,
      startedAt: record.started_at?.toISOString() || undefined,
      completedAt: record.completed_at?.toISOString() || undefined,
      durationMs: record.duration_ms || undefined,
      context: record.config_snapshot || {},
      createdAt: record.created_at.toISOString(),
      updatedAt: (record.completed_at || record.started_at || record.created_at).toISOString(),
    };
  }

  /**
   * Map domain PipelineRunCreateInput to database CreateRunInput
   */
  private mapCreateInput(input: PipelineRunCreateInput): CreateRunInput {
    // P4 Security: Extract tenantId from context instead of hardcoding
    const contextTenantId = (input.context as any)?.tenantId;
    return {
      tenant_id: contextTenantId || '00000000-0000-0000-0000-000000000000',
      pipeline_id: input.pipelineId,
      trigger_type: input.triggerType,
      trigger_by: input.triggerBy,
      environment_name: input.environment || null,
      config_snapshot: { version: input.pipelineVersion, ...(input.context || {}) },
    };
  }

  /**
   * Map database StageExecutionRecord to domain Stage model
   */
  private mapStageExecution(record: StageExecutionRecord, runId: string, sequence: number): Stage {
    return {
      id: record.id,
      runId,
      name: record.stage_name,
      sequence,
      status: record.status as StageStatus,
      dependsOn: [],
      timeoutSeconds: 3600,
      retryCount: 0,
      maxRetries: 0,
      startedAt: record.started_at?.toISOString() || undefined,
      completedAt: record.completed_at?.toISOString() || undefined,
      durationMs: record.duration_ms || undefined,
      error: record.error_message || undefined,
      createdAt: record.created_at.toISOString(),
    };
  }

  /**
   * Map database TaskExecutionRecord to domain Task model
   */
  private mapTaskExecution(record: TaskExecutionRecord, stageId: string, sequence: number): Task {
    return {
      id: record.id,
      stageId,
      name: record.task_name,
      type: record.task_type,
      sequence,
      status: record.status as TaskStatus,
      config: record.input || {},
      parameters: {},
      retryCount: 0,
      maxRetries: 0,
      timeoutSeconds: 600,
      startedAt: record.started_at?.toISOString() || undefined,
      completedAt: record.completed_at?.toISOString() || undefined,
      durationMs: record.duration_ms || undefined,
      result: record.output || undefined,
      error: record.error_message || undefined,
      log: record.logs || undefined,
      createdAt: record.created_at.toISOString(),
    };
  }

  // ==================== PipelineRun CRUD ====================

  /**
   * Create PipelineRun
   */
  async createRun(input: PipelineRunCreateInput): Promise<PipelineRun> {
    // If repository is available, use database
    if (this.repository) {
      const dbInput = this.mapCreateInput(input);
      const record = await this.repository.create(dbInput);
      const run = this.mapRun(record);

      await this.eventPublisher.publishRunCreated(run);
      return run;
    }

    // Fallback: in-memory (legacy)
    const run = createPipelineRun(input);
    await this.eventPublisher.publishRunCreated(run);
    return run;
  }

  /**
   * Get PipelineRun by ID
   */
  async getRun(id: string): Promise<PipelineRun | null> {
    if (this.repository) {
      const record = await this.repository.findById(id);
      return record ? this.mapRun(record) : null;
    }

    return null;
  }

  /**
   * Find all runs with a specific status (for crash recovery)
   */
  async findRunsByStatus(status: string): Promise<PipelineRun[]> {
    if (this.repository) {
      const records = await this.repository.findByStatus(status);
      return records.map(r => this.mapRun(r));
    }
    return [];
  }

  /**
   * Get PipelineRun list with filtering
   */
  async listRuns(filter?: PipelineRunFilter): Promise<PipelineRun[]> {
    if (this.repository) {
      const records = await this.repository.findAll({
        pipelineId: filter?.pipelineId,
        status: filter?.status
          ? (Array.isArray(filter.status) ? filter.status : [filter.status])
          : undefined,
        triggerType: filter?.triggerType,
        limit: filter?.limit,
        offset: filter?.offset,
      });
      return records.map(r => this.mapRun(r));
    }

    return [];
  }

  /**
   * Start PipelineRun
   */
  async startRun(runId: string): Promise<PipelineRun | null> {
    if (this.repository) {
      const run = await this.repository.findById(runId);
      if (!run) return null;

      const updatedRun = await this.repository.updateStatus(runId, 'running', new Date());
      if (!updatedRun) return null;

      const domainRun = this.mapRun(updatedRun);
      await this.eventPublisher.publishRunStarted(domainRun);
      return domainRun;
    }

    return null;
  }

  /**
   * Complete PipelineRun
   */
  async completeRun(runId: string, status: PipelineRunStatus.SUCCESS | PipelineRunStatus.FAILED): Promise<PipelineRun | null> {
    if (this.repository) {
      const run = await this.repository.findById(runId);
      if (!run) return null;

      const completedAt = new Date();
      const startedAt = run.started_at || run.created_at;
      const updatedRun = await this.repository.updateStatus(
        runId, status, startedAt, completedAt
      );
      if (!updatedRun) return null;

      const domainRun = this.mapRun(updatedRun);
      if (status === PipelineRunStatus.SUCCESS) {
        await this.eventPublisher.publishRunCompleted(domainRun);
      } else {
        await this.eventPublisher.publishRunFailed(domainRun);
      }
      return domainRun;
    }

    return null;
  }

  /**
   * Cancel PipelineRun
   */
  async cancelRun(runId: string): Promise<PipelineRun | null> {
    if (this.repository) {
      const run = await this.repository.findById(runId);
      if (!run || (run.status !== 'running' && run.status !== 'pending')) {
        return null;
      }

      const completedAt = new Date();
      const startedAt = run.started_at || run.created_at;
      const updatedRun = await this.repository.updateStatus(
        runId, 'cancelled', startedAt, completedAt, 'Cancelled by user'
      );
      if (!updatedRun) return null;

      const domainRun = this.mapRun(updatedRun);
      await this.eventPublisher.publishRunCancelled(domainRun);
      return domainRun;
    }

    return null;
  }

  // ==================== Stage Management ====================

  /**
   * Add Stage to PipelineRun
   */
  async addStage(runId: string, stage: Stage): Promise<void> {
    if (this.repository) {
      await this.repository.createStageExecution(runId, stage.id || null, stage.name);
      return;
    }
  }

  /**
   * Get stages for a run
   */
  async getStages(runId: string): Promise<Stage[]> {
    if (this.repository) {
      const records = await this.repository.findStageExecutionsByRun(runId);
      return records.map((r, i) => this.mapStageExecution(r, runId, i + 1));
    }

    return [];
  }

  /**
   * Get stage by ID
   */
  async getStage(stageId: string): Promise<Stage | null> {
    if (this.repository) {
      const record = await this.repository.findStageExecutionById(stageId);
      if (!record) return null;
      return this.mapStageExecution(record, record.run_id, 1);
    }

    return null;
  }

  /**
   * Update stage
   */
  async updateStage(stage: Stage): Promise<void> {
    if (this.repository) {
      await this.repository.updateStageExecutionStatus(
        stage.id,
        stage.status,
        stage.startedAt ? new Date(stage.startedAt) : undefined,
        stage.completedAt ? new Date(stage.completedAt) : undefined,
        stage.error
      );
    }
  }

  // ==================== Task Management ====================

  /**
   * Add Task to Stage
   */
  async addTask(stageId: string, task: Task): Promise<void> {
    if (this.repository) {
      await this.repository.createTaskExecution(stageId, task.name, task.type);
    }
  }

  /**
   * Get tasks for a stage
   */
  async getTasks(stageId: string): Promise<Task[]> {
    if (this.repository) {
      const records = await this.repository.findTaskExecutionsByExecution(stageId);
      return records.map((r, i) => this.mapTaskExecution(r, stageId, i + 1));
    }

    return [];
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    if (this.repository) {
      const record = await this.repository.findTaskExecutionById(taskId);
      if (!record) return null;
      return this.mapTaskExecution(record, record.execution_id, 1);
    }

    return null;
  }

  /**
   * Update task
   */
  async updateTask(task: Task): Promise<void> {
    if (this.repository) {
      await this.repository.updateTaskExecution(task.id, {
        status: task.status,
        output: task.result,
        startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        errorMessage: task.error,
        logs: task.log,
      });
    }
  }

  // ==================== Run Detail ====================

  /**
   * Get PipelineRun detail with stages and tasks
   */
  async getRunDetail(runId: string): Promise<{
    run: PipelineRun | null;
    stages: Stage[];
    tasks: Task[];
  } | null> {
    if (!this.repository) {
      return null;
    }

    const runRecord = await this.repository.findById(runId);
    if (!runRecord) {
      return null;
    }

    const run = this.mapRun(runRecord);
    const stageRecords = await this.repository.findStageExecutionsByRun(runId);
    const stages = stageRecords.map((r, i) => this.mapStageExecution(r, runId, i + 1));

    const tasks: Task[] = [];
    for (const stage of stageRecords) {
      const taskRecords = await this.repository.findTaskExecutionsByExecution(stage.id);
      tasks.push(...taskRecords.map((r, i) => this.mapTaskExecution(r, stage.id, i + 1)));
    }

    return { run, stages, tasks };
  }

  // ==================== Run Completion Check ====================

  /**
   * Check if all stages of a run are complete
   */
  async checkRunCompletion(runId: string): Promise<{
    isComplete: boolean;
    allSuccess: boolean;
  } | null> {
    if (!this.repository) {
      return null;
    }

    const run = await this.repository.findById(runId);
    if (!run) {
      return null;
    }

    const stages = await this.repository.findStageExecutionsByRun(runId);
    if (stages.length === 0) {
      return { isComplete: true, allSuccess: true };
    }

    const hasFailed = stages.some(s => s.status === StageStatus.FAILED);
    const allComplete = stages.every(s =>
      s.status === StageStatus.SUCCESS ||
      s.status === StageStatus.FAILED ||
      s.status === StageStatus.SKIPPED
    );

    return {
      isComplete: allComplete,
      allSuccess: !hasFailed,
    };
  }

  // ==================== Environment Variable Resolution ====================

  /**
   * Resolve environment variables for a pipeline run.
   * If the run has an environment specified and EnvironmentService is available,
   * merges pipeline-level variables with environment-level variables.
   * Environment variables take precedence over pipeline-level variables.
   *
   * @param tenantId - The tenant ID for environment lookup
   * @param runId - The pipeline run ID (must have environment field set)
   * @param pipelineVariables - Pipeline-level variables (lower priority)
   * @returns Resolved variables, or pipelineVariables if environment not available
   */
  async resolveEnvironmentVariables(
    tenantId: string,
    runId: string,
    pipelineVariables: Record<string, string> = {},
  ): Promise<ResolvedVariables> {
    if (!this.environmentService) {
      // EnvironmentService not available, return pipeline variables as-is
      return {
        variables: pipelineVariables,
        environment: {
          name: '',
          approvalRequired: false,
          approvalCount: 1,
        },
      };
    }

    const run = await this.repository?.findById(runId);
    if (!run || !run.environment_name) {
      // No environment set on run, return pipeline variables as-is
      return {
        variables: pipelineVariables,
        environment: {
          name: '',
          approvalRequired: false,
          approvalCount: 1,
        },
      };
    }

    return this.environmentService.resolveVariables(
      tenantId,
      run.environment_name,
      pipelineVariables,
    );
  }

  /**
   * Check if approval is required for a pipeline run's target environment.
   *
   * @param tenantId - The tenant ID
   * @param runId - The pipeline run ID
   * @returns Approval requirement info
   */
  async checkRunApprovalRequired(
    tenantId: string,
    runId: string,
  ): Promise<{ required: boolean; approvalCount: number; environmentFound: boolean }> {
    if (!this.environmentService) {
      return { required: false, approvalCount: 0, environmentFound: false };
    }

    const run = await this.repository?.findById(runId);
    if (!run || !run.environment_name) {
      return { required: false, approvalCount: 0, environmentFound: false };
    }

    return this.environmentService.checkApprovalRequired(tenantId, run.environment_name);
  }
}
