/**
 * Multi-Agent Orchestration Service
 *
 * Orchestrates multiple AI agents to work together on complex tasks with:
 * - Task distribution and coordination
 * - Result aggregation
 * - Multiple execution strategies (sequential, parallel, hierarchical, hybrid)
 */

export interface AgentTask {
  id: string;
  agentId: string;
  type: 'reasoning' | 'execution' | 'verification' | 'research';
  prompt: string;
  priority: number;
  timeout: number;
  dependencies: string[];
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
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
  private plans: Map<string, OrchestrationPlan> = new Map();
  private taskQueue: AgentTask[] = [];
  private runningTasks: Map<string, AgentTask> = new Map();

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

    if (plan.strategy === 'parallel') {
      await this.executeParallel(plan, results, errors);
    } else if (plan.strategy === 'sequential') {
      await this.executeSequential(plan, results, errors);
    } else {
      await this.executeHybrid(plan, results, errors);
    }

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
          const result = await this.executeTask(task);
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
          const result = await this.executeTask(task);
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
          const result = await this.executeTask(task);
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
        // Circular dependency detected, break to avoid infinite loop
        break;
      }

      if (level.length > 0) {
        levels.push(level);
        level.forEach((t) => completedIds.add(t.id));
      }

      // Remove processed tasks from remaining
      for (const task of level) {
        const idx = remaining.indexOf(task);
        if (idx > -1) remaining.splice(idx, 1);
      }
    }

    return levels;
  }

  /**
   * Execute a single task (simulated - replace with actual agent execution)
   */
  private async executeTask(task: AgentTask): Promise<unknown> {
    await new Promise((resolve) => setTimeout(resolve, task.timeout));
    return { taskId: task.id, type: task.type, output: `Result for ${task.prompt.substring(0, 20)}...` };
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

    // Clear running tasks
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