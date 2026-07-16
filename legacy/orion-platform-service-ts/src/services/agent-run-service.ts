/**
 * AgentRunService - Business logic layer for Agent Run management
 *
 * Handles triggering agent runs, executing steps, tracking decisions,
 * and managing run lifecycle (cancel, retry).
 *
 * PostgreSQL Repository pattern:
 * - AgentRunRepository handles all database operations
 * - AgentProfileService validates agent profiles
 * - EventBusService publishes run events (optional)
 */

import {
  AgentRunRepository,
  AgentRunEntity,
} from '../repositories/AgentRunRepository';
import {
  AgentRun,
  AgentRunStatus,
  AgentAction,
  AgentDecision,
  createAgentRun,
  addDecision,
  completeDecision,
  failDecision,
  completeRun,
  failRun,
  cancelRun,
} from '../models/AgentRun';
import { AgentProfileService } from './agent-profile-service';
import { EventBusService } from './event-bus-service';
import { createLogger } from '../utils/logger';

const logger = createLogger('agent-run-service');

// ==================== Interfaces ====================

export interface AgentRunCreateInput {
  agentProfileId: string;
  triggerPayload?: Record<string, unknown>;
  totalSteps?: number;
  timeoutSec?: number;
  tenantId?: string;
}

export interface AgentRunListOptions {
  agentProfileId?: string;
  statusFilter?: AgentRunStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedAgentRunResult {
  data: AgentRun[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AgentRunStepInput {
  action: AgentAction;
  actionInput: Record<string, unknown>;
  agentId?: string;
}

export interface AgentRunStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  waitingApproval: number;
}

export class AgentRunServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AgentRunServiceError';
  }
}

// ==================== Entity to Domain Mapping ====================

/**
 * Convert repository AgentRunEntity to domain AgentRun.
 * Note: decisions are loaded separately via getDecisionsByRunId.
 */
function entityToDomain(entity: AgentRunEntity, decisions: AgentDecision[] = []): AgentRun {
  return {
    id: entity.id,
    agentProfileId: entity.agent_profile_id,
    agentProfileName: '', // Filled in by caller if needed
    triggerPayload: entity.trigger_payload || {},
    status: entity.status as AgentRunStatus,
    currentStep: entity.current_step ?? 0,
    totalSteps: entity.total_steps,
    result: entity.result || undefined,
    error: entity.error || undefined,
    startedAt: entity.started_at,
    completedAt: entity.completed_at || undefined,
    timeoutAt: entity.timeout_at,
    decisions,
    tenantId: entity.tenant_id || undefined,
  };
}

/**
 * Convert repository decision row to domain AgentDecision.
 */
function rowToDecision(row: {
  id: string;
  run_id: string;
  agent_id: string;
  step_number: number;
  action: string;
  action_input: Record<string, unknown>;
  action_output: Record<string, unknown> | null;
  reasoning: string;
  tool_result: Record<string, unknown> | null;
  error: string | null;
  created_at: Date;
}): AgentDecision {
  return {
    id: row.id,
    runId: row.run_id,
    agentId: row.agent_id,
    stepNumber: row.step_number,
    action: row.action as AgentAction,
    actionInput: row.action_input || {},
    actionOutput: row.action_output || undefined,
    reasoning: row.reasoning,
    toolResult: row.tool_result || undefined,
    error: row.error || undefined,
    createdAt: row.created_at,
  };
}

// ==================== Service ====================

export interface AgentRunServiceDependencies {
  agentProfileService: AgentProfileService;
  runRepository: AgentRunRepository;
  eventBus?: EventBusService;
}

export class AgentRunService {
  private agentProfileService: AgentProfileService;
  private runRepository: AgentRunRepository;
  private eventBus?: EventBusService;

  constructor(dependencies: AgentRunServiceDependencies) {
    this.agentProfileService = dependencies.agentProfileService;
    this.runRepository = dependencies.runRepository;
    this.eventBus = dependencies.eventBus;
  }

  /**
   * Trigger a new agent run.
   *
   * Validates the agent profile exists and is enabled,
   * then creates a new run record in the database.
   */
  async triggerRun(input: AgentRunCreateInput): Promise<AgentRun> {
    // Validate agent profile exists and is enabled
    let profileName = '';
    try {
      const profile = await this.agentProfileService.getById(input.agentProfileId);
      profileName = profile.name;
      if (!profile.enabled) {
        throw new AgentRunServiceError(
          `Agent profile "${input.agentProfileId}" is disabled`,
          'PROFILE_DISABLED',
        );
      }
    } catch (err) {
      if (err instanceof AgentRunServiceError) {
        throw err;
      }
      throw new AgentRunServiceError(
        `Agent profile not found: ${input.agentProfileId}`,
        'PROFILE_NOT_FOUND',
      );
    }

    // Calculate timeout
    const now = new Date();
    const timeoutSec = input.timeoutSec ?? 3600;
    const timeoutAt = new Date(now.getTime() + timeoutSec * 1000);
    const totalSteps = input.totalSteps ?? 1;

    // Create run in database
    const entity = await this.runRepository.createRun(
      input.agentProfileId,
      input.triggerPayload || {},
      totalSteps,
      timeoutAt,
      input.tenantId,
    );

    // Build domain object
    const run = entityToDomain(entity);
    run.agentProfileName = profileName;

    // Publish event
    await this.publishEvent('agent.run.triggered', {
      runId: run.id,
      agentProfileId: run.agentProfileId,
      agentProfileName: profileName,
      status: run.status,
      tenantId: run.tenantId,
    });

    return run;
  }

  /**
   * Get an agent run by ID with its decision history.
   */
  async getById(id: string): Promise<AgentRun> {
    const entity = await this.runRepository.findRunById(id);
    if (!entity) {
      throw new AgentRunServiceError(`Agent run not found: ${id}`, 'RUN_NOT_FOUND');
    }

    // Load decisions for this run
    const decisionRows = await this.runRepository.getDecisionsByRunId(id);
    const decisions = decisionRows.map(rowToDecision);

    return entityToDomain(entity, decisions);
  }

  /**
   * List agent runs with optional filters.
   */
  async list(options: AgentRunListOptions = {}): Promise<AgentRun[]> {
    const entities = await this.runRepository.listRuns({
      agentProfileId: options.agentProfileId,
      statusFilter: options.statusFilter,
    });

    // Convert to domain objects (without decisions for list view)
    return entities.map(entity => entityToDomain(entity));
  }

  /**
   * List agent runs with pagination.
   */
  async listPaginated(options: AgentRunListOptions = {}): Promise<PaginatedAgentRunResult> {
    const runs = await this.list(options);
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      data: runs.slice(start, end),
      total: runs.length,
      page,
      limit,
      totalPages: Math.ceil(runs.length / limit),
    };
  }

  /**
   * Cancel a running agent run.
   *
   * Only runs with status 'running' can be cancelled.
   */
  async cancel(id: string): Promise<AgentRun> {
    const entity = await this.runRepository.findRunById(id);
    if (!entity) {
      throw new AgentRunServiceError(`Agent run not found: ${id}`, 'RUN_NOT_FOUND');
    }

    if (entity.status !== 'running') {
      throw new AgentRunServiceError(
        `Cannot cancel run with status '${entity.status}'. Only running runs can be cancelled.`,
        'INVALID_RUN_STATUS',
      );
    }

    const updatedEntity = await this.runRepository.cancelRun(id);
    if (!updatedEntity) {
      throw new AgentRunServiceError(`Failed to cancel agent run: ${id}`, 'CANCEL_FAILED');
    }

    const decisionRows = await this.runRepository.getDecisionsByRunId(id);
    const decisions = decisionRows.map(rowToDecision);
    const run = entityToDomain(updatedEntity, decisions);

    await this.publishEvent('agent.run.cancelled', {
      runId: run.id,
      agentProfileId: run.agentProfileId,
      status: run.status,
      tenantId: run.tenantId,
    });

    return run;
  }

  /**
   * Retry a failed or cancelled agent run.
   *
   * Creates a new run with the same configuration as the original.
   * Only failed or cancelled runs can be retried.
   */
  async retry(id: string): Promise<AgentRun> {
    const entity = await this.runRepository.findRunById(id);
    if (!entity) {
      throw new AgentRunServiceError(`Agent run not found: ${id}`, 'RUN_NOT_FOUND');
    }

    // Only failed or cancelled runs can be retried
    if (entity.status !== 'failed' && entity.status !== 'cancelled') {
      throw new AgentRunServiceError(
        `Cannot retry run with status '${entity.status}'. Only failed or cancelled runs can be retried.`,
        'INVALID_RUN_STATUS',
      );
    }

    // Validate agent profile is still available
    let profileName = '';
    try {
      const profile = await this.agentProfileService.getById(entity.agent_profile_id);
      profileName = profile.name;
      if (!profile.enabled) {
        throw new AgentRunServiceError(
          `Agent profile "${entity.agent_profile_id}" is disabled`,
          'PROFILE_DISABLED',
        );
      }
    } catch (err) {
      if (err instanceof AgentRunServiceError) {
        throw err;
      }
      throw new AgentRunServiceError(
        `Agent profile not found: ${entity.agent_profile_id}`,
        'PROFILE_NOT_FOUND',
      );
    }

    // Calculate new timeout
    const now = new Date();
    const timeoutAt = new Date(now.getTime() + 3600 * 1000); // Default 1 hour

    // Create new run with same configuration
    const newEntity = await this.runRepository.createRun(
      entity.agent_profile_id,
      entity.trigger_payload,
      entity.total_steps,
      timeoutAt,
      entity.tenant_id ?? undefined,
    );

    const run = entityToDomain(newEntity);
    run.agentProfileName = profileName;

    await this.publishEvent('agent.run.retried', {
      runId: run.id,
      originalRunId: id,
      agentProfileId: run.agentProfileId,
      agentProfileName: profileName,
      status: run.status,
      tenantId: run.tenantId,
    });

    return run;
  }

  /**
   * Execute a step in an agent run.
   *
   * Records the decision and action in the database.
   * The run must be in 'running' status.
   */
  async executeStep(
    runId: string,
    action: AgentAction,
    actionInput: Record<string, unknown>,
    agentId?: string,
  ): Promise<AgentDecision> {
    const entity = await this.runRepository.findRunById(runId);
    if (!entity) {
      throw new AgentRunServiceError(`Agent run not found: ${runId}`, 'RUN_NOT_FOUND');
    }

    if (entity.status !== 'running') {
      throw new AgentRunServiceError(
        `Cannot execute step on run with status '${entity.status}'. Only running runs can execute steps.`,
        'INVALID_RUN_STATUS',
      );
    }

    const stepNumber = (entity.current_step ?? 0) + 1;
    const resolvedAgentId = agentId || entity.agent_profile_id;

    // Create decision record
    const decisionResult = await this.runRepository.createDecision(
      runId,
      resolvedAgentId,
      stepNumber,
      action,
      actionInput,
      `Executing ${action} at step ${stepNumber}`,
    );

    // Update current step
    await this.runRepository.updateStep(runId, stepNumber);

    // Build domain decision object
    const decision: AgentDecision = {
      id: decisionResult.id,
      runId,
      agentId: resolvedAgentId,
      stepNumber,
      action,
      actionInput,
      reasoning: `Executing ${action} at step ${stepNumber}`,
      createdAt: new Date(),
    };

    await this.publishEvent('agent.step.executed', {
      runId,
      decisionId: decision.id,
      stepNumber,
      action,
      agentId: resolvedAgentId,
      tenantId: entity.tenant_id,
    });

    return decision;
  }

  /**
   * Complete a decision with result.
   */
  async completeStep(
    decisionId: string,
    toolResult: Record<string, unknown>,
    actionOutput?: Record<string, unknown>,
  ): Promise<void> {
    await this.runRepository.updateDecision(decisionId, {
      toolResult,
      actionOutput,
    });
  }

  /**
   * Mark a decision as failed.
   */
  async failStep(decisionId: string, error: string): Promise<void> {
    await this.runRepository.updateDecision(decisionId, { error });
  }

  /**
   * Mark a run as completed.
   */
  async completeRunWithResult(
    runId: string,
    result: Record<string, unknown>,
  ): Promise<AgentRun> {
    const entity = await this.runRepository.findRunById(runId);
    if (!entity) {
      throw new AgentRunServiceError(`Agent run not found: ${runId}`, 'RUN_NOT_FOUND');
    }

    const updatedEntity = await this.runRepository.completeRun(runId, result);
    if (!updatedEntity) {
      throw new AgentRunServiceError(`Failed to complete run: ${runId}`, 'COMPLETE_FAILED');
    }

    const decisionRows = await this.runRepository.getDecisionsByRunId(runId);
    const decisions = decisionRows.map(rowToDecision);
    const run = entityToDomain(updatedEntity, decisions);

    await this.publishEvent('agent.run.completed', {
      runId: run.id,
      agentProfileId: run.agentProfileId,
      status: run.status,
      totalSteps: run.totalSteps,
      completedSteps: run.currentStep,
      tenantId: run.tenantId,
    });

    return run;
  }

  /**
   * Mark a run as failed.
   */
  async failRunWithError(runId: string, error: string): Promise<AgentRun> {
    const entity = await this.runRepository.findRunById(runId);
    if (!entity) {
      throw new AgentRunServiceError(`Agent run not found: ${runId}`, 'RUN_NOT_FOUND');
    }

    const updatedEntity = await this.runRepository.failRun(runId, error);
    if (!updatedEntity) {
      throw new AgentRunServiceError(`Failed to fail run: ${runId}`, 'FAIL_FAILED');
    }

    const decisionRows = await this.runRepository.getDecisionsByRunId(runId);
    const decisions = decisionRows.map(rowToDecision);
    const run = entityToDomain(updatedEntity, decisions);

    await this.publishEvent('agent.run.failed', {
      runId: run.id,
      agentProfileId: run.agentProfileId,
      status: run.status,
      error: run.error,
      tenantId: run.tenantId,
    });

    return run;
  }

  /**
   * Get decision logs for a specific run.
   */
  async getDecisions(runId: string): Promise<AgentDecision[]> {
    const entity = await this.runRepository.findRunById(runId);
    if (!entity) {
      throw new AgentRunServiceError(`Agent run not found: ${runId}`, 'RUN_NOT_FOUND');
    }

    const decisionRows = await this.runRepository.getDecisionsByRunId(runId);
    return decisionRows.map(rowToDecision);
  }

  /**
   * Get run statistics.
   */
  async getStats(): Promise<AgentRunStats> {
    const allRuns = await this.runRepository.listRuns();

    const stats: AgentRunStats = {
      total: allRuns.length,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      waitingApproval: 0,
    };

    for (const run of allRuns) {
      switch (run.status) {
        case 'running':
          stats.running++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
        case 'waiting_approval':
          stats.waitingApproval++;
          break;
      }
    }

    return stats;
  }

  /**
   * Get runs by tenant ID.
   */
  async getByTenant(tenantId: string): Promise<AgentRun[]> {
    const allRuns = await this.runRepository.listRuns();
    const tenantRuns = allRuns.filter(
      entity => entity.tenant_id === tenantId,
    );
    return tenantRuns.map(entity => entityToDomain(entity));
  }

  /**
   * Get running runs (active runs that haven't completed).
   */
  async getActiveRuns(): Promise<AgentRun[]> {
    const runs = await this.runRepository.listRuns({ statusFilter: 'running' });
    return runs.map(entity => entityToDomain(entity));
  }

  /**
   * Check for timed out runs and mark them as failed.
   *
   * Should be called periodically by a background job.
   */
  async checkTimeouts(): Promise<string[]> {
    const activeRuns = await this.getActiveRuns();
    const now = new Date();
    const timedOutIds: string[] = [];

    for (const run of activeRuns) {
      if (run.timeoutAt && new Date(run.timeoutAt) < now) {
        try {
          await this.failRunWithError(run.id, 'Run timed out');
          timedOutIds.push(run.id);
        } catch (err) {
          logger.error(`Failed to mark run ${run.id} as timed out:`, err);
        }
      }
    }

    return timedOutIds;
  }

  /**
   * Publish event to event bus (if available).
   * Silently ignores errors to avoid disrupting the main flow.
   */
  private async publishEvent(type: string, data: Record<string, unknown>): Promise<void> {
    if (!this.eventBus) {
      return;
    }
    try {
      await this.eventBus.publish(type, data);
    } catch (err) {
      // Silently ignore event publishing errors to avoid disrupting the main flow
      logger.warn(`[AgentRunService] Failed to publish event ${type}:`, err);
    }
  }
}

export default AgentRunService;
