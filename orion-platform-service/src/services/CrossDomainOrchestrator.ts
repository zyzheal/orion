/**
 * Cross-Domain Orchestrator Service
 *
 * Orchestrates workflows across multiple domains (CI/CD, Monitoring, Security, etc.)
 * with event-driven coordination and dependency management.
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Types
// ============================================================

export interface DomainWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers: Trigger[];
  status: 'active' | 'paused' | 'completed' | 'failed';
  lastRun?: Date;
  createdAt: Date;
}

export interface WorkflowStep {
  id: string;
  domain: 'pipeline' | 'deploy' | 'monitor' | 'security' | 'notify';
  action: string;
  parameters: Record<string, unknown>;
  dependsOn: string[];
  timeout: number;
  retryPolicy?: { maxRetries: number; backoff: number };
}

export interface Trigger {
  type: 'event' | 'schedule' | 'manual';
  config: Record<string, unknown>;
}

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: ExecutionStepResult[];
  startedAt: Date;
  completedAt?: Date;
  triggeredBy: string;
}

export interface ExecutionStepResult {
  stepId: string;
  status: string;
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateWorkflowInput {
  name: string;
  description: string;
  steps: Omit<WorkflowStep, 'id'>[];
  triggers: Trigger[];
}

export interface WorkflowListFilter {
  status?: 'active' | 'paused' | 'completed' | 'failed';
  domain?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// Service
// ============================================================

export class CrossDomainOrchestrator {
  private workflows: Map<string, DomainWorkflow> = new Map();
  private executions: Map<string, ExecutionRecord> = new Map();

  /**
   * Create a new domain workflow
   */
  async createWorkflow(input: CreateWorkflowInput): Promise<DomainWorkflow> {
    const workflow: DomainWorkflow = {
      id: `workflow-${uuidv4()}`,
      name: input.name,
      description: input.description,
      steps: input.steps.map((s) => ({
        ...s,
        id: `step-${uuidv4()}`,
      })),
      triggers: input.triggers,
      status: 'active',
      createdAt: new Date(),
    };

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  /**
   * Execute a workflow by ID
   */
  async executeWorkflow(
    workflowId: string,
    triggeredBy: string,
    initialInput?: Record<string, unknown>
  ): Promise<ExecutionRecord> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Allow re-execution of completed or failed workflows
    if (workflow.status !== 'active' && workflow.status !== 'completed' && workflow.status !== 'failed') {
      throw new Error(`Workflow is not active (current status: ${workflow.status})`);
    }

    // Reset to active for re-execution
    workflow.status = 'active';

    const execution: ExecutionRecord = {
      id: `exec-${uuidv4()}`,
      workflowId,
      status: 'running',
      steps: workflow.steps.map((s) => ({
        stepId: s.id,
        status: 'pending',
      })),
      startedAt: new Date(),
      triggeredBy,
    };

    this.executions.set(execution.id, execution);
    workflow.lastRun = new Date();

    // Execute steps based on dependencies
    await this.executeSteps(execution, workflow.steps, initialInput || {});

    // Determine final status
    const hasFailed = execution.steps.some((s) => s.status === 'failed');
    execution.status = hasFailed ? 'failed' : 'completed';
    execution.completedAt = new Date();

    // Update workflow status
    workflow.status = execution.status === 'failed' ? 'failed' : 'completed';

    return execution;
  }

  /**
   * Execute workflow steps based on dependencies
   */
  private async executeSteps(
    execution: ExecutionRecord,
    steps: WorkflowStep[],
    context: Record<string, unknown>
  ): Promise<void> {
    const completed = new Set<string>();
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    while (completed.size < steps.length) {
      // Find steps that are ready to execute (all dependencies completed)
      const readySteps = steps.filter(
        (s) =>
          !completed.has(s.id) &&
          s.dependsOn.every((d) => completed.has(d))
      );

      if (readySteps.length === 0) {
        // No more steps can proceed - either done or stuck
        break;
      }

      // Execute ready steps
      for (const step of readySteps) {
        const stepResult = execution.steps.find((s) => s.stepId === step.id)!;
        stepResult.status = 'running';
        stepResult.startedAt = new Date();

        try {
          // Execute with timeout
          const result = await this.executeStepWithTimeout(step, context);
          stepResult.status = 'completed';
          stepResult.result = result;
          context[step.id] = result;
        } catch (e) {
          stepResult.status = 'failed';
          stepResult.error = e instanceof Error ? e.message : 'Unknown error';
          execution.status = 'failed';
          return;
        }

        stepResult.completedAt = new Date();
        completed.add(step.id);
      }
    }
  }

  /**
   * Execute a single step with timeout
   */
  private async executeStepWithTimeout(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<unknown> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Step ${step.id} timed out after ${step.timeout}ms`));
      }, step.timeout);

      try {
        const result = await this.executeStep(step, context);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (e) {
        clearTimeout(timeoutId);
        reject(e);
      }
    });
  }

  /**
   * Execute a single step - simulates cross-domain execution
   */
  private async executeStep(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // Simulate cross-domain execution
    // In real implementation, this would call the appropriate domain service
    return {
      domain: step.domain,
      action: step.action,
      result: 'success',
      context,
    };
  }

  /**
   * Get a workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<DomainWorkflow | null> {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * List all workflows
   */
  async listWorkflows(filter?: WorkflowListFilter): Promise<DomainWorkflow[]> {
    let results = Array.from(this.workflows.values());

    if (filter?.status) {
      results = results.filter((w) => w.status === filter.status);
    }

    if (filter?.domain) {
      results = results.filter((w) =>
        w.steps.some((s) => s.domain === filter.domain)
      );
    }

    // Sort by createdAt descending
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get an execution by ID
   */
  async getExecution(executionId: string): Promise<ExecutionRecord | null> {
    return this.executions.get(executionId) || null;
  }

  /**
   * List executions for a workflow
   */
  async listExecutions(workflowId: string): Promise<ExecutionRecord[]> {
    return Array.from(this.executions.values())
      .filter((e) => e.workflowId === workflowId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Pause a workflow
   */
  async pauseWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    if (workflow.status !== 'active') {
      throw new Error(`Cannot pause workflow with status: ${workflow.status}`);
    }

    workflow.status = 'paused';
    return true;
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    if (workflow.status !== 'paused') {
      throw new Error(`Cannot resume workflow with status: ${workflow.status}`);
    }

    workflow.status = 'active';
    return true;
  }
}