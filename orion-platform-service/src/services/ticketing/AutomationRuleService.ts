/**
 * AutomationRuleService - Automation Rule Management Service
 *
 * Provides CRUD operations for automation rules and rule execution engine.
 */

import { createLogger } from '../../utils/logger';
import { getCurrentTenantId, getCurrentUserId } from '../../db/tenant-context-storage';
import { AutomationRuleRepository } from '../repositories/AutomationRuleRepository';
import {
  AutomationRule,
  AutomationRuleExecution,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  AutomationCondition,
  AutomationAction,
} from './types';

const logger = createLogger('automation-rule-service');

export class AutomationRuleServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'AutomationRuleServiceError'; }
}

export class AutomationRuleService {
  private repository: AutomationRuleRepository;

  constructor(repository: AutomationRuleRepository) {
    this.repository = repository;
  }

  // ==================== Rule CRUD ====================

  /**
   * Create a new automation rule
   */
  async createRule(input: CreateAutomationRuleInput): Promise<AutomationRule> {
    const tenantId = getCurrentTenantId();
    const userId = getCurrentUserId();

    const ruleInput: CreateAutomationRuleInput = {
      ...input,
      createdBy: userId || input.createdBy,
    };

    const rule = await this.repository.createRule(ruleInput, tenantId);
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, ruleId: rule.id, name: rule.name },
      '[AutomationRuleService] Rule created'
    );
    return rule;
  }

  /**
   * Get automation rule by ID
   */
  async getRule(tenantId: string, ruleId: string): Promise<AutomationRule | null> {
    return this.repository.findRuleById(ruleId);
  }

  /**
   * List automation rules for a tenant
   */
  async listRules(tenantId: string, options?: { enabled?: boolean; limit?: number; offset?: number }): Promise<AutomationRule[]> {
    return this.repository.findAllRules(options);
  }

  /**
   * Update an automation rule
   */
  async updateRule(tenantId: string, ruleId: string, updates: UpdateAutomationRuleInput): Promise<AutomationRule> {
    const rule = await this.repository.updateRule(ruleId, updates);
    if (!rule) {
      throw new AutomationRuleServiceError(`Automation rule not found: ${ruleId}`, 'NOT_FOUND');
    }
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, ruleId },
      '[AutomationRuleService] Rule updated'
    );
    return rule;
  }

  /**
   * Delete an automation rule
   */
  async deleteRule(tenantId: string, ruleId: string): Promise<void> {
    const deleted = await this.repository.deleteRule(ruleId);
    if (!deleted) {
      throw new AutomationRuleServiceError(`Automation rule not found: ${ruleId}`, 'NOT_FOUND');
    }
    logger.info(
      { traceId: getCurrentTenantId(), tenantId, ruleId },
      '[AutomationRuleService] Rule deleted'
    );
  }

  // ==================== Rule Execution ====================

  /**
   * Execute an automation rule against a ticket context
   */
  async executeRule(tenantId: string, ruleId: string, context: {
    ticketId: string;
    triggeredBy: 'create' | 'update' | 'manual';
    ticket: Record<string, any>;
  }): Promise<AutomationRuleExecution> {
    const rule = await this.repository.findRuleById(ruleId);
    if (!rule) {
      throw new AutomationRuleServiceError(`Automation rule not found: ${ruleId}`, 'NOT_FOUND');
    }

    if (!rule.enabled) {
      throw new AutomationRuleServiceError(`Automation rule is disabled: ${ruleId}`, 'RULE_DISABLED');
    }

    // Evaluate conditions
    const conditionsMet = this.evaluateConditions(rule.conditions, context.ticket);

    // Create execution log
    const execution = await this.repository.createExecution({
      ruleId,
      ticketId: context.ticketId,
      triggeredBy: context.triggeredBy,
      conditionsMet,
      actionsTaken: conditionsMet ? rule.actions : [],
      status: 'running',
    });

    try {
      if (conditionsMet) {
        // Execute actions
        const actionsTaken: AutomationAction[] = [];
        for (const action of rule.actions) {
          const result = await this.executeAction(action, context.ticket);
          actionsTaken.push(result);
        }

        // Update execution log
        await this.repository.updateExecution(execution.id, {
          status: 'success',
          actionsTaken,
          completedAt: new Date(),
        });

        // Increment rule execution count
        await this.repository.incrementExecutionCount(ruleId);

        logger.info(
          { traceId: getCurrentTenantId(), tenantId, ruleId, ticketId: context.ticketId, actionsCount: actionsTaken.length },
          '[AutomationRuleService] Rule executed successfully'
        );
      } else {
        await this.repository.updateExecution(execution.id, {
          status: 'success',
          completedAt: new Date(),
        });
      }
    } catch (error) {
      await this.repository.updateExecution(execution.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
      logger.error(
        { traceId: getCurrentTenantId(), tenantId, ruleId, ticketId: context.ticketId, err: error },
        '[AutomationRuleService] Rule execution failed'
      );
      throw error;
    }

    return execution;
  }

  /**
   * Evaluate conditions against ticket data
   */
  evaluateConditions(conditions: AutomationCondition[], ticket: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(ticket, condition.field);
      return this.compareValues(fieldValue, condition.operator, condition.value);
    });
  }

  /**
   * Execute a single automation action
   */
  private async executeAction(action: AutomationAction, ticket: Record<string, any>): Promise<AutomationAction> {
    // Action execution logic - in a real implementation, this would dispatch to
    // appropriate handlers (assign, set priority, add tag, notify, etc.)
    logger.info(
      { traceId: getCurrentTenantId(), actionType: action.type, payload: action.payload },
      '[AutomationRuleService] Executing action'
    );

    // For now, return the action as-is. In production, this would:
    // - 'assign': Update ticket assignee
    // - 'set_priority': Update ticket priority
    // - 'add_tag': Add tag to ticket
    // - 'notify': Send notification
    // - etc.

    return action;
  }

  // ==================== Helpers ====================

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'neq':
        return actual !== expected;
      case 'gt':
        return actual > expected;
      case 'gte':
        return actual >= expected;
      case 'lt':
        return actual < expected;
      case 'lte':
        return actual <= expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'nin':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'contains':
        return typeof actual === 'string' && actual.includes(expected);
      case 'starts_with':
        return typeof actual === 'string' && actual.startsWith(expected);
      case 'ends_with':
        return typeof actual === 'string' && actual.endsWith(expected);
      case 'is_null':
        return actual === null || actual === undefined;
      case 'is_not_null':
        return actual !== null && actual !== undefined;
      default:
        return false;
    }
  }

  // ==================== Query Helpers ====================

  /**
   * Get enabled rules for a tenant
   */
  async getEnabledRules(tenantId: string): Promise<AutomationRule[]> {
    return this.repository.getEnabledRules(tenantId);
  }

  /**
   * Get execution history for a rule
   */
  async getRuleExecutions(tenantId: string, ruleId: string, limit = 50): Promise<AutomationRuleExecution[]> {
    return this.repository.getExecutionsByRule(ruleId, tenantId, limit);
  }

  /**
   * Get execution history for a ticket
   */
  async getTicketExecutions(tenantId: string, ticketId: string): Promise<AutomationRuleExecution[]> {
    return this.repository.getExecutionsByTicket(ticketId, tenantId);
  }
}
