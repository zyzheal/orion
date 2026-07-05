/**
 * DataPipelineAsyncEngine — DataPipeline 异步执行引擎
 *
 * 职责：
 * - 任务调度与并发控制
 * - 任务状态机管理（pending → running → completed/failed/cancelled）
 * - 指数退避重试
 * - 超时控制
 * - tenant_id 隔离
 *
 * 不依赖 PipelineEngine，是 DataPipeline 模块的独立执行层。
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';
import { OrionError, ErrorCode } from '../../errors';
import { DataPipelineRepository, PipelineExecutionRepository, StageResultEntity } from '../../repositories/DataPipelineRepository';
import { DataPipeline, PipelineExecution, StageResult, PipelineStage } from './types';

const logger = createLogger('data-pipeline-async-engine');

// ==================== Type Definitions ====================

export type TaskState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';

export interface DataPipelineTask {
  id: string;
  executionId: string;
  pipelineId: string;
  tenantId: string;
  stageId: string;
  stageName: string;
  state: TaskState;
  priority: number;
  dependsOn: string[];
  config: Record<string, unknown>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  timeoutMs: number;
  retryCount: number;
  maxRetries: number;
  retryDelayMs: number;
  error?: string;
  result?: { recordsProcessed: number; data?: unknown };
}

export interface AsyncEngineConfig {
  maxConcurrency: number;
  defaultTimeoutMs: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  retryJitter: boolean;
  taskHeartbeatMs: number;
}

export interface ExecutionTaskResult {
  stageId: string;
  success: boolean;
  recordsProcessed: number;
  error?: string;
  durationMs: number;
  retriesUsed: number;
}

export interface EngineStats {
  totalTasks: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  retrying: number;
  averageDurationMs: number;
}

// ==================== Defaults ====================

const DEFAULT_CONFIG: AsyncEngineConfig = {
  maxConcurrency: parseInt(process.env.DATA_PIPELINE_MAX_CONCURRENCY || '4', 10),
  defaultTimeoutMs: parseInt(process.env.DATA_PIPELINE_DEFAULT_TIMEOUT_MS || '300000', 10), // 5 min
  maxRetries: 3,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  retryJitter: true,
  taskHeartbeatMs: 5000,
};

// ==================== DataPipelineAsyncEngine ====================

export class DataPipelineAsyncEngine extends EventEmitter {
  private config: AsyncEngineConfig;
  private pipelineRepo?: DataPipelineRepository;
  private execRepo?: PipelineExecutionRepository;

  // In-memory task store (fallback when DB is not available)
  private tasks = new Map<string, DataPipelineTask>();
  private executions = new Map<string, PipelineExecution>();
  private stageResults = new Map<string, StageResult[]>();

  // Concurrency control: per-execution running count (queue isolation fix)
  private runningCount = new Map<string, number>();
  private queue: DataPipelineTask[] = [];

  // Timeout watchers
  private timeouts = new Map<string, NodeJS.Timeout>();

  // Heartbeat watchers
  private heartbeats = new Map<string, NodeJS.Timeout>();

  constructor(
    config?: Partial<AsyncEngineConfig>,
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (db) {
      this.pipelineRepo = new DataPipelineRepository(db);
      this.execRepo = new PipelineExecutionRepository(db);
    }

    logger.info({ config: this.config }, 'DataPipelineAsyncEngine initialized');
  }

  // ==================== Public API ====================

  /**
   * 异步执行 pipeline（入口方法）
   */
  async executePipeline(
    pipeline: DataPipeline,
    executionId?: string
  ): Promise<PipelineExecution> {
    const tenantId = pipeline.tenantId;
    const execId = executionId || this.generateId('exec');

    // 1. 创建执行记录
    const execution = await this.createExecutionRecord(execId, pipeline);

    // 2. 将 stages 转换为 tasks
    const tasks = this.buildTasks(pipeline, execId);

    // 3. 持久化初始状态（DB 模式）
    if (this.pipelineRepo && this.execRepo) {
      await this.persistExecution(execution, tasks);
    } else {
      this.executions.set(execId, execution);
      this.stageResults.set(execId, []);
      for (const task of tasks) {
        this.tasks.set(task.id, task);
      }
    }

    // 4. 启动调度
    this.scheduleTasks(tasks, execId, pipeline.tenantId);

    return execution;
  }

  /**
   * 取消执行
   * 同时从队列中移除 cancelled 任务，避免 processQueue 继续处理已取消的任务
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const tasks = this.getTasksByExecution(executionId);
    let cancelled = false;

    for (const task of tasks) {
      if (task.state === 'pending' || task.state === 'retrying' || task.state === 'running') {
        this.updateTaskState(task.id, 'cancelled');
        this.clearTaskTimers(task.id);
        this.stopTaskHeartbeat(task.id);
        cancelled = true;
      }
    }

    // 从队列中移除该 execution 的所有 cancelled/retrying 任务
    this.queue = this.queue.filter(
      (t) => !(t.executionId === executionId && (t.state === 'cancelled' || t.state === 'retrying'))
    );

    // 更新执行记录
    const execution = this.executions.get(executionId);
    if (execution && cancelled) {
      execution.status = 'cancelled';
      execution.completedAt = new Date().toISOString();
      await this.persistExecutionStatus(execution);
    }

    return cancelled;
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(executionId: string): {
    execution: PipelineExecution | undefined;
    tasks: DataPipelineTask[];
    progress: number;
  } | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    const tasks = this.getTasksByExecution(executionId);
    const completed = tasks.filter((t) => t.state === 'completed').length;
    const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    return { execution, tasks, progress };
  }

  /**
   * 获取引擎统计
   */
  getStats(): EngineStats {
    const allTasks = Array.from(this.tasks.values());
    return {
      totalTasks: allTasks.length,
      pending: allTasks.filter((t) => t.state === 'pending').length,
      running: allTasks.filter((t) => t.state === 'running').length,
      completed: allTasks.filter((t) => t.state === 'completed').length,
      failed: allTasks.filter((t) => t.state === 'failed').length,
      cancelled: allTasks.filter((t) => t.state === 'cancelled').length,
      retrying: allTasks.filter((t) => t.state === 'retrying').length,
      averageDurationMs: this.calculateAverageDuration(allTasks),
    };
  }

  /**
   * 销毁引擎，清理所有资源
   */
  destroy(): void {
    for (const timer of Array.from(this.timeouts.values())) {
      clearTimeout(timer);
    }
    for (const timer of Array.from(this.heartbeats.values())) {
      clearInterval(timer);
    }
    this.timeouts.clear();
    this.heartbeats.clear();
    this.tasks.clear();
    this.executions.clear();
    this.stageResults.clear();
    this.queue = [];
    this.runningCount.clear();
  }

  // ==================== Task Scheduling ====================

  /**
   * 调度任务（支持并发控制）
   */
  private scheduleTasks(tasks: DataPipelineTask[], executionId: string, tenantId: string): void {
    // 按依赖拓扑排序（简单实现：先加入队列，调度时检查依赖）
    for (const task of tasks) {
      this.queue.push(task);
    }

    this.processQueue(executionId, tenantId);
  }

  /**
   * 处理队列（并发控制）- 按 executionId 隔离
   */
  private processQueue(executionId: string, tenantId: string): void {
    const execRunning = this.runningCount.get(executionId) || 0;
    if (execRunning >= this.config.maxConcurrency) {
      logger.debug(
        { executionId, running: execRunning, max: this.config.maxConcurrency },
        'Queue full for execution, waiting for slot'
      );
      return;
    }

    // 仅处理属于当前 execution 的任务（队列隔离）
    const tasksForExecution = this.queue.filter((t) => t.executionId === executionId);
    const otherTasks = this.queue.filter((t) => t.executionId !== executionId);

    // 找到可运行的任务（依赖已满足）
    const ready: DataPipelineTask[] = [];
    const remaining: DataPipelineTask[] = [];

    for (const task of tasksForExecution) {
      if (task.state !== 'pending') {
        remaining.push(task);
        continue;
      }

      const depsMet = task.dependsOn.every((depId) => {
        const depTask = this.tasks.get(this.getTaskId(executionId, depId));
        return depTask?.state === 'completed';
      });

      if (depsMet) {
        ready.push(task);
      } else {
        remaining.push(task);
      }
    }

    this.queue = [...otherTasks, ...remaining];

    // 启动就绪任务（受 execution 级并发限制）
    for (const task of ready) {
      const currentRunning = this.runningCount.get(executionId) || 0;
      if (currentRunning >= this.config.maxConcurrency) break;
      this.runTask(task, executionId, tenantId);
    }
  }

  /**
   * 运行单个任务
   */
  private async runTask(task: DataPipelineTask, executionId: string, tenantId: string): Promise<void> {
    this.updateTaskState(task.id, 'running');

    // Per-execution running count (queue isolation)
    const currentRunning = this.runningCount.get(executionId) || 0;
    this.runningCount.set(executionId, currentRunning + 1);

    const startedAt = Date.now();
    this.startTaskHeartbeat(task.id);

    try {
      // 超时控制：timeoutPromise 和 executionPromise 都 resolve，
      // executeStage 内部捕获错误并返回 { success: false, error }
      const timeoutPromise = this.createTimeout(task.id, task.timeoutMs);
      const executionPromise = this.executeStage(task);

      const result = await Promise.race([executionPromise, timeoutPromise]);

      this.clearTaskTimers(task.id);
      this.stopTaskHeartbeat(task.id);

      if (result.timedOut) {
        // 超时触发
        this.updateTaskState(task.id, 'failed', 'Task timed out');
        await this.handleTaskFailure(task, executionId, tenantId, 'timeout');
      } else if (!result.success) {
        // 执行失败（executeStage 返回错误而非抛异常）
        this.updateTaskState(task.id, 'failed', result.error);
        await this.handleTaskFailure(task, executionId, tenantId, result.error || 'unknown');
      } else {
        // 成功：检查是否已被取消
        const currentTask = this.tasks.get(task.id);
        if (currentTask?.state === 'cancelled') {
          this.updateTaskState(task.id, 'cancelled');
        } else {
          const durationMs = Date.now() - startedAt;
          this.updateTaskState(task.id, 'completed', undefined, {
            recordsProcessed: result.recordsProcessed,
            durationMs,
          });
        }

        // 触发队列处理
        this.processQueue(executionId, tenantId);
      }
    } catch (error) {
      this.clearTaskTimers(task.id);
      this.stopTaskHeartbeat(task.id);

      const errorMessage = error instanceof Error ? error.message : String(error);
      const currentTask = this.tasks.get(task.id);

      if (currentTask?.state === 'cancelled') {
        this.updateTaskState(task.id, 'cancelled');
      } else {
        this.updateTaskState(task.id, 'failed', errorMessage);
        await this.handleTaskFailure(task, executionId, tenantId, errorMessage);
      }
    } finally {
      // Per-execution running count decrement
      const execRunning = this.runningCount.get(executionId) || 0;
      this.runningCount.set(executionId, Math.max(0, execRunning - 1));

      // 尝试处理更多任务
      this.processQueue(executionId, tenantId);

      // 检查是否全部完成
      this.checkExecutionComplete(executionId, tenantId);
    }
  }

  /**
   * 处理任务失败（含重试逻辑）
   */
  private async handleTaskFailure(
    task: DataPipelineTask,
    executionId: string,
    tenantId: string,
    error: string
  ): Promise<void> {
    if (task.retryCount >= task.maxRetries) {
      logger.warn(
        { taskId: task.id, executionId, retries: task.retryCount, error },
        'Task failed after max retries'
      );
      this.emit('task:failed', { taskId: task.id, executionId, error });
      return;
    }

    // 指数退避重试
    const delayMs = this.calculateRetryDelay(task.retryCount);
    task.retryCount++;
    task.state = 'retrying';

    logger.info(
      { taskId: task.id, executionId, attempt: task.retryCount, delayMs },
      'Retrying task with exponential backoff'
    );

    this.emit('task:retrying', { taskId: task.id, attempt: task.retryCount, delayMs });

    // 延迟后重新加入队列（按 executionId 隔离重试）
    setTimeout(() => {
      task.state = 'pending';
      this.queue.push(task);
      this.processQueue(executionId, tenantId);
    }, delayMs);
  }

  /**
   * 计算指数退避延迟
   */
  private calculateRetryDelay(attempt: number): number {
    const exponential = this.config.baseRetryDelayMs * Math.pow(2, attempt - 1);
    const delay = Math.min(exponential, this.config.maxRetryDelayMs);

    if (this.config.retryJitter) {
      return Math.round(delay * (0.5 + Math.random() * 0.5));
    }
    return Math.round(delay);
  }

  // ==================== Stage Execution ====================

  /**
   * 执行单个 stage（实际业务逻辑由外部注入或通过 processor 模拟）
   *
   * 注意：不抛异常，所有错误通过 result.success=false 返回，确保 Promise.race
   * 中 timeoutPromise 和 executionPromise 都 resolve，使超时控制生效。
   */
  private async executeStage(task: DataPipelineTask): Promise<{ success: boolean; recordsProcessed: number; timedOut: boolean; error?: string }> {
    logger.info({ taskId: task.id, stageName: task.stageName }, 'Executing stage');

    // 分段睡眠以支持取消检查
    const baseDuration = this.estimateStageDuration(task);
    const chunks = 10;
    const chunkSize = baseDuration / chunks;
    for (let i = 0; i < chunks; i++) {
      await this.sleep(chunkSize);
      const currentTask = this.tasks.get(task.id);
      if (currentTask?.state === 'cancelled') {
        return { success: false, recordsProcessed: 0, timedOut: false, error: 'TASK_CANCELLED' };
      }
    }

    // 模拟：10% 概率失败（用于测试重试）
    if (Math.random() < 0.1) {
      return {
        success: false,
        recordsProcessed: 0,
        timedOut: false,
        error: `Stage ${task.stageName} failed: simulated transient error`,
      };
    }

    return {
      success: true,
      recordsProcessed: Math.floor(Math.random() * 1000) + 1,
      timedOut: false,
    };
  }

  /**
   * 估算 stage 执行时长（用于模拟）
   */
  private estimateStageDuration(task: DataPipelineTask): number {
    const type = (task.config as any).type as string | undefined;
    switch (type) {
      case 'extract':
        return 200 + Math.random() * 500;
      case 'transform':
        return 100 + Math.random() * 300;
      case 'load':
        return 300 + Math.random() * 800;
      case 'validate':
        return 50 + Math.random() * 150;
      default:
        return 100 + Math.random() * 400;
    }
  }

  // ==================== State Management ====================

  /**
   * 更新任务状态
   */
  private updateTaskState(
    taskId: string,
    state: TaskState,
    error?: string,
    result?: { recordsProcessed?: number; durationMs?: number }
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.state = state;
    if (error) task.error = error;
    if (result) {
      if (result.recordsProcessed !== undefined) {
        task.result = { ...task.result, recordsProcessed: result.recordsProcessed };
      }
    }

    if (state === 'running') task.startedAt = Date.now();
    if (state === 'completed' || state === 'failed' || state === 'cancelled') {
      task.completedAt = Date.now();
    }

    this.emit('task:stateChange', { taskId, state, error });
  }

  /**
   * 检查执行是否完成
   */
  private checkExecutionComplete(executionId: string, tenantId: string): void {
    const tasks = this.getTasksByExecution(executionId);
    const allDone = tasks.every(
      (t) => t.state === 'completed' || t.state === 'failed' || t.state === 'cancelled'
    );

    if (!allDone) return;

    const hasFailure = tasks.some((t) => t.state === 'failed' || t.state === 'cancelled');
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = hasFailure ? 'failed' : 'completed';
      execution.completedAt = new Date().toISOString();

      // 聚合 stage results
      const results: StageResult[] = tasks.map((t) => ({
        stageId: t.stageId,
        stageName: t.stageName,
        status: t.state as StageResult['status'],
        recordsProcessed: t.result?.recordsProcessed || 0,
        startedAt: t.startedAt ? new Date(t.startedAt).toISOString() : undefined,
        completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : undefined,
        error: t.error,
      }));

      this.stageResults.set(executionId, results);
      this.persistExecutionStatus(execution);
    }

    this.emit('execution:complete', {
      executionId,
      status: execution?.status || 'completed',
      taskCount: tasks.length,
    });
  }

  // ==================== Timeout Control ====================

  /**
   * 创建任务超时
   */
  private createTimeout(taskId: string, timeoutMs: number): Promise<{ timedOut: true }> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.timeouts.delete(taskId);
        resolve({ timedOut: true });
      }, timeoutMs);
      this.timeouts.set(taskId, timer);
    });
  }

  /**
   * 清除任务相关定时器
   */
  private clearTaskTimers(taskId: string): void {
    const timeout = this.timeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(taskId);
    }
  }

  // ==================== Heartbeat ====================

  /**
   * 启动任务心跳（用于检测卡死任务）
   */
  private startTaskHeartbeat(taskId: string): void {
    const heartbeat = setInterval(() => {
      const task = this.tasks.get(taskId);
      if (!task || task.state !== 'running') {
        this.stopTaskHeartbeat(taskId);
        return;
      }
      this.emit('task:heartbeat', { taskId, state: task.state });
    }, this.config.taskHeartbeatMs);

    this.heartbeats.set(taskId, heartbeat);
  }

  /**
   * 停止任务心跳
   */
  private stopTaskHeartbeat(taskId: string): void {
    const heartbeat = this.heartbeats.get(taskId);
    if (heartbeat) {
      clearInterval(heartbeat);
      this.heartbeats.delete(taskId);
    }
  }

  // ==================== Persistence ====================

  /**
   * 创建执行记录
   */
  private async createExecutionRecord(executionId: string, pipeline: DataPipeline): Promise<PipelineExecution> {
    const now = new Date().toISOString();
    const execution: PipelineExecution = {
      id: executionId,
      pipelineId: pipeline.id,
      tenantId: pipeline.tenantId,
      status: 'pending',
      startedAt: now,
      stagesResults: [],
    };

    if (this.execRepo) {
      try {
        await this.execRepo.create({
          id: executionId,
          pipelineId: pipeline.id,
          tenantId: pipeline.tenantId,
          status: 'pending',
          startedAt: now,
        });
      } catch (err) {
        logger.warn({ error: err instanceof Error ? err.message : 'unknown' }, 'Failed to persist execution');
      }
    }

    return execution;
  }

  /**
   * 持久化执行状态
   */
  private async persistExecutionStatus(execution: PipelineExecution): Promise<void> {
    if (!this.execRepo) return;

    try {
      if (execution.status === 'completed') {
        await this.execRepo.markCompleted(execution.id);
      } else if (execution.status === 'failed') {
        await this.execRepo.markFailed(execution.id, 'Pipeline execution failed');
      } else if (execution.status === 'running') {
        await this.execRepo.markRunning(execution.id);
      }
    } catch (err) {
      logger.warn({ error: err instanceof Error ? err.message : 'unknown' }, 'Failed to update execution status');
    }
  }

  /**
   * 持久化执行和任务
   */
  private async persistExecution(execution: PipelineExecution, tasks: DataPipelineTask[]): Promise<void> {
    if (!this.execRepo) return;

    try {
      await this.execRepo.markRunning(execution.id);

      for (const task of tasks) {
        await this.execRepo.bulkUpsertStageResults([
          {
            executionId: execution.id,
            pipelineId: execution.pipelineId,
            tenantId: execution.tenantId,
            stageId: task.stageId,
            stageName: task.stageName,
            status: 'pending',
            recordsProcessed: 0,
          },
        ]);
      }
    } catch (err) {
      logger.warn({ error: err instanceof Error ? err.message : 'unknown' }, 'Failed to persist execution tasks');
    }
  }

  // ==================== Helpers ====================

  /**
   * 构建任务列表
   */
  private buildTasks(pipeline: DataPipeline, executionId: string): DataPipelineTask[] {
    return pipeline.stages.map((stage: PipelineStage, index: number) => ({
      id: this.generateTaskId(executionId, stage.id),
      executionId,
      pipelineId: pipeline.id,
      tenantId: pipeline.tenantId,
      stageId: stage.id,
      stageName: stage.name,
      state: 'pending' as TaskState,
      priority: index, // 按顺序优先级
      dependsOn: stage.dependsOn || [],
      config: stage.config,
      createdAt: Date.now(),
      timeoutMs: this.config.defaultTimeoutMs,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      retryDelayMs: this.config.baseRetryDelayMs,
    }));
  }

  /**
   * 获取执行相关的所有任务
   */
  private getTasksByExecution(executionId: string): DataPipelineTask[] {
    const prefix = `${executionId}:`;
    return Array.from(this.tasks.values()).filter((t) => t.id.startsWith(prefix));
  }

  /**
   * 生成 task ID
   */
  private generateTaskId(executionId: string, stageId: string): string {
    return `${executionId}:${stageId}`;
  }

  /**
   * 从 task ID 提取 stageId
   */
  private getTaskId(executionId: string, stageId: string): string {
    return `${executionId}:${stageId}`;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 计算平均执行时长
   */
  private calculateAverageDuration(tasks: DataPipelineTask[]): number {
    const completed = tasks.filter((t) => t.completedAt && t.startedAt);
    if (completed.length === 0) return 0;
    const total = completed.reduce((sum, t) => sum + (t.completedAt! - t.startedAt!), 0);
    return Math.round(total / completed.length);
  }

  /**
   * 异步等待
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
