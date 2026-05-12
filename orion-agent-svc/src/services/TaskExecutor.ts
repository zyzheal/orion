import type { Redis } from 'ioredis';
import type { AppConfig } from '../config/app';
import {
  Task,
  TaskStatus,
  DispatchTaskRequest,
  SandboxConfig,
  SandboxResult,
} from '../types/agent';
import { AgentSandbox, SandboxTask as SandboxTaskType } from './AgentSandbox';
import { v4 as uuidv4 } from 'uuid';

/**
 * TaskExecutor - Task execution with sandbox isolation
 *
 * Uses AgentSandbox (Worker Thread) for secure execution with:
 * - Memory/resource limits per task
 * - Command allowlisting
 * - Timeout enforcement
 * - Path blocklisting
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

    // Persist task
    this.tasks.set(task.id, task);
    await this.redis.set(`task:${task.id}`, JSON.stringify(task), 'EX', 86400);

    // Execute in sandbox asynchronously
    this.executeInSandbox(task).catch(err => {
      task.status = TaskStatus.FAILED;
      task.errorMessage = err.message;
      task.completedAt = new Date().toISOString();
      this.tasks.set(task.id, task);
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

    const result = await this.sandbox.execute(sandboxTask);

    // Update task with result
    const completedTask = this.tasks.get(task.id);
    if (completedTask) {
      completedTask.status = result.success ? TaskStatus.SUCCESS : TaskStatus.FAILED;
      completedTask.exitCode = result.success ? 0 : 1;
      completedTask.stdout = JSON.stringify(result.output);
      completedTask.stderr = result.error || '';
      completedTask.completedAt = new Date().toISOString();
      this.tasks.set(task.id, completedTask);
    }

    return result;
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
