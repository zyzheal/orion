import { createLogger } from '../utils/logger';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import {
  RunbookDefinitionRepository,
  RunbookDefinitionEntity,
  RunbookExecutionRepository,
  RunbookExecutionEntity,
  RunbookStep,
} from './RunbookRepository';

const logger = pino({ name: 'RunbookService' });

export interface CreateRunbookInput {
  name: string;
  description?: string;
  category: string;
  steps: RunbookStep[];
  variables?: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateRunbookInput {
  name?: string;
  description?: string;
  category?: string;
  steps?: RunbookStep[];
  variables?: Record<string, unknown>;
  enabled?: boolean;
}

export interface ExecuteRunbookInput {
  runbookId: string;
  triggeredBy: string;
  context?: Record<string, unknown>;
}

/**
 * RunbookService - Manages runbook definitions and execution
 */
export class RunbookService {
  constructor(
    private readonly definitionRepo: RunbookDefinitionRepository,
    private readonly executionRepo: RunbookExecutionRepository,
  ) {}

  // ==================== Runbook Definition CRUD ====================

  async create(input: CreateRunbookInput): Promise<RunbookDefinitionEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, name: input.name, category: input.category }, 'Creating runbook definition');

    const runbook = await this.definitionRepo.create({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      steps: JSON.stringify(input.steps),
      variables: JSON.stringify(input.variables ?? {}),
      enabled: input.enabled ?? true,
    });

    logger.info({ runbookId: runbook.id }, 'Runbook definition created');
    return runbook;
  }

  async get(id: string): Promise<RunbookDefinitionEntity> {
    const runbook = await this.definitionRepo.findById(id);
    if (!runbook) {
      throw new OrionError(`Runbook not found: ${id}`, 'NOT_FOUND');
    }
    return runbook;
  }

  async list(options?: { category?: string; enabled?: boolean }): Promise<RunbookDefinitionEntity[]> {
    const tenantId = getCurrentTenantId();
    if (options?.category) {
      return this.definitionRepo.findByCategory(tenantId, options.category);
    }
    if (options?.enabled) {
      return this.definitionRepo.findEnabled(tenantId);
    }
    const result = await this.definitionRepo.findByTenant(tenantId);
    return result.entities;
  }

  async update(id: string, input: UpdateRunbookInput): Promise<RunbookDefinitionEntity> {
    const existing = await this.definitionRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Runbook not found: ${id}`, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.steps !== undefined) updateData.steps = JSON.stringify(input.steps);
    if (input.variables !== undefined) updateData.variables = JSON.stringify(input.variables);
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const updated = await this.definitionRepo.update(id, updateData);
    logger.info({ runbookId: id }, 'Runbook definition updated');
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.definitionRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Runbook not found: ${id}`, 'NOT_FOUND');
    }
    await this.executionRepo.delete(id);
    await this.definitionRepo.delete(id);
    logger.info({ runbookId: id }, 'Runbook definition deleted');
  }

  // ==================== Execution ====================

  async execute(input: ExecuteRunbookInput): Promise<RunbookExecutionEntity> {
    const tenantId = getCurrentTenantId();
    const runbook = await this.definitionRepo.findById(input.runbookId);
    if (!runbook) {
      throw new OrionError(`Runbook not found: ${input.runbookId}`, 'NOT_FOUND');
    }
    if (!runbook.enabled) {
      throw new OrionError(`Runbook is disabled: ${input.runbookId}`, 'VALIDATION_ERROR');
    }

    const stepResults = runbook.steps.map((step) => ({
      stepId: step.id,
      status: 'pending' as const,
      output: null,
      startedAt: null,
      completedAt: null,
      error: null,
    }));

    const execution = await this.executionRepo.create({
      tenantId,
      runbookId: input.runbookId,
      status: 'pending',
      triggeredBy: input.triggeredBy,
      context: JSON.stringify(input.context ?? {}),
      currentStepIndex: 0,
      stepResults: JSON.stringify(stepResults),
      startedAt: new Date(),
      completedAt: null,
    });

    logger.info({ executionId: execution.id, runbookId: input.runbookId }, 'Runbook execution created');
    return execution;
  }

  async getExecution(executionId: string): Promise<RunbookExecutionEntity> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw new OrionError(`Runbook execution not found: ${executionId}`, 'NOT_FOUND');
    }
    return execution;
  }

  async getExecutionHistory(runbookId: string, limit: number = 20): Promise<RunbookExecutionEntity[]> {
    return this.executionRepo.findByRunbookId(runbookId, limit);
  }

  async updateExecutionStep(
    executionId: string,
    stepIndex: number,
    status: RunbookExecutionEntity['stepResults'][number]['status'],
    output?: string,
    error?: string,
  ): Promise<RunbookExecutionEntity> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw new OrionError(`Runbook execution not found: ${executionId}`, 'NOT_FOUND');
    }

    const stepResults = [...execution.stepResults];
    if (stepIndex >= 0 && stepIndex < stepResults.length) {
      stepResults[stepIndex] = {
        ...stepResults[stepIndex],
        status,
        output: output ?? stepResults[stepIndex].output,
        error: error ?? stepResults[stepIndex].error,
        startedAt: status === 'running' ? new Date() : stepResults[stepIndex].startedAt,
        completedAt: (status === 'completed' || status === 'failed' || status === 'skipped') ? new Date() : stepResults[stepIndex].completedAt,
      };
    }

    const nextIndex = status === 'completed' ? stepIndex + 1 : stepIndex;
    const allDone = nextIndex >= stepResults.length;
    const hasFailure = stepResults.some((s) => s.status === 'failed');
    const executionStatus = allDone ? (hasFailure ? 'failed' : 'completed') : 'running';

    return this.executionRepo.updateStatus(executionId, executionStatus, {
      currentStepIndex: nextIndex,
      stepResults,
    });
  }

  async cancelExecution(executionId: string): Promise<RunbookExecutionEntity> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw new OrionError(`Runbook execution not found: ${executionId}`, 'NOT_FOUND');
    }
    if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
      throw new OrionError(`Cannot cancel execution in status: ${execution.status}`, 'VALIDATION_ERROR');
    }
    return this.executionRepo.updateStatus(executionId, 'cancelled');
  }
}
