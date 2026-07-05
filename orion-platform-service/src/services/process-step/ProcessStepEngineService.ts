import { ProcessDefinitionRepository, ProcessDefinition, CreateProcessDefinitionInput, UpdateProcessDefinitionInput } from './ProcessDefinitionRepository';
import { ProcessInstanceRepository, ProcessInstance, ProcessStepInstance, CreateProcessInstanceInput } from './ProcessInstanceRepository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import { createLogger } from '../../utils/logger';
import { randomUUID } from 'crypto';

const logger = createLogger('ProcessStepEngineService');

/** 12-step state machine: valid transitions */
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:    ['pending', 'aborted'],
  pending:  ['running', 'rejected'],
  running:  ['success', 'failed', 'paused', 'wait', 'retry'],
  success:  ['close'],
  failed:   ['retry', 'close'],
  paused:   ['running', 'aborted'],
  aborted:  ['close'],
  wait:     ['running'],
  retry:    ['running', 'failed'],
  rejected: ['pending', 'close'],
  skip:     [],       // terminal
  close:    [],       // terminal
};

export class ProcessStepEngineService {
  constructor(
    private defRepo: ProcessDefinitionRepository,
    private instRepo: ProcessInstanceRepository
  ) {}

  // ---- Definition CRUD ----

  async listDefinitions(options?: { entityType?: string; enabled?: boolean; limit?: number; offset?: number }): Promise<{ rows: ProcessDefinition[]; total: number }> {
    return this.defRepo.findAll(options);
  }

  async getDefinition(id: string): Promise<ProcessDefinition> {
    const def = await this.defRepo.findById(id);
    if (!def) throw new OrionError(`Process definition not found: ${id}`, 'NOT_FOUND');
    return def;
  }

  async createDefinition(input: CreateProcessDefinitionInput, userId?: string): Promise<ProcessDefinition> {
    return this.defRepo.create({ ...input, created_by: userId });
  }

  async updateDefinition(id: string, input: UpdateProcessDefinitionInput): Promise<ProcessDefinition> {
    const existing = await this.defRepo.findById(id);
    if (!existing) throw new OrionError(`Process definition not found: ${id}`, 'NOT_FOUND');
    const updated = await this.defRepo.update(id, input);
    return updated!;
  }

  async deleteDefinition(id: string): Promise<boolean> {
    const existing = await this.defRepo.findById(id);
    if (!existing) throw new OrionError(`Process definition not found: ${id}`, 'NOT_FOUND');
    // Check for running instances
    const { total } = await this.instRepo.findInstances({ definitionId: id, status: 'running' });
    if (total > 0) {
      throw new OrionError('Cannot delete definition with running instances', 'CONFLICT');
    }
    return this.defRepo.delete(id);
  }

  // ---- Instance Management ----

  async listInstances(options?: { definitionId?: string; entityType?: string; entityId?: string; status?: string; limit?: number; offset?: number }): Promise<{ rows: ProcessInstance[]; total: number }> {
    return this.instRepo.findInstances(options);
  }

  async getInstance(id: string): Promise<ProcessInstance> {
    const inst = await this.instRepo.findInstanceById(id);
    if (!inst) throw new OrionError(`Process instance not found: ${id}`, 'NOT_FOUND');
    return inst;
  }

  /**
   * Start a new process instance from a definition.
   * Creates the instance with a snapshot of the definition and the first step.
   */
  async startInstance(definitionId: string, params: {
    entityType: string;
    entityId: string;
    operator?: string;
    data?: Record<string, unknown>;
  }): Promise<ProcessInstance> {
    const definition = await this.defRepo.findById(definitionId);
    if (!definition) throw new OrionError(`Process definition not found: ${definitionId}`, 'NOT_FOUND');
    if (!definition.enabled) throw new OrionError('Process definition is disabled', 'FORBIDDEN');

    const tenantId = getCurrentTenantId();

    // Create instance with definition snapshot
    const instance = await this.instRepo.createInstance({
      definition_id: definitionId,
      definition_snapshot: {
        steps: definition.steps,
        transitions: definition.transitions,
        name: definition.name,
        entity_type: definition.entity_type,
      },
      entity_type: params.entityType,
      entity_id: params.entityId,
      status: 'running',
      created_by: params.operator,
    });

    // Create the first step instance from definition
    const steps = definition.steps as Array<Record<string, unknown>>;
    if (steps.length > 0) {
      const firstStep = steps[0];
      const stepInstance = await this.instRepo.createStep({
        instance_id: instance.id,
        step_id: firstStep.id as string,
        step_name: (firstStep.name as string) || 'Step 1',
        step_type: (firstStep.type as string) || 'auto',
        handler_key: firstStep.handler as string,
        status: 'pending',
        input_data: params.data,
      });

      // Update instance current step
      await this.instRepo.updateInstance(instance.id, { current_step_id: firstStep.id as string });
    }

    logger.info({ tenantId, instanceId: instance.id, definitionId, entityType: params.entityType }, '[ProcessStepEngine] Instance started');

    return this.instRepo.findInstanceById(instance.id) as Promise<ProcessInstance>;
  }

  /**
   * Advance a step instance to its next state.
   * Validates state transition before applying.
   */
  async advanceStep(instanceId: string, stepId: string, action: string, params: {
    operator?: string;
    comment?: string;
    data?: Record<string, unknown>;
  }): Promise<ProcessStepInstance> {
    const instance = await this.instRepo.findInstanceById(instanceId);
    if (!instance) throw new OrionError(`Process instance not found: ${instanceId}`, 'NOT_FOUND');

    const step = await this.instRepo.findStepByInstanceIdAndStepId(instanceId, stepId);
    if (!step) throw new OrionError(`Step not found: ${stepId} in instance ${instanceId}`, 'NOT_FOUND');

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[step.status] || [];
    if (!allowedTransitions.includes(action)) {
      throw new OrionError(
        `Invalid transition: cannot go from '${step.status}' to '${action}'`,
        'VALIDATION_ERROR'
      );
    }

    // Determine next state based on action
    const nextState = action;

    // Update step
    const updatedStep = await this.instRepo.updateStep(step.id, {
      status: nextState,
      output_data: params.data,
      completed_at: ['success', 'failed', 'close', 'skip', 'aborted', 'rejected'].includes(nextState) ? new Date() : undefined,
      started_at: step.started_at || (nextState === 'running' ? new Date() : undefined),
      operator: params.operator,
      comment: params.comment,
    });

    // If step completed successfully, try to advance to next step
    if (nextState === 'success') {
      await this.advanceToNextStep(instance, stepId);
    } else if (nextState === 'failed' || nextState === 'aborted') {
      await this.instRepo.updateInstance(instanceId, { status: nextState === 'failed' ? 'aborted' : 'aborted' });
    }

    logger.info({ instanceId, stepId, from: step.status, to: nextState, operator: params.operator }, '[ProcessStepEngine] Step advanced');

    return updatedStep!;
  }

  /**
   * Get step history for an instance
   */
  async getStepHistory(instanceId: string): Promise<ProcessStepInstance[]> {
    return this.instRepo.findStepsByInstanceId(instanceId);
  }

  /**
   * Internal: advance to the next step in the definition sequence
   */
  private async advanceToNextStep(instance: ProcessInstance, currentStepId: string): Promise<void> {
    const snapshot = instance.definition_snapshot as Record<string, unknown>;
    const steps = snapshot.steps as Array<Record<string, unknown>>;
    const currentIndex = steps.findIndex(s => s.id === currentStepId);

    if (currentIndex < 0 || currentIndex >= steps.length - 1) {
      // No more steps - complete the instance
      await this.instRepo.updateInstance(instance.id, {
        status: 'completed',
        completed_at: new Date(),
      });
      logger.info({ instanceId: instance.id }, '[ProcessStepEngine] Instance completed');
      return;
    }

    const nextStep = steps[currentIndex + 1];
    await this.instRepo.createStep({
      instance_id: instance.id,
      step_id: nextStep.id as string,
      step_name: (nextStep.name as string) || `Step ${currentIndex + 2}`,
      step_type: (nextStep.type as string) || 'auto',
      handler_key: nextStep.handler as string,
      status: 'pending',
    });

    await this.instRepo.updateInstance(instance.id, { current_step_id: nextStep.id as string });
  }
}
