/**
 * PipelineRun Service - PipelineRun 管理
 *
 * PostgreSQL Repository pattern — repository is the single source of truth.
 * All in-memory fallback paths have been removed.
 */

import { OrionError, ErrorCode } from '../../errors';
import { Stage, StageStatus } from '../../models/Stage';
import { Task, TaskStatus } from '../../models/Task';
import { PipelineEventPublisher } from '../../events/PipelineEventPublisher';
import {
  PipelineRunRepository,
  PipelineRunRecord,
  StageExecutionRecord,
  TaskExecutionRecord,
  CreateRunInput,
} from './PipelineRunRepository';
import { EnvironmentService, ResolvedVariables } from './EnvironmentService';
import { PipelineRun, PipelineRunStatus, PipelineRunCreateInput, PipelineRunFilter, TriggerType } from '../../models/PipelineRun';

export interface RunHistoryTrend {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  runningRuns: number;
  successRate: number;
  avgDurationMs: number;
  failureReasons: Array<{ reason: string; count: number }>;
}

export class PipelineRunService {
  private eventPublisher: PipelineEventPublisher;
  private repository: PipelineRunRepository;
  private environmentService: EnvironmentService | null = null;

  constructor(eventPublisher: PipelineEventPublisher, repository: PipelineRunRepository, environmentService?: EnvironmentService) {
    if (!repository) throw new OrionError('PipelineRunRepository is required', ErrorCode.INTERNAL_ERROR);
    this.eventPublisher = eventPublisher || new PipelineEventPublisher();
    this.repository = repository;
    this.environmentService = environmentService || null;
  }

  /**
   * Set event publisher (for dependency injection)
   */
  setEventPublisher(eventPublisher: PipelineEventPublisher): void {
    this.eventPublisher = eventPublisher;
  }

  // ==================== Mapping helpers ====================

  private mapRun(record: PipelineRunRecord): PipelineRun {
    return {
      id: record.id,
      pipelineId: record.pipeline_id,
      pipelineVersion: (record.config_snapshot as any)?.version || '1',
      triggerType: record.trigger_type as TriggerType,
      triggerBy: record.trigger_by || undefined,
      environment: record.environment_name || undefined,
      status: record.status as PipelineRunStatus,
      startedAt: record.started_at || undefined,
      completedAt: record.completed_at || undefined,
      durationMs: record.duration_ms != null ? Number(record.duration_ms) : undefined,
      context: record.config_snapshot || {},
      createdAt: record.created_at,
      updatedAt: record.completed_at || record.started_at || record.created_at,
    };
  }

  private mapCreateInput(input: PipelineRunCreateInput): CreateRunInput {
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
      startedAt: record.started_at || undefined,
      completedAt: record.completed_at || undefined,
      durationMs: record.duration_ms != null ? Number(record.duration_ms) : undefined,
      error: record.error_message || undefined,
      createdAt: record.created_at,
    };
  }

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
      startedAt: record.started_at || undefined,
      completedAt: record.completed_at || undefined,
      durationMs: record.duration_ms != null ? Number(record.duration_ms) : undefined,
      result: record.output || undefined,
      error: record.error_message || undefined,
      log: record.logs || undefined,
      createdAt: record.created_at,
    };
  }

  // ==================== PipelineRun CRUD ====================

  async createRun(input: PipelineRunCreateInput): Promise<PipelineRun> {
    const dbInput = this.mapCreateInput(input);
    const record = await this.repository.create(dbInput);
    const run = this.mapRun(record);
    await this.eventPublisher.publishRunCreated(run);
    return run;
  }

  async getRun(id: string): Promise<PipelineRun | null> {
    const record = await this.repository.findById(id);
    return record ? this.mapRun(record) : null;
  }

  async findRunsByStatus(status: string): Promise<PipelineRun[]> {
    const records = await this.repository.findByStatus(status);
    return records.map(r => this.mapRun(r));
  }

  async listRuns(filter?: PipelineRunFilter): Promise<PipelineRun[]> {
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

  async startRun(runId: string): Promise<PipelineRun | null> {
    const run = await this.repository.findById(runId);
    if (!run) return null;

    const updatedRun = await this.repository.updateStatus(runId, 'running', new Date());
    if (!updatedRun) return null;

    const domainRun = this.mapRun(updatedRun);
    await this.eventPublisher.publishRunStarted(domainRun);
    return domainRun;
  }

  async completeRun(runId: string, status: PipelineRunStatus.SUCCESS | PipelineRunStatus.FAILED): Promise<PipelineRun | null> {
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

  async cancelRun(runId: string): Promise<PipelineRun | null> {
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

  async deleteRun(runId: string): Promise<boolean> {
    return this.repository.delete(runId);
  }

  // ==================== Stage Management ====================

  async addStage(runId: string, stage: Stage): Promise<Stage> {
    const record = await this.repository.createStageExecution(runId, stage.id || null, stage.name);
    return this.mapStageExecution(record, runId, stage.sequence);
  }

  async getStages(runId: string): Promise<Stage[]> {
    const records = await this.repository.findStageExecutionsByRun(runId, '');
    return records.map((r, i) => this.mapStageExecution(r, runId, i + 1));
  }

  async getStage(stageId: string): Promise<Stage | null> {
    const record = await this.repository.findStageExecutionById(stageId);
    if (!record) return null;
    return this.mapStageExecution(record, record.run_id, 1);
  }

  async updateStage(stage: Stage): Promise<void> {
    await this.repository.updateStageExecutionStatus(
      stage.id,
      stage.status,
      stage.startedAt,
      stage.completedAt,
      stage.error
    );
  }

  // ==================== Task Management ====================

  async addTask(stageId: string, task: Task): Promise<Task> {
    const record = await this.repository.createTaskExecution(stageId, task.name, task.type, task.config);
    return this.mapTaskExecution(record, stageId, task.sequence);
  }

  async getTasks(stageId: string): Promise<Task[]> {
    const records = await this.repository.findTaskExecutionsByExecution(stageId, '');
    return records.map((r, i) => this.mapTaskExecution(r, stageId, i + 1));
  }

  async getTask(taskId: string): Promise<Task | null> {
    const record = await this.repository.findTaskExecutionById(taskId);
    if (!record) return null;
    return this.mapTaskExecution(record, record.execution_id, 1);
  }

  async updateTask(task: Task): Promise<void> {
    await this.repository.updateTaskExecution(task.id, {
      status: task.status,
      output: task.result,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      errorMessage: task.error,
      logs: task.log,
    });
  }

  // ==================== Run Detail ====================

  async getRunDetail(runId: string): Promise<{
    run: PipelineRun | null;
    stages: Stage[];
    tasks: Task[];
  } | null> {
    const runRecord = await this.repository.findById(runId);
    if (!runRecord) {
      return null;
    }

    const run = this.mapRun(runRecord);
    const stageRecords = await this.repository.findStageExecutionsByRun(runId, '');
    const stages = stageRecords.map((r, i) => this.mapStageExecution(r, runId, i + 1));

    const tasks: Task[] = [];
    for (const stage of stageRecords) {
      const taskRecords = await this.repository.findTaskExecutionsByExecution(stage.id, '');
      tasks.push(...taskRecords.map((r, i) => this.mapTaskExecution(r, stage.id, i + 1)));
    }

    return { run, stages, tasks };
  }

  // ==================== Run Completion Check ====================

  async checkRunCompletion(runId: string): Promise<{
    isComplete: boolean;
    allSuccess: boolean;
  } | null> {
    const run = await this.repository.findById(runId);
    if (!run) {
      return null;
    }

    const stages = await this.repository.findStageExecutionsByRun(runId, '');
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

  async resolveEnvironmentVariables(
    tenantId: string,
    runId: string,
    pipelineVariables: Record<string, string> = {},
  ): Promise<ResolvedVariables> {
    if (!this.environmentService) {
      return {
        variables: pipelineVariables,
        environment: {
          name: '',
          approvalRequired: false,
          approvalCount: 1,
        },
      };
    }

    const run = await this.repository.findById(runId);
    if (!run || !run.environment_name) {
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

  async checkRunApprovalRequired(
    tenantId: string,
    runId: string,
  ): Promise<{ required: boolean; approvalCount: number; environmentFound: boolean }> {
    if (!this.environmentService) {
      return { required: false, approvalCount: 0, environmentFound: false };
    }

    const run = await this.repository.findById(runId);
    if (!run || !run.environment_name) {
      return { required: false, approvalCount: 0, environmentFound: false };
    }

    return this.environmentService.checkApprovalRequired(tenantId, run.environment_name);
  }

  // ==================== Run History Trend ====================

  /**
   * Get run history aggregated by time period.
   * @param pipelineId - Pipeline ID to get history for
   * @param period - Time period: 'day', 'week', or 'month'
   * @returns Array of run history trend data
   */
  async getRunHistory(pipelineId: string, period: 'day' | 'week' | 'month' = 'day'): Promise<RunHistoryTrend[]> {
    // Determine date truncation based on period
    let dateTrunc: string;
    let interval: string;
    let periods: number;

    switch (period) {
      case 'week':
        dateTrunc = 'week';
        interval = '1 week';
        periods = 12; // Last 12 weeks
        break;
      case 'month':
        dateTrunc = 'month';
        interval = '1 month';
        periods = 12; // Last 12 months
        break;
      case 'day':
      default:
        dateTrunc = 'day';
        interval = '1 day';
        periods = 30; // Last 30 days
        break;
    }

    // Get aggregated stats by period
    const statsQuery = `
      SELECT
        DATE_TRUNC($1, created_at) as period_start,
        COUNT(*) as total_runs,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_runs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_runs,
        COUNT(CASE WHEN status = 'running' OR status = 'pending' THEN 1 END) as running_runs,
        COALESCE(AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms END), 0) as avg_duration_ms
      FROM pipeline_runs
      WHERE pipeline_id = $2
        AND created_at >= DATE_TRUNC($1, NOW()) - ($3 || ' ' || $4)::interval
      GROUP BY period_start
      ORDER BY period_start ASC
    `;

    const statsResult = await (this.repository as any).pool.query(statsQuery, [
      dateTrunc,
      pipelineId,
      periods.toString(),
      interval,
    ]);

    // Get failure reasons distribution
    const failureQuery = `
      SELECT
        DATE_TRUNC($1, created_at) as period_start,
        COALESCE(error_message, 'unknown') as failure_reason,
        COUNT(*) as failure_count
      FROM pipeline_runs
      WHERE pipeline_id = $2
        AND status = 'failed'
        AND created_at >= DATE_TRUNC($1, NOW()) - ($3 || ' ' || $4)::interval
      GROUP BY period_start, failure_reason
      ORDER BY period_start ASC, failure_count DESC
    `;

    const failureResult = await (this.repository as any).pool.query(failureQuery, [
      dateTrunc,
      pipelineId,
      periods.toString(),
      interval,
    ]);

    // Build period map
    const periodMap = new Map<string, RunHistoryTrend>();

    for (const row of statsResult.rows) {
      const periodStart = new Date(row.period_start);
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 1);

      if (period === 'week') {
        periodEnd.setDate(periodEnd.getDate() + 6);
      } else if (period === 'month') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const totalRuns = parseInt(row.total_runs, 10) || 0;
      const successRuns = parseInt(row.success_runs, 10) || 0;
      const failedRuns = parseInt(row.failed_runs, 10) || 0;
      const runningRuns = parseInt(row.running_runs, 10) || 0;
      const avgDuration = parseFloat(row.avg_duration_ms) || 0;

      periodMap.set(row.period_start, {
        period,
        periodStart,
        periodEnd,
        totalRuns,
        successRuns,
        failedRuns,
        runningRuns,
        successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
        avgDurationMs: Math.round(avgDuration),
        failureReasons: [],
      });
    }

    // Merge failure reasons into period map
    for (const row of failureResult.rows) {
      const periodStart = row.period_start;
      const entry = periodMap.get(periodStart);
      if (entry) {
        entry.failureReasons.push({
          reason: row.failure_reason,
          count: parseInt(row.failure_count, 10) || 0,
        });
      }
    }

    // Convert to array and sort by period
    const result = Array.from(periodMap.values()).sort((a, b) =>
      a.periodStart.getTime() - b.periodStart.getTime()
    );

    // Fill in missing periods with zero values
    const filledResult: RunHistoryTrend[] = [];
    const now = new Date();

    for (let i = periods - 1; i >= 0; i--) {
      const currentPeriod = new Date(now);
      if (period === 'day') {
        currentPeriod.setDate(currentPeriod.getDate() - i);
        currentPeriod.setHours(0, 0, 0, 0);
      } else if (period === 'week') {
        currentPeriod.setDate(currentPeriod.getDate() - (i * 7));
        currentPeriod.setHours(0, 0, 0, 0);
      } else {
        currentPeriod.setMonth(currentPeriod.getMonth() - i);
        currentPeriod.setDate(1);
        currentPeriod.setHours(0, 0, 0, 0);
      }

      const existingEntry = result.find(r => r.periodStart.getTime() === currentPeriod.getTime());
      if (existingEntry) {
        filledResult.push(existingEntry);
      } else {
        const periodEnd = new Date(currentPeriod);
        if (period === 'day') {
          periodEnd.setDate(periodEnd.getDate() + 1);
        } else if (period === 'week') {
          periodEnd.setDate(periodEnd.getDate() + 7);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        filledResult.push({
          period,
          periodStart: currentPeriod,
          periodEnd,
          totalRuns: 0,
          successRuns: 0,
          failedRuns: 0,
          runningRuns: 0,
          successRate: 0,
          avgDurationMs: 0,
          failureReasons: [],
        });
      }
    }

    return filledResult;
  }
}
