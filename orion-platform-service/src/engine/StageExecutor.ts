/**
 * Stage Executor - Stage 执行器
 *
 * 负责：
 * - 执行 Stage 内的 Tasks
 * - 处理 Stage 超时和重试
 * - 更新 Stage 状态
 */

import { Stage } from '../models/Stage';
import { Task, TaskStatus, startTask, completeTask, failTask, appendTaskLog } from '../models/Task';
import { TaskRunner } from './TaskRunner';
import { PipelineEventPublisher } from '../events/PipelineEventPublisher';

export class StageExecutor {
  private taskRunner: TaskRunner;
  private eventPublisher: PipelineEventPublisher;

  constructor(taskRunner: TaskRunner, eventPublisher: PipelineEventPublisher) {
    this.taskRunner = taskRunner;
    this.eventPublisher = eventPublisher;
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

      const result = await this.executeTask(runId, stage, task);

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
  async executeTask(runId: string, stage: Stage, task: Task): Promise<Task> {
    // 开始 Task
    let updatedTask = startTask(task);
    await this.eventPublisher.publishTaskStarted(runId, stage.id, updatedTask);

    try {
      // 设置超时
      const timeoutPromise = new Promise<Task>((_, reject) => {
        setTimeout(() => reject(new Error(`Task timeout after ${updatedTask.timeoutSeconds}s`)), updatedTask.timeoutSeconds * 1000);
      });

      // 执行 Task
      const executePromise = this.taskRunner.run(updatedTask);

      // 等待完成或超时
      const result = await Promise.race([executePromise, timeoutPromise]);

      // Task 完成
      updatedTask = completeTask(result, result.result);
      await this.eventPublisher.publishTaskCompleted(runId, stage.id, updatedTask);

      return updatedTask;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 追加日志
      updatedTask = appendTaskLog(updatedTask, `[ERROR] ${errorMessage}`);

      // Task 失败
      updatedTask = failTask(updatedTask, errorMessage, updatedTask.log);
      await this.eventPublisher.publishTaskFailed(runId, stage.id, updatedTask, errorMessage);

      return updatedTask;
    }
  }
}
