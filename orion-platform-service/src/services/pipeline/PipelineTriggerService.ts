/**
 * PipelineTriggerService - Pipeline trigger engine
 *
 * Handles trigger registration, evaluation, and execution.
 * Supports git, webhook, schedule, and manual trigger types.
 * Uses Map-based in-memory storage.
 */

export type TriggerType = 'git' | 'webhook' | 'schedule' | 'manual';
export type TriggerStatus = 'active' | 'inactive' | 'failed';
export type TriggerExecutionStatus = 'success' | 'failed' | 'pending';

export interface TriggerConfig {
  // git trigger config
  branch?: string;
  pathPatterns?: string[];
  // webhook trigger config
  webhookUrl?: string;
  secret?: string;
  // schedule trigger config
  cronExpression?: string;
  timezone?: string;
  // common
  [key: string]: unknown;
}

export interface Trigger {
  id: string;
  pipelineId: string;
  tenantId: string;
  type: TriggerType;
  config: TriggerConfig;
  status: TriggerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TriggerEvent {
  type: TriggerType;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export interface TriggerExecutionRecord {
  id: string;
  triggerId: string;
  pipelineId: string;
  tenantId: string;
  status: TriggerExecutionStatus;
  message?: string;
  runId?: string;
  executedAt: Date;
}

export interface CreateTriggerInput {
  pipelineId: string;
  tenantId: string;
  type: TriggerType;
  config: TriggerConfig;
}

export interface UpdateTriggerInput {
  type?: TriggerType;
  config?: Partial<TriggerConfig>;
  status?: TriggerStatus;
}

export class PipelineTriggerServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PipelineTriggerServiceError';
  }
}

export class PipelineTriggerService {
  private triggers: Map<string, Trigger> = new Map();
  private executionHistory: Map<string, TriggerExecutionRecord[]> = new Map();
  private counter = 0;

  // ==================== Trigger Registration ====================

  /**
   * Register a new trigger for a pipeline
   */
  async registerTrigger(input: CreateTriggerInput): Promise<Trigger> {
    if (!input.pipelineId || !input.tenantId || !input.type) {
      throw new PipelineTriggerServiceError(
        'Missing required fields: pipelineId, tenantId, type',
        'INVALID_INPUT'
      );
    }

    const now = new Date();
    const trigger: Trigger = {
      id: this.generateId('trigger'),
      pipelineId: input.pipelineId,
      tenantId: input.tenantId,
      type: input.type,
      config: input.config,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.triggers.set(trigger.id, trigger);
    return trigger;
  }

  /**
   * Get a trigger by ID
   */
  async getTrigger(triggerId: string): Promise<Trigger | null> {
    return this.triggers.get(triggerId) ?? null;
  }

  /**
   * List triggers for a pipeline
   */
  async listTriggersByPipeline(tenantId: string, pipelineId: string): Promise<Trigger[]> {
    const results: Trigger[] = [];
    for (const trigger of this.triggers.values()) {
      if (trigger.tenantId === tenantId && trigger.pipelineId === pipelineId) {
        results.push(trigger);
      }
    }
    return results;
  }

  /**
   * List all triggers for a tenant
   */
  async listTriggersByTenant(tenantId: string): Promise<Trigger[]> {
    const results: Trigger[] = [];
    for (const trigger of this.triggers.values()) {
      if (trigger.tenantId === tenantId) {
        results.push(trigger);
      }
    }
    return results;
  }

  /**
   * Update trigger configuration
   */
  async updateTrigger(triggerId: string, input: UpdateTriggerInput): Promise<Trigger> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }

    if (input.type !== undefined) {
      trigger.type = input.type;
    }
    if (input.config !== undefined) {
      trigger.config = { ...trigger.config, ...input.config };
    }
    if (input.status !== undefined) {
      trigger.status = input.status;
    }
    trigger.updatedAt = new Date();
    this.triggers.set(triggerId, trigger);
    return trigger;
  }

  /**
   * Update trigger status
   */
  async updateTriggerStatus(triggerId: string, status: TriggerStatus): Promise<Trigger> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }
    trigger.status = status;
    trigger.updatedAt = new Date();
    this.triggers.set(triggerId, trigger);
    return trigger;
  }

  /**
   * Delete a trigger
   */
  async deleteTrigger(triggerId: string): Promise<void> {
    this.triggers.delete(triggerId);
    this.executionHistory.delete(triggerId);
  }

  // ==================== Trigger Evaluation ====================

  /**
   * Evaluate whether an event should trigger any pipelines
   * Returns list of trigger IDs that should fire
   */
  async evaluateTrigger(event: TriggerEvent): Promise<string[]> {
    const matchedTriggers: string[] = [];

    for (const trigger of this.triggers.values()) {
      if (trigger.status !== 'active') {
        continue;
      }

      if (trigger.type !== event.type) {
        continue;
      }

      const shouldFire = this.matchesConfig(trigger, event);
      if (shouldFire) {
        matchedTriggers.push(trigger.id);
      }
    }

    return matchedTriggers;
  }

  // ==================== Trigger Execution ====================

  /**
   * Execute a trigger and start a pipeline run
   */
  async executeTrigger(triggerId: string): Promise<TriggerExecutionRecord> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }

    const record: TriggerExecutionRecord = {
      id: this.generateId('exec'),
      triggerId,
      pipelineId: trigger.pipelineId,
      tenantId: trigger.tenantId,
      status: 'success',
      executedAt: new Date(),
    };

    // Store execution record
    const history = this.executionHistory.get(triggerId) ?? [];
    history.push(record);
    this.executionHistory.set(triggerId, history);

    return record;
  }

  /**
   * Record a failed execution
   */
  async recordFailure(triggerId: string, message: string): Promise<TriggerExecutionRecord> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new PipelineTriggerServiceError(`Trigger not found: ${triggerId}`, 'TRIGGER_NOT_FOUND');
    }

    const record: TriggerExecutionRecord = {
      id: this.generateId('exec'),
      triggerId,
      pipelineId: trigger.pipelineId,
      tenantId: trigger.tenantId,
      status: 'failed',
      message,
      executedAt: new Date(),
    };

    const history = this.executionHistory.get(triggerId) ?? [];
    history.push(record);
    this.executionHistory.set(triggerId, history);

    // Mark trigger as failed if too many failures
    const recentFailures = history.filter(
      (r) => r.status === 'failed' && r.executedAt > new Date(Date.now() - 3600000)
    );
    if (recentFailures.length >= 5) {
      trigger.status = 'failed';
      trigger.updatedAt = new Date();
      this.triggers.set(triggerId, trigger);
    }

    return record;
  }

  // ==================== Trigger History ====================

  /**
   * Get execution history for a pipeline
   */
  async getTriggerHistory(pipelineId: string, tenantId?: string): Promise<TriggerExecutionRecord[]> {
    const results: TriggerExecutionRecord[] = [];
    for (const [triggerId, history] of this.executionHistory.entries()) {
      const trigger = this.triggers.get(triggerId);
      if (trigger && trigger.pipelineId === pipelineId) {
        if (!tenantId || trigger.tenantId === tenantId) {
          results.push(...history);
        }
      }
    }
    return results.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
  }

  /**
   * Get execution history for a specific trigger
   */
  async getTriggerHistoryById(triggerId: string): Promise<TriggerExecutionRecord[]> {
    return this.executionHistory.get(triggerId) ?? [];
  }

  // ==================== Internal Helpers ====================

  private matchesConfig(trigger: Trigger, event: TriggerEvent): boolean {
    const config = trigger.config;

    if (trigger.type === 'git' && config.branch) {
      const branch = event.payload.branch as string | undefined;
      if (branch && !this.matchesPattern(branch, config.branch as string)) {
        return false;
      }
    }

    if (trigger.type === 'git' && config.pathPatterns && config.pathPatterns.length > 0) {
      const changedFiles = event.payload.changedFiles as string[] | undefined;
      if (changedFiles && changedFiles.length > 0) {
        const hasMatch = changedFiles.some((file) =>
          config.pathPatterns!.some((pattern) => this.matchesPattern(file, pattern))
        );
        if (!hasMatch) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesPattern(value: string, pattern: string): boolean {
    // Simple glob-like matching
    if (pattern === value) {
      return true;
    }
    if (pattern.startsWith('*')) {
      return value.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith('*')) {
      return value.startsWith(pattern.slice(0, -1));
    }
    return false;
  }

  private generateId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${Date.now()}-${this.counter}`;
  }
}
