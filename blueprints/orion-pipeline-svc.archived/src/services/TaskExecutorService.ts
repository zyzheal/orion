// src/services/TaskExecutorService.ts
// 本地进程任务执行器 — 基于 child_process.spawn 执行命令

import { spawn } from 'child_process';
import pino from 'pino';

const logger = pino({ name: 'task-executor' });

export interface TaskExecutionResult {
  taskId: string;
  status: 'success' | 'failed' | 'timeout' | 'cancelled';
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
}

export interface TaskConfig {
  taskId: string;
  command: string;
  args?: string[];
  workingDir?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export class TaskExecutorService {
  private runningTasks = new Map<string, { process: any; timeoutTimer: NodeJS.Timeout | null }>();

  /**
   * 执行单个任务（基于本地进程）
   */
  async executeTask(config: TaskConfig): Promise<TaskExecutionResult> {
    const startedAt = new Date().toISOString();
    const timeoutMs = config.timeoutMs || 30 * 60 * 1000;

    return new Promise((resolve) => {
      const env = { ...process.env, ...config.env };
      const child = spawn(config.command, config.args || [], {
        env,
        cwd: config.workingDir || process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });

      const timeoutTimer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
        resolve(this.buildResult(config.taskId, 'timeout', -1, stdout, stderr, startedAt));
      }, timeoutMs);

      this.runningTasks.set(config.taskId, { process: child, timeoutTimer });

      child.on('close', (exitCode) => {
        clearTimeout(timeoutTimer);
        this.runningTasks.delete(config.taskId);
        resolve(
          this.buildResult(
            config.taskId,
            exitCode === 0 ? 'success' : 'failed',
            exitCode ?? 1,
            stdout,
            stderr,
            startedAt
          )
        );
      });

      child.on('error', (error) => {
        clearTimeout(timeoutTimer);
        this.runningTasks.delete(config.taskId);
        resolve(
          this.buildResult(config.taskId, 'failed', -1, stdout, error.message, startedAt)
        );
      });
    });
  }

  /**
   * 取消运行中的任务
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.runningTasks.get(taskId);
    if (!task) return false;
    if (task.timeoutTimer) clearTimeout(task.timeoutTimer);
    task.process.kill('SIGTERM');
    this.runningTasks.delete(taskId);
    return true;
  }

  /**
   * 获取正在运行的任务列表
   */
  getRunningTaskIds(): string[] {
    return Array.from(this.runningTasks.keys());
  }

  /**
   * 构建统一的任务执行结果
   */
  private buildResult(
    taskId: string,
    status: string,
    exitCode: number,
    stdout: string,
    stderr: string,
    startedAt: string
  ): TaskExecutionResult {
    const finishedAt = new Date().toISOString();
    return {
      taskId,
      status: status as TaskExecutionResult['status'],
      exitCode,
      stdout,
      stderr,
      durationMs: Date.now() - new Date(startedAt).getTime(),
      startedAt,
      finishedAt,
    };
  }
}
