/**
 * Stage Executor - Stage 执行器 (FIXED P0-3)
 *
 * 负责：
 * - 执行 Stage 内的 Tasks
 * - 处理 Stage 超时和重试（超时会取消正在运行的 Task）
 * - 更新 Stage 状态
 * - 注册 Task 输出变量到 VariableContext
 */

import { Stage } from '../models/Stage';
import { Task, TaskStatus, startTask, completeTask, failTask, appendTaskLog } from '../models/Task';
import { TaskRunner } from './TaskRunner';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';
import { ArtifactService } from '../services/pipeline/ArtifactService';
import { VariableContext } from './VariableContext';
import { DebugController } from './DebugController';

export class StageExecutor {
  private taskRunner: TaskRunner;
  private eventPublisher: PipelineEventPublisher;
  private artifactService: ArtifactService | null;
  private variableContext: VariableContext | null;
  private debugController: DebugController | null;

  // Track active abort controllers for cancellation
  private activeControllers = new Map<string, AbortController>();

  constructor(
    taskRunner: TaskRunner,
    eventPublisher: PipelineEventPublisher,
    artifactService?: ArtifactService,
    variableContext?: VariableContext,
    debugController?: DebugController
  ) {
    this.taskRunner = taskRunner;
    this.eventPublisher = eventPublisher;
    this.artifactService = artifactService || null;
    this.variableContext = variableContext || null;
    this.debugController = debugController || null;
  }

  /**
   * Set the VariableContext for this executor (called per-run)
   */
  setVariableContext(ctx: VariableContext): void {
    this.variableContext = ctx;
  }

  /**
   * 执行 Stage 的所有 Tasks
   */
  async executeStage(
    runId: string,
    stage: Stage,
    tasks: Task[]
  ): Promise<{ success: boolean; error?: string }> {
    // 按 sequence 排序 Tasks
    const sortedTasks = [...tasks].sort((a, b) => a.sequence - b.sequence);

    for (const task of sortedTasks) {
      if (task.status === TaskStatus.SUCCESS) {
        continue;
      }

      // Debug integration: check if we should pause before this task
      if (this.debugController && this.debugController.shouldPause(runId)) {
        // Block until resume signal (or step mode allows one task)
        await this.debugController.waitForSignal(runId);
        // After stepping, status is reset to paused — record this task completion
        // The next iteration will hit the pause check again
      }

      const result = await this.executeTask(runId, stage, task);

      // Debug integration: after task completes in step mode, re-pause
      if (this.debugController) {
        this.debugController.completeStep(runId, { taskId: task.id, status: result.status });
      }

      if (result.status === TaskStatus.FAILED) {
        return {
          success: false,
          error: result.error,
        };
      }
    }

    return { success: true };
  }

  /**
   * 执行单个 Task
   */
  async executeTask(
    runId: string,
    stage: Stage,
    task: Task,
    options?: { stageName?: string; taskName?: string }
  ): Promise<Task> {
    // 开始 Task
    let updatedTask = startTask(task);
    await this.eventPublisher.publishTaskStarted(runId, stage.id, updatedTask);

    // 创建 AbortController 用于超时取消
    const controller = new AbortController();
    this.activeControllers.set(task.id, controller);

    try {
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          // 取消正在运行的 Task
          controller.abort();
          reject(new Error(`Task timeout after ${updatedTask.timeoutSeconds}s`));
        }, updatedTask.timeoutSeconds * 1000);
      });

      // 执行 Task（传入 AbortSignal）
      const executePromise = this.taskRunner.run(updatedTask, controller.signal);

      // 等待完成或超时
      const result = await Promise.race([executePromise, timeoutPromise]);

      // Task 完成
      updatedTask = completeTask(result, result.result);
      await this.eventPublisher.publishTaskCompleted(runId, stage.id, updatedTask);

      // Register task outputs in VariableContext for downstream stages
      this.registerTaskOutputs(result.result as Record<string, unknown> | undefined, options?.taskName || task.name);

      return updatedTask;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 追加日志
      updatedTask = appendTaskLog(updatedTask, `[ERROR] ${errorMessage}`);

      // Task 失败
      updatedTask = failTask(updatedTask, errorMessage, updatedTask.log);
      await this.eventPublisher.publishTaskFailed(runId, stage.id, updatedTask, errorMessage);

      return updatedTask;
    } finally {
      // 清理 AbortController
      this.activeControllers.delete(task.id);
    }
  }

  /**
   * Register task outputs in the VariableContext.
   * Outputs are keyed by task name so downstream stages can reference them
   * via ${tasks.<taskName>.outputs.<key>} syntax.
   */
  private registerTaskOutputs(result: Record<string, unknown> | undefined, taskName: string): void {
    if (!this.variableContext || !result) return;

    const outputs = result.outputs as { [key: string]: string } | undefined;
    if (!outputs) return;

    for (const [key, value] of Object.entries(outputs)) {
      this.variableContext.setTaskOutput(taskName, key, value);
    }
  }

  /**
   * 取消正在运行的 Task（供外部调用，如 P0-4 cancelRun）
   */
  cancelTask(taskId: string): void {
    const controller = this.activeControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(taskId);
    }
  }

  /**
   * 取消 Stage 内所有正在运行的 Tasks
   */
  cancelStage(stage: Stage): void {
    // 清理此 stage 相关的所有活跃控制器
    for (const [taskId] of this.activeControllers) {
      if (taskId.startsWith(stage.id)) {
        this.cancelTask(taskId);
      }
    }
  }

  /**
   * 获取 Stage 可用的 Artifact 列表
   */
  async getAvailableArtifacts(runId: string, stageId: string): Promise<import('../services/pipeline/ArtifactService').ArtifactRecord[]> {
    if (!this.artifactService) return [];
    return this.artifactService.getAvailableArtifacts(runId, stageId);
  }

  /**
   * 将上游 Stages 的 artifacts 传递给目标 Stage
   */
  async passUpstreamArtifacts(
    runId: string,
    upstreamStageIds: string[],
    targetStageId: string
  ): Promise<{ passed: number; errors: string[] }> {
    if (!this.artifactService) return { passed: 0, errors: [] };

    let totalPassed = 0;
    const allErrors: string[] = [];

    for (const upstreamId of upstreamStageIds) {
      const result = await this.artifactService.passToStage(runId, upstreamId, targetStageId);
      totalPassed += result.passed;
      allErrors.push(...result.errors);
    }

    return { passed: totalPassed, errors: allErrors };
  }
}
