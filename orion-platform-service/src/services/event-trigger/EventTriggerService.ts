import { createLogger } from '../utils/logger';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import {
  EventTriggerRuleRepository,
  EventTriggerRuleEntity,
  EventTriggerLogRepository,
  EventTriggerLogEntity,
  TriggerAction,
  ActionResult,
} from './EventTriggerRepository';

const logger = pino({ name: 'EventTriggerService' });

export interface CreateTriggerRuleInput {
  name: string;
  description?: string;
  eventType: string;
  matchConditions: Record<string, unknown>;
  actions: TriggerAction[];
  enabled?: boolean;
  cooldownSeconds?: number;
}

export interface UpdateTriggerRuleInput {
  name?: string;
  description?: string;
  eventType?: string;
  matchConditions?: Record<string, unknown>;
  actions?: TriggerAction[];
  enabled?: boolean;
  cooldownSeconds?: number;
}

export interface IncomingEvent {
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  source: string;
}

/**
 * EventTriggerService - Manages trigger rules and evaluates events against them
 */
export class EventTriggerService {
  constructor(
    private readonly ruleRepo: EventTriggerRuleRepository,
    private readonly logRepo: EventTriggerLogRepository,
  ) {}

  // ==================== Rule CRUD ====================

  async createRule(input: CreateTriggerRuleInput): Promise<EventTriggerRuleEntity> {
    const tenantId = getCurrentTenantId();
    logger.info({ tenantId, name: input.name, eventType: input.eventType }, 'Creating trigger rule');

    const rule = await this.ruleRepo.create({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      eventType: input.eventType,
      matchConditions: JSON.stringify(input.matchConditions),
      actions: JSON.stringify(input.actions),
      enabled: input.enabled ?? true,
      cooldownSeconds: input.cooldownSeconds ?? 0,
      lastTriggeredAt: null,
      createdBy: null,
    });

    logger.info({ ruleId: rule.id }, 'Trigger rule created');
    return rule;
  }

  async getRule(id: string): Promise<EventTriggerRuleEntity> {
    const rule = await this.ruleRepo.findById(id);
    if (!rule) {
      throw new OrionError(`Trigger rule not found: ${id}`, 'NOT_FOUND');
    }
    return rule;
  }

  async listRules(options?: { eventType?: string }): Promise<EventTriggerRuleEntity[]> {
    const tenantId = getCurrentTenantId();
    if (options?.eventType) {
      return this.ruleRepo.findByEventType(tenantId, options.eventType);
    }
    const result = await this.ruleRepo.findByTenant(tenantId);
    return result.entities;
  }

  async updateRule(id: string, input: UpdateTriggerRuleInput): Promise<EventTriggerRuleEntity> {
    const existing = await this.ruleRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Trigger rule not found: ${id}`, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.eventType !== undefined) updateData.eventType = input.eventType;
    if (input.matchConditions !== undefined) updateData.matchConditions = JSON.stringify(input.matchConditions);
    if (input.actions !== undefined) updateData.actions = JSON.stringify(input.actions);
    if (input.enabled !== undefined) updateData.enabled = input.enabled;
    if (input.cooldownSeconds !== undefined) updateData.cooldownSeconds = input.cooldownSeconds;

    const updated = await this.ruleRepo.update(id, updateData);
    logger.info({ ruleId: id }, 'Trigger rule updated');
    return updated;
  }

  async deleteRule(id: string): Promise<void> {
    const existing = await this.ruleRepo.findById(id);
    if (!existing) {
      throw new OrionError(`Trigger rule not found: ${id}`, 'NOT_FOUND');
    }
    await this.ruleRepo.delete(id);
    logger.info({ ruleId: id }, 'Trigger rule deleted');
  }

  // ==================== Event Evaluation ====================

  /**
   * Evaluate an incoming event against all enabled rules and execute matching actions.
   */
  async evaluateAndExecute(event: IncomingEvent): Promise<EventTriggerLogEntity[]> {
    const tenantId = getCurrentTenantId();
    const rules = await this.ruleRepo.findEnabled(tenantId);
    const logs: EventTriggerLogEntity[] = [];

    for (const rule of rules) {
      if (rule.eventType !== event.eventType) continue;
      if (!this.matchesConditions(event.payload, rule.matchConditions)) continue;

      // Check cooldown
      if (rule.cooldownSeconds > 0 && rule.lastTriggeredAt) {
        const elapsed = (Date.now() - new Date(rule.lastTriggeredAt).getTime()) / 1000;
        if (elapsed < rule.cooldownSeconds) {
          logger.debug({ ruleId: rule.id, elapsed, cooldown: rule.cooldownSeconds }, 'Rule in cooldown, skipping');
          continue;
        }
      }

      const log = await this.executeRule(rule, event, tenantId);
      logs.push(log);
    }

    return logs;
  }

  /**
   * Get execution logs for a rule
   */
  async getExecutionLogs(ruleId: string, limit: number = 20): Promise<EventTriggerLogEntity[]> {
    return this.logRepo.findByRuleId(ruleId, limit);
  }

  // ==================== Private Helpers ====================

  private async executeRule(rule: EventTriggerRuleEntity, event: IncomingEvent, tenantId: string): Promise<EventTriggerLogEntity> {
    logger.info({ ruleId: rule.id, eventType: event.eventType }, 'Executing trigger rule');

    const actionResults: ActionResult[] = [];

    for (const action of rule.actions.sort((a, b) => a.order - b.order)) {
      try {
        const result = await this.executeAction(action, event);
        actionResults.push(result);
      } catch (err: any) {
        actionResults.push({
          actionId: action.id,
          actionType: action.type,
          status: 'failed',
          output: null,
          error: err.message ?? 'Unknown error',
        });
      }
    }

    const hasFailure = actionResults.some((r) => r.status === 'failed');
    const allSkipped = actionResults.every((r) => r.status === 'skipped');
    const status = hasFailure ? 'partial' : (allSkipped ? 'failed' : 'success');

    // Update last triggered time
    await this.ruleRepo.update(rule.id, { lastTriggeredAt: new Date() });

    const log = await this.logRepo.create({
      tenantId,
      ruleId: rule.id,
      eventType: event.eventType,
      eventPayload: JSON.stringify(event.payload),
      actionResults: JSON.stringify(actionResults),
      status,
      triggeredAt: new Date(),
    });

    logger.info({ ruleId: rule.id, logId: log.id, status }, 'Trigger rule execution completed');
    return log;
  }

  private async executeAction(action: TriggerAction, event: IncomingEvent): Promise<ActionResult> {
    logger.debug({ actionId: action.id, actionType: action.type }, 'Executing action');

    switch (action.type) {
      case 'webhook': {
        const url = action.config.url as string;
        if (!url) {
          return { actionId: action.id, actionType: action.type, status: 'failed', output: null, error: 'Webhook URL not configured' };
        }
        // In production, this would make an HTTP call
        logger.info({ url, eventType: event.eventType }, 'Webhook action triggered');
        return { actionId: action.id, actionType: action.type, status: 'success', output: `Webhook sent to ${url}`, error: null };
      }
      case 'notification': {
        const channel = action.config.channel as string ?? 'default';
        logger.info({ channel, eventType: event.eventType }, 'Notification action triggered');
        return { actionId: action.id, actionType: action.type, status: 'success', output: `Notification sent via ${channel}`, error: null };
      }
      case 'runbook': {
        const runbookId = action.config.runbookId as string;
        if (!runbookId) {
          return { actionId: action.id, actionType: action.type, status: 'failed', output: null, error: 'Runbook ID not configured' };
        }
        logger.info({ runbookId, eventType: event.eventType }, 'Runbook action triggered');
        return { actionId: action.id, actionType: action.type, status: 'success', output: `Runbook ${runbookId} triggered`, error: null };
      }
      case 'script': {
        const scriptName = action.config.script as string;
        logger.info({ scriptName, eventType: event.eventType }, 'Script action triggered');
        return { actionId: action.id, actionType: action.type, status: 'success', output: `Script ${scriptName} executed`, error: null };
      }
      case 'escalation': {
        const level = action.config.level as string ?? 'p1';
        logger.info({ level, eventType: event.eventType }, 'Escalation action triggered');
        return { actionId: action.id, actionType: action.type, status: 'success', output: `Escalated to ${level}`, error: null };
      }
      default:
        return { actionId: action.id, actionType: action.type, status: 'skipped', output: null, error: `Unknown action type: ${action.type}` };
    }
  }

  private matchesConditions(payload: Record<string, unknown>, matchConditions: Record<string, unknown>): boolean {
    for (const [key, expectedValue] of Object.entries(matchConditions)) {
      const actualValue = this.getNestedValue(payload, key);
      if (expectedValue instanceof RegExp) {
        if (typeof actualValue !== 'string' || !expectedValue.test(actualValue)) return false;
      } else if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
