import type { Redis } from 'ioredis';
import type { AppConfig } from '../../config/app';
import {
  Task,
  TaskStatus,
  DispatchTaskRequest,
} from '../../types/agent';
import { AgentSandbox, SandboxConfig, SandboxResult, SandboxTask as SandboxTaskType } from './AgentSandbox';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../utils/database.js';

/**
 * TaskExecutor - Task execution with sandbox isolation
 *
 * Uses AgentSandbox (Worker Thread) for secure execution with:
 * - Memory/resource limits per task
 * - Command allowlisting
 * - Timeout enforcement
 * - Path blocklisting
 *
 * Persistence: Redis (cache) + PostgreSQL (persistent storage)
 */
export class TaskExecutor {
  private redis: Redis;
  private config: AppConfig;
  private sandbox: AgentSandbox;
  private tasks = new Map<string, Task>();
  private readonly MAX_TASKS_IN_MEMORY = 1000;

  constructor(redis: Redis, config: AppConfig) {
    this.redis = redis;
    this.config = config;
    this.sandbox = new AgentSandbox({
      memoryLimitMB: config.sandbox.memoryLimit || 512,
      defaultTimeoutMs: (config.sandbox.timeout || 30) * 1000,
    });
  }

  /**
   * Persist task to PostgreSQL
   */
  private async persistTask(task: Task): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_tasks (id, agent_id, task_type, payload, status, result, error, started_at, finished_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           result = EXCLUDED.result,
           error = EXCLUDED.error,
           started_at = EXCLUDED.started_at,
           finished_at = EXCLUDED.finished_at,
           updated_at = NOW()`,
        [
          task.id,
          task.agentId,
          'command',
          JSON.stringify({ command: task.command, workingDirectory: task.workingDirectory, environment: task.environment }),
          task.status,
          task.stdout ? JSON.stringify({ stdout: task.stdout, stderr: task.stderr, exitCode: task.exitCode }) : null,
          task.errorMessage,
          task.startedAt ? new Date(task.startedAt) : null,
          task.completedAt ? new Date(task.completedAt) : null,
          new Date(task.createdAt),
        ],
      );
    } catch (err) {
      // Log but don't fail - Redis is the primary store
      console.error('Failed to persist task to PostgreSQL:', err);
    }
  }

  /**
   * Add task execution log
   */
  async addTaskLog(taskId: string, level: 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_task_logs (task_id, level, message, metadata, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [taskId, level, message, metadata ? JSON.stringify(metadata) : null],
      );
    } catch (err) {
      console.error('Failed to add task log:', err);
    }
  }

  /**
   * Get task logs from PostgreSQL
   */
  async getTaskLogsFromDb(taskId: string, limit = 100): Promise<Array<{ level: string; message: string; created_at: Date }>> {
    const result = await query(
      `SELECT level, message, created_at FROM agent_task_logs WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [taskId, limit],
    );
    return result.rows;
  }

  /**
   * Dispatch a task to an agent for sandboxed execution
   */
  async dispatch(
    agentId: string,
    request: DispatchTaskRequest,
  ): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      agentId,
      status: TaskStatus.RUNNING,
      command: request.command,
      workingDirectory: request.workingDirectory || '/workspace',
      environment: request.environment || {},
      timeoutSeconds: request.timeoutSeconds || this.config.sandbox.timeout,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      exitCode: null,
      stdout: '',
      stderr: '',
      errorMessage: null,
    };

    // Evict oldest completed tasks if over capacity
    if (this.tasks.size >= this.MAX_TASKS_IN_MEMORY) {
      const completedTask = Array.from(this.tasks.values()).find(t => t.completedAt);
      if (completedTask) this.tasks.delete(completedTask.id);
    }

    // Persist task to in-memory and Redis
    this.tasks.set(task.id, task);
    await this.redis.set(`task:${task.id}`, JSON.stringify(task), 'EX', 86400);

    // Persist to PostgreSQL for durability
    await this.persistTask(task);
    await this.addTaskLog(task.id, 'info', `Task dispatched to agent ${agentId}`, { command: task.command });

    // Execute in sandbox asynchronously
    this.executeInSandbox(task).catch(async (err) => {
      task.status = TaskStatus.FAILED;
      task.errorMessage = err.message;
      task.completedAt = new Date().toISOString();
      this.tasks.set(task.id, task);
      await this.persistTask(task);
      await this.addTaskLog(task.id, 'error', `Task failed: ${err.message}`);
    });

    return task;
  }

  /**
   * Execute a command inside the sandboxed Worker Thread
   */
  private async executeInSandbox(task: Task): Promise<SandboxResult> {
    const sandboxTask: Omit<SandboxTaskType, 'id'> = {
      action: 'run_command',
      input: { command: task.command },
      profile: {
        allowedTools: ['run_command', 'read_file', 'write_code'],
        maxExecutionTimeMs: task.timeoutSeconds * 1000,
        memoryLimitMB: this.config.sandbox.memoryLimit || 512,
      },
    };

    await this.addTaskLog(task.id, 'info', `Executing command: ${task.command}`, { timeout: task.timeoutSeconds });

    const result = await this.sandbox.execute(sandboxTask);

    // Update task with result
    const completedTask = this.tasks.get(task.id);
    if (completedTask) {
      completedTask.status = result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED;
      completedTask.exitCode = result.success ? 0 : 1;
      completedTask.stdout = JSON.stringify(result.output);
      completedTask.stderr = result.error || '';
      completedTask.completedAt = new Date().toISOString();
      this.tasks.set(task.id, completedTask);
    }

    // Persist updated task to PostgreSQL
    await this.persistTask(completedTask!);
    await this.addTaskLog(
      task.id,
      result.success ? 'info' : 'error',
      result.success ? 'Task completed successfully' : `Task failed: ${result.error}`,
      { exitCode: result.success ? 0 : 1, durationMs: result.durationMs },
    );

    // Return a SandboxResult-compatible object for the caller
    return {
      taskId: result.taskId,
      success: result.success,
      output: result.output,
      error: result.error,
      durationMs: result.durationMs,
    };
  }

  /**
   * Get task details by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    // Try in-memory first
    const cached = this.tasks.get(taskId);
    if (cached) return cached;

    // Fall back to Redis
    const data = await this.redis.get(`task:${taskId}`);
    if (data) {
      const task = JSON.parse(data);
      this.tasks.set(taskId, task);
      return task;
    }
    return null;
  }

  /**
   * Get task logs
   */
  async getTaskLogs(taskId: string): Promise<string> {
    const task = await this.getTask(taskId);
    if (!task) return '';
    return `${task.stdout}\n${task.stderr}`;
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = TaskStatus.CANCELLED;
    task.completedAt = new Date().toISOString();
    task.errorMessage = 'Cancelled by user';
    this.tasks.set(taskId, task);

    // Update Redis
    await this.redis.set(`task:${taskId}`, JSON.stringify(task), 'EX', 86400);

    // Persist to PostgreSQL
    await this.persistTask(task);
    await this.addTaskLog(taskId, 'warn', 'Task cancelled by user');

    return true;
  }

  /**
   * List tasks with optional filtering
   */
  async listTasks(options?: { agentId?: string; status?: TaskStatus; limit?: number }): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    if (options?.agentId) tasks = tasks.filter(t => t.agentId === options.agentId);
    if (options?.status) tasks = tasks.filter(t => t.status === options.status);
    if (options?.limit) tasks = tasks.slice(0, options.limit);
    return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
