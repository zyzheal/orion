/**
 * UnifiedTriggerService - Manages triggers across multiple modalities
 *
 * Supports webhook, chat, schedule, event, and manual triggers.
 * Evaluates trigger conditions and executes pipelines when triggered.
 */

import { DatabasePool } from '../database';
import {
  TriggerRepository,
  TriggerEventRepository,
  TriggerEntity,
  TriggerEventEntity,
} from '../../repositories/Phase3Repository';
import { OrionError, ErrorCode } from '../../../errors';

export interface TriggerConfig {
  conditions?: Record<string, any>;
  filters?: Record<string, any>;
  schedule?: string; // cron expression for schedule triggers
  chatCommands?: string[]; // commands for chat triggers
  webhookPath?: string; // path for webhook triggers
  eventTypes?: string[]; // event types to listen for
  [key: string]: any;
}

export interface TriggerInput {
  name: string;
  type: string; // webhook, chat, schedule, event, manual
  config?: TriggerConfig;
  conditionExpression?: string;
  pipelineId?: string;
  createdBy?: string;
}

export interface TriggerEvaluationResult {
  matched: boolean;
  trigger: TriggerEntity;
  event: TriggerEventEntity;
  reason?: string;
}

export interface TriggerStats {
  totalTriggers: number;
  triggersByType: Record<string, number>;
  totalEvents: number;
  matchedEvents: number;
  pipelineRuns: number;
  topTriggers: Array<{ name: string; count: number }>;
}

export class UnifiedTriggerService {
  private triggerRepo: TriggerRepository | null = null;
  private eventRepo: TriggerEventRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.triggerRepo = new TriggerRepository(db);
      this.eventRepo = new TriggerEventRepository(db);
    }
  }

  // ==================== Trigger CRUD ====================

  async registerTrigger(tenantId: string, type: string, config: TriggerInput): Promise<TriggerEntity> {
    if (!this.triggerRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    const validTypes = ['webhook', 'chat', 'schedule', 'event', 'manual'];
    if (!validTypes.includes(type)) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Invalid trigger type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }

    const id = `trigger-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const entity = await this.triggerRepo.create({
      id,
      tenant_id: tenantId,
      name: config.name,
      type,
      config: config.config || {},
      condition_expression: config.conditionExpression || null,
      pipeline_id: config.pipelineId || null,
      enabled: true,
      trigger_count: 0,
      last_triggered_at: null,
      created_by: config.createdBy || null,
    });

    return entity;
  }

  async getTrigger(triggerId: string): Promise<TriggerEntity | undefined> {
    if (!this.triggerRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');
    return this.triggerRepo.findById(triggerId);
  }

  async listTriggers(tenantId: string, type?: string): Promise<TriggerEntity[]> {
    if (!this.triggerRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    if (type) {
      return this.triggerRepo.findByType(tenantId, type);
    }
    return this.triggerRepo.findByTenant(tenantId);
  }

  async updateTrigger(triggerId: string, updates: {
    name?: string;
    config?: TriggerConfig;
    conditionExpression?: string;
    pipelineId?: string;
    enabled?: boolean;
  }): Promise<TriggerEntity> {
    if (!this.triggerRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    const entity: any = {};
    if (updates.name !== undefined) entity.name = updates.name;
    if (updates.config !== undefined) entity.config = updates.config;
    if (updates.conditionExpression !== undefined) entity.condition_expression = updates.conditionExpression;
    if (updates.pipelineId !== undefined) entity.pipeline_id = updates.pipelineId;
    if (updates.enabled !== undefined) entity.enabled = updates.enabled;

    return this.triggerRepo.update(triggerId, entity);
  }

  async deleteTrigger(triggerId: string): Promise<boolean> {
    if (!this.triggerRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');
    return this.triggerRepo.delete(triggerId);
  }

  // ==================== Trigger Evaluation ====================

  async evaluateTrigger(tenantId: string, triggerId: string, event: Record<string, any>): Promise<TriggerEvaluationResult> {
    if (!this.triggerRepo || !this.eventRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    const trigger = await this.triggerRepo.findById(triggerId);
    if (!trigger) throw new OrionError(ErrorCode.NOT_FOUND, `Trigger not found: ${triggerId}`);
    if (trigger.tenant_id !== tenantId) throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Trigger does not belong to this tenant');
    if (!trigger.enabled) throw new OrionError(ErrorCode.NOT_FOUND, `Trigger is disabled: ${triggerId}`);

    // Create event record
    const eventId = `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const eventType = event.type || event.event_type || 'unknown';

    const triggerEvent = await this.eventRepo.create({
      id: eventId,
      trigger_id: triggerId,
      tenant_id: tenantId,
      event_type: eventType,
      event_payload: event,
      evaluation_result: null,
      pipeline_run_id: null,
    });

    // Evaluate conditions
    const matched = await this.evaluateConditions(trigger, event);

    // Update event with result
    await this.eventRepo.update(eventId, {
      evaluation_result: matched ? 'matched' : 'not_matched',
    });

    // Increment trigger count if matched
    if (matched) {
      await this.triggerRepo.incrementTriggerCount(triggerId);
    }

    return {
      matched,
      trigger,
      event: {
        ...triggerEvent,
        evaluation_result: matched ? 'matched' : 'not_matched',
      },
      reason: matched ? 'Conditions matched' : 'Conditions not met',
    };
  }

  // ==================== Pipeline Execution ====================

  async executePipelineFromTrigger(tenantId: string, triggerId: string): Promise<{ success: boolean; pipelineRunId?: string; error?: string }> {
    if (!this.triggerRepo || !this.eventRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    const trigger = await this.triggerRepo.findById(triggerId);
    if (!trigger) throw new OrionError(ErrorCode.NOT_FOUND, `Trigger not found: ${triggerId}`);
    if (trigger.tenant_id !== tenantId) throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Trigger does not belong to this tenant');
    if (!trigger.enabled) throw new Error(`Trigger is disabled: ${triggerId}`);
    if (!trigger.pipeline_id) throw new Error(`Trigger has no associated pipeline: ${triggerId}`);

    // In production, this would call the pipeline engine to execute
    // For now, record the event and return success
    const pipelineRunId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create event record
    const eventId = `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await this.eventRepo.create({
      id: eventId,
      trigger_id: triggerId,
      tenant_id: tenantId,
      event_type: 'manual_execution',
      event_payload: { source: 'api', trigger_id: triggerId },
      evaluation_result: 'matched',
      pipeline_run_id: pipelineRunId,
    });

    // Increment trigger count
    await this.triggerRepo.incrementTriggerCount(triggerId);

    return {
      success: true,
      pipelineRunId,
    };
  }

  // ==================== Stats ====================

  async getTriggerStats(tenantId: string): Promise<TriggerStats> {
    if (!this.triggerRepo || !this.eventRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');

    const triggers = await this.triggerRepo.findByTenant(tenantId);

    const triggersByType: Record<string, number> = {};
    let totalEvents = 0;
    let matchedEvents = 0;
    let pipelineRuns = 0;
    const topTriggers: Array<{ name: string; count: number }> = [];

    for (const trigger of triggers) {
      // Count by type
      triggersByType[trigger.type] = (triggersByType[trigger.type] || 0) + 1;

      // Get event stats
      const eventCount = await this.eventRepo.countByTrigger(trigger.id);
      totalEvents += eventCount;

      if (trigger.trigger_count > 0) {
        matchedEvents += trigger.trigger_count;
      }
      if (trigger.pipeline_id) {
        pipelineRuns += trigger.trigger_count;
      }

      topTriggers.push({ name: trigger.name, count: trigger.trigger_count });
    }

    // Sort by count descending
    topTriggers.sort((a, b) => b.count - a.count);

    return {
      totalTriggers: triggers.length,
      triggersByType,
      totalEvents,
      matchedEvents,
      pipelineRuns,
      topTriggers: topTriggers.slice(0, 10),
    };
  }

  // ==================== Event History ====================

  async getTriggerEvents(triggerId: string, limit: number = 50): Promise<TriggerEventEntity[]> {
    if (!this.eventRepo) throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database not configured');
    return this.eventRepo.findByTriggerId(triggerId, limit);
  }

  // ==================== Internal Methods ====================

  private async evaluateConditions(trigger: TriggerEntity, event: Record<string, any>): Promise<boolean> {
    const config = trigger.config || {};

    // Check event type filter
    if (config.eventTypes && config.eventTypes.length > 0) {
      const eventType = event.type || event.event_type || '';
      if (!config.eventTypes.includes(eventType)) {
        return false;
      }
    }

    // Check custom conditions
    if (config.conditions) {
      const conditionsMet = this.checkConditions(config.conditions, event);
      if (!conditionsMet) return false;
    }

    // Check condition expression (simple evaluation)
    if (trigger.condition_expression) {
      try {
        const result = this.evaluateExpression(trigger.condition_expression, event);
        if (!result) return false;
      } catch {
        // If expression evaluation fails, don't match
        return false;
      }
    }

    // Check filters
    if (config.filters) {
      const filtersMet = this.checkFilters(config.filters, event);
      if (!filtersMet) return false;
    }

    return true;
  }

  private checkConditions(conditions: Record<string, any>, event: Record<string, any>): boolean {
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = this.getNestedValue(event, key);
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  private checkFilters(filters: Record<string, any>, event: Record<string, any>): boolean {
    for (const [key, filter] of Object.entries(filters)) {
      const actualValue = this.getNestedValue(event, key);

      if (typeof filter === 'object' && filter !== null) {
        if (filter.includes && Array.isArray(filter.includes)) {
          if (!filter.includes.includes(actualValue)) return false;
        }
        if (filter.excludes && Array.isArray(filter.excludes)) {
          if (filter.excludes.includes(actualValue)) return false;
        }
        if (filter.min !== undefined && actualValue < filter.min) return false;
        if (filter.max !== undefined && actualValue > filter.max) return false;
        if (filter.pattern && typeof actualValue === 'string') {
          if (!new RegExp(filter.pattern).test(actualValue)) return false;
        }
      } else if (actualValue !== filter) {
        return false;
      }
    }
    return true;
  }

  private evaluateExpression(expression: string, event: Record<string, any>): boolean {
    // Simple expression evaluator (supports basic comparisons)
    // In production, use a proper expression parser
    const trimmed = expression.trim();

    // Handle logical operators
    if (trimmed.includes(' && ')) {
      const parts = trimmed.split(' && ');
      return parts.every(part => this.evaluateExpression(part, event));
    }
    if (trimmed.includes(' || ')) {
      const parts = trimmed.split(' || ');
      return parts.some(part => this.evaluateExpression(part, event));
    }

    // Handle comparisons
    const operators = ['===', '!==', '==', '!=', '>=', '<=', '>', '<'];
    for (const op of operators) {
      const idx = trimmed.indexOf(op);
      if (idx > -1) {
        const left = trimmed.substring(0, idx).trim();
        const right = trimmed.substring(idx + op.length).trim();

        const leftVal = this.resolveValue(left, event);
        const rightVal = this.resolveValue(right, event);

        switch (op) {
          case '===': return leftVal === rightVal;
          case '!==': return leftVal !== rightVal;
          case '==': return leftVal == rightVal;
          case '!=': return leftVal != rightVal;
          case '>=': return leftVal >= rightVal;
          case '<=': return leftVal <= rightVal;
          case '>': return leftVal > rightVal;
          case '<': return leftVal < rightVal;
        }
      }
    }

    // Handle boolean values
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Handle variable reference
    const val = this.resolveValue(trimmed, event);
    return !!val;
  }

  private resolveValue(expr: string, event: Record<string, any>): any {
    // Handle string literals
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }

    // Handle numbers
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return parseFloat(expr);
    }

    // Handle variable references (event.field or just field)
    if (expr.startsWith('event.')) {
      return this.getNestedValue(event, expr.substring(6));
    }

    return this.getNestedValue(event, expr);
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }
}
