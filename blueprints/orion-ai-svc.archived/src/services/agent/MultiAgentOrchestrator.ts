/**
 * Multi-Agent Orchestration Service
 *
 * Orchestrates multiple AI agents to work together on complex tasks with:
 * - Task distribution and coordination
 * - Result aggregation
 * - Multiple execution strategies (sequential, parallel, hierarchical, hybrid)
 */

import type { AgentTask } from '../../types/agent';
import type { AIGateway } from '../AIGateway';
import { ToolRegistry } from './ToolRegistry';

// 扩展 AgentTask 以支持工具调用
export interface ExecutionTask extends AgentTask {
  tool?: string;
  toolParams?: Record<string, unknown>;
}

// 信号量实现
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }
}

export interface OrchestrationPlan {
  id: string;
  name: string;
  description: string;
  tasks: AgentTask[];
  strategy: 'sequential' | 'parallel' | 'hierarchical' | 'hybrid';
  maxConcurrent: number;
  status: 'draft' | 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface OrchestrationResult {
  success: boolean;
  planId: string;
  results: Map<string, unknown>;
  errors: Map<string, string>;
  duration: number;
}

export class MultiAgentOrchestrator {
  private aiGateway?: AIGateway;
  private toolRegistry?: ToolRegistry;
  private readonly maxConcurrentTools = 10;
  private readonly maxConcurrentLLMCalls = 5;
  private toolSemaphore: Semaphore;
  private llmSemaphore: Semaphore;
  private plans: Map<string, OrchestrationPlan> = new Map();
  private runningTasks: Map<string, ExecutionTask> = new Map();
  private taskQueue: AgentTask[] = [];

  constructor(aiGateway?: AIGateway, toolRegistry?: ToolRegistry) {
    this.aiGateway = aiGateway;
    this.toolRegistry = toolRegistry;
    this.toolSemaphore = new Semaphore(this.maxConcurrentTools);
    this.llmSemaphore = new Semaphore(this.maxConcurrentLLMCalls);
  }

  /**
   * Update AIGateway instance (for dependency injection)
   */
  setAIGateway(aiGateway: AIGateway): void {
    this.aiGateway = aiGateway;
  }

  /**
   * Update ToolRegistry instance (for dependency injection)
   */
  setToolRegistry(toolRegistry: ToolRegistry): void {
    this.toolRegistry = toolRegistry;
  }

  /**
   * Execute a single task (工具调用或 LLM 推理)
   */
  private async executeTask(task: ExecutionTask): Promise<unknown> {
    task.status = 'running';
    task.startedAt = new Date();

    // 工具调用
    if (task.type === 'execution' && task.tool && this.toolRegistry) {
      await this.toolSemaphore.acquire();
      try {
        const tool = this.toolRegistry.get(task.tool);
        if (!tool) throw new Error(`Tool not found: ${task.tool}`);
        return tool.execute({ params: task.toolParams || {}, traceId: task.id });
      } finally {
        this.toolSemaphore.release();
      }
    }

    // LLM 推理
    if (this.aiGateway) {
      await this.llmSemaphore.acquire();
      try {
        const response = await this.aiGateway.execute({
          scenario: 'agent_reasoning' as any,
          input: {
            prompt: task.prompt,
            systemPrompt: this.buildSystemPrompt(task),
          },
          options: {
            timeout: task.timeout,
            fallbackEnabled: true,
          },
          context: {
            userId: 'orchestrator',
            traceId: task.id,
          },
        });
        return response.data;
      } finally {
        this.llmSemaphore.release();
      }
    }

    // Fallback: 模拟执行
    await new Promise((resolve) => setTimeout(resolve, task.timeout));
    return { taskId: task.id, type: task.type, output: `Result for ${task.prompt.substring(0, 20)}...` };
  }

  private buildSystemPrompt(task: ExecutionTask): string {
    const availableTools = this.toolRegistry?.list().map(t => `- ${t.name}: ${t.description}`).join('\n') || '';
    return `你是一个 ${task.type} 类型的 AI 助手。
任务类型：${task.type}。
可用工具：
${availableTools}

输出要求：使用 JSON 格式返回结果，包含 conclusion 和 reasoning 字段。
请基于以下提示完成任务：`;
  }

  /**
   * Create a new orchestration plan
   */
  async createPlan(
    name: string,
    description: string,
    tasks: Omit<AgentTask, 'id' | 'status'>[],
    strategy: OrchestrationPlan['strategy'],
    maxConcurrent: number = 3,
  ): Promise<OrchestrationPlan> {
    const plan: OrchestrationPlan = {
      id: `plan-${crypto.randomUUID()}`,
      name,
      description,
      tasks: tasks.map((t) => ({ ...t, id: `task-${crypto.randomUUID()}`, status: 'pending' })),
      strategy,
      maxConcurrent,
      status: 'planning',
      createdAt: new Date(),
    };
    this.plans.set(plan.id, plan);
    return plan;
  }

  /**
   * Execute an orchestration plan
   */
  async executePlan(planId: string): Promise<OrchestrationResult> {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error('Plan not found');

    plan.status = 'executing';
    const startTime = Date.now();
    const results = new Map<string, unknown>();
    const errors = new Map<string, string>();

    // 使用 hybrid 模式（支持依赖关系的并行执行）
    await this.executeHybrid(plan as any, results, errors);

    const duration = Date.now() - startTime;
    plan.status = errors.size > 0 ? 'failed' : 'completed';
    plan.completedAt = new Date();

    return {
      success: errors.size === 0,
      planId,
      results,
      errors,
      duration,
    };
  }

  /**
   * Execute tasks in parallel (up to maxConcurrent at a time)
   */
  private async executeParallel(
    plan: OrchestrationPlan,
    results: Map<string, unknown>,
    errors: Map<string, string>,
  ): Promise<void> {
    const pending = plan.tasks.filter((t) => t.status === 'pending');
    while (pending.length > 0) {
      const batch = pending.splice(0, plan.maxConcurrent);
      const promises = batch.map(async (task) => {
        task.status = 'running';
        task.startedAt = new Date();
        this.runningTasks.set(task.id, task);
        try {
          const result = await this.executeTask(task as ExecutionTask);
          task.status = 'completed';
          task.result = result;
          task.completedAt = new Date();
          results.set(task.id, result);
        } catch (e) {
          task.status = 'failed';
          task.error = e instanceof Error ? e.message : 'Unknown error';
          errors.set(task.id, task.error);
        } finally {
          this.runningTasks.delete(task.id);
        }
      });
      await Promise.all(promises);
    }
  }

  /**
   * Execute tasks sequentially (in order)
   */
  private async executeSequential(
    plan: OrchestrationPlan,
    results: Map<string, unknown>,
    errors: Map<string, string>,
  ): Promise<void> {
    for (const task of plan.tasks) {
      if (task.status === 'pending') {
        task.status = 'running';
        task.startedAt = new Date();
        this.runningTasks.set(task.id, task);
        try {
          const result = await this.executeTask(task as ExecutionTask);
          task.status = 'completed';
          task.result = result;
          task.completedAt = new Date();
          results.set(task.id, result);
        } catch (e) {
          task.status = 'failed';
          task.error = e instanceof Error ? e.message : 'Unknown error';
          errors.set(task.id, task.error);
          break;
        } finally {
          this.runningTasks.delete(task.id);
        }
      }
    }
  }

  /**
   * Execute tasks in hybrid mode (hierarchical with parallel levels)
   */
  private async executeHybrid(
    plan: OrchestrationPlan,
    results: Map<string, unknown>,
    errors: Map<string, string>,
  ): Promise<void> {
    const levels = this.buildTaskLevels(plan.tasks, results);
    for (const level of levels) {
      const pending = level.filter((t) => t.status === 'pending');
      const promises = pending.map(async (task) => {
        task.status = 'running';
        task.startedAt = new Date();
        this.runningTasks.set(task.id, task);
        try {
          const result = await this.executeTask(task as ExecutionTask);
          task.status = 'completed';
          task.result = result;
          task.completedAt = new Date();
          results.set(task.id, result);
        } catch (e) {
          task.status = 'failed';
          task.error = e instanceof Error ? e.message : 'Unknown error';
          errors.set(task.id, task.error);
        } finally {
          this.runningTasks.delete(task.id);
        }
      });
      await Promise.all(promises);
    }
  }

  /**
   * Build task levels based on dependencies
   */
  private buildTaskLevels(tasks: AgentTask[], results: Map<string, unknown>): AgentTask[][] {
    const levels: AgentTask[][] = [];
    const remaining = [...tasks];
    const completedIds = new Set<string>();

    while (remaining.length > 0) {
      const level = remaining.filter((t) => {
        const depsCompleted = t.dependencies.every((d) => completedIds.has(d) || results.has(d));
        return depsCompleted;
      });

      if (level.length === 0 && remaining.length > 0) {
        break;
      }

      if (level.length > 0) {
        levels.push(level);
        level.forEach((t) => completedIds.add(t.id));
      }

      for (const task of level) {
        const idx = remaining.indexOf(task);
        if (idx > -1) remaining.splice(idx, 1);
      }
    }

    return levels;
  }

  /**
   * Get a plan by ID
   */
  async getPlan(planId: string): Promise<OrchestrationPlan | null> {
    return this.plans.get(planId) || null;
  }

  /**
   * List all plans
   */
  async listPlans(): Promise<OrchestrationPlan[]> {
    return Array.from(this.plans.values());
  }

  /**
   * Abort a running plan
   */
  async abortPlan(planId: string): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    plan.status = 'failed';
    for (const task of plan.tasks) {
      if (task.status === 'running' || task.status === 'assigned') {
        task.status = 'failed';
        task.error = 'Aborted by user';
        task.completedAt = new Date();
      }
    }

    for (const [taskId] of this.runningTasks) {
      const task = plan.tasks.find((t) => t.id === taskId);
      if (task) {
        this.runningTasks.delete(taskId);
      }
    }

    return true;
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): AgentTask[] {
    return Array.from(this.runningTasks.values());
  }

  /**
   * Get task queue
   */
  getTaskQueue(): AgentTask[] {
    return [...this.taskQueue];
  }
}