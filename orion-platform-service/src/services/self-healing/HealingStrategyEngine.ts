/**
 * Healing Strategy Engine
 *
 * Matches incidents to healing strategies based on incident type,
 * severity, conditions, and confidence scores. Provides built-in
 * strategies for common failure scenarios.
 *
 * TASK-702: Self-Healing Engine (自愈引擎)
 */

import { v4 as uuidv4 } from 'uuid';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';
import {
  HealingStrategy,
  HealingAction,
  HealingCondition,
  StrategyTriggerType,
  IncidentType,
  HealingActionType,
  BuiltInStrategyId,
} from './types';
import { HealingStrategyRepository, HealingStrategyEntity } from '../../repositories/HealingStrategyRepository';
import { DatabasePool } from '../../services/database';

const logger = createLogger('healing-strategy-engine');

export class HealingStrategyEngine {
  private repository: HealingStrategyRepository;

  constructor(db: DatabasePool) {
    if (!db) throw new OrionError('DatabasePool is required for HealingStrategyEngine', ErrorCode.INTERNAL_ERROR);
    this.repository = new HealingStrategyRepository(db);
    // Seed built-in strategies (blocking - must complete before engine is usable)
    this.registerBuiltInStrategies().catch(err => {
      logger.warn({ traceId: getCurrentTraceId(), err }, 'Failed to seed built-in strategies');
    });
  }

  /**
   * Register a new healing strategy
   */
  async registerStrategy(strategy: HealingStrategy): Promise<void> {
    const existing = await this.repository.findById(strategy.id);
    if (existing) {
      await this.repository.update(strategy.id, {
        name: strategy.name,
        trigger_type: strategy.triggerType,
        actions: JSON.stringify(strategy.actions),
        conditions: JSON.stringify(strategy.conditions || []),
        confidence: strategy.confidence,
        enabled: strategy.enabled,
        description: strategy.description || null,
        environments: strategy.environments ? JSON.stringify(strategy.environments) : null,
        max_retries: strategy.maxRetries ?? null,
        retry_cooldown_ms: strategy.retryCooldownMs ?? null,
      });
    } else {
      await this.repository.create({
        id: strategy.id,
        name: strategy.name,
        trigger_type: strategy.triggerType,
        actions: JSON.stringify(strategy.actions),
        conditions: JSON.stringify(strategy.conditions || []),
        confidence: strategy.confidence,
        enabled: strategy.enabled,
        description: strategy.description || null,
        environments: strategy.environments ? JSON.stringify(strategy.environments) : null,
        max_retries: strategy.maxRetries ?? null,
        retry_cooldown_ms: strategy.retryCooldownMs ?? null,
      });
    }
  }

  /**
   * Unregister a strategy by ID
   */
  async unregisterStrategy(strategyId: string): Promise<boolean> {
    return this.repository.delete(strategyId);
  }

  /**
   * Get a strategy by ID
   */
  async getStrategy(strategyId: string): Promise<HealingStrategy | undefined> {
    const entity = await this.repository.findById(strategyId);
    if (!entity) return undefined;
    return this.entityToStrategy(entity);
  }

  /**
   * Get all registered strategies
   */
  async getAllStrategies(): Promise<HealingStrategy[]> {
    const { entities } = await this.repository.findAll({ limit: 1000 });
    return entities.map(e => this.entityToStrategy(e));
  }

  /**
   * Enable a strategy
   */
  async enableStrategy(strategyId: string): Promise<boolean> {
    const result = await this.repository.enableStrategy(strategyId);
    return !!result;
  }

  /**
   * Disable a strategy
   */
  async disableStrategy(strategyId: string): Promise<boolean> {
    const result = await this.repository.disableStrategy(strategyId);
    return !!result;
  }

  /**
   * Match incident to applicable strategies
   * Returns all strategies that match the incident type and conditions
   */
  async matchStrategies(
    incidentType: IncidentType,
    tags?: Record<string, string>
  ): Promise<HealingStrategy[]> {
    const enabledStrategies = (await this.repository.findEnabled()).map(e => this.entityToStrategy(e));

    return enabledStrategies.filter((strategy) => {
      // Check trigger type match
      if (
        strategy.triggerType !== 'any' &&
        strategy.triggerType !== incidentType
      ) {
        return false;
      }

      // Check conditions if any
      if (strategy.conditions && strategy.conditions.length > 0) {
        return this.evaluateConditions(strategy.conditions, tags);
      }

      return true;
    });
  }

  /**
   * Select the best strategy for an incident
   * Chooses based on highest confidence among matching strategies
   */
  async selectBestStrategy(
    incidentType: IncidentType,
    tags?: Record<string, string>
  ): Promise<HealingStrategy | null> {
    const matching = await this.matchStrategies(incidentType, tags);

    if (matching.length === 0) {
      return null;
    }

    // Sort by confidence descending, then by maxRetries (prefer strategies with retries)
    matching.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      const retriesA = a.maxRetries ?? 0;
      const retriesB = b.maxRetries ?? 0;
      return retriesB - retriesA;
    });

    return matching[0];
  }

  /**
   * Evaluate conditions against provided context
   */
  private evaluateConditions(
    conditions: HealingCondition[],
    context?: Record<string, any>
  ): boolean {
    if (!context) return true;

    return conditions.every((condition) => {
      const contextValue = context[condition.field];
      if (contextValue === undefined) return false;

      return this.evaluateCondition(condition, contextValue);
    });
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: HealingCondition,
    value: any
  ): boolean {
    switch (condition.operator) {
      case '==':
        return value === condition.value;
      case '!=':
        return value !== condition.value;
      case '>':
        return value > condition.value;
      case '<':
        return value < condition.value;
      case '>=':
        return value >= condition.value;
      case '<=':
        return value <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'contains':
        if (Array.isArray(value)) {
          return value.includes(condition.value);
        }
        if (typeof value === 'string') {
          return value.includes(condition.value);
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Convert DB entity to HealingStrategy
   */
  private entityToStrategy(entity: HealingStrategyEntity): HealingStrategy {
    return {
      id: entity.id,
      name: entity.name,
      triggerType: entity.triggerType as StrategyTriggerType,
      actions: entity.actions,
      conditions: entity.conditions?.length > 0 ? entity.conditions : undefined,
      confidence: entity.confidence,
      enabled: entity.enabled,
      description: entity.description || undefined,
      environments: entity.environments || undefined,
      maxRetries: entity.maxRetries ?? undefined,
      retryCooldownMs: entity.retryCooldownMs ?? undefined,
    };
  }

  // ==================== Built-in Strategies ====================

  /**
   * Register all built-in healing strategies
   * Seeds DB with built-in strategies if they don't exist yet
   */
  private async registerBuiltInStrategies(): Promise<void> {
    const builtInStrategies = this.getBuiltInStrategies();

    for (const strategy of builtInStrategies) {
      const existing = await this.repository.findById(strategy.id);
      if (!existing) {
        await this.repository.create({
          id: strategy.id,
          name: strategy.name,
          trigger_type: strategy.triggerType,
          actions: JSON.stringify(strategy.actions),
          conditions: JSON.stringify(strategy.conditions || []),
          confidence: strategy.confidence,
          enabled: strategy.enabled,
          description: strategy.description || null,
          environments: strategy.environments ? JSON.stringify(strategy.environments) : null,
          max_retries: strategy.maxRetries ?? null,
          retry_cooldown_ms: strategy.retryCooldownMs ?? null,
        });
      }
    }

    logger.info({ count: builtInStrategies.length }, 'Built-in strategies registered');
  }

  /**
   * Get all built-in healing strategies
   */
  private getBuiltInStrategies(): HealingStrategy[] {
    return [
      // Restart strategy for pod/service crashes
      {
        id: 'restart-on-crash',
        name: 'Auto Restart on Crash',
        triggerType: 'pod_crash',
        confidence: 90,
        enabled: true,
        description: 'Automatically restart crashed pods/services',
        maxRetries: 3,
        retryCooldownMs: 30000,
        actions: [
          {
            type: 'restart',
            params: {
              target: '{{appName}}',
              graceful: true,
              timeoutMs: 60000,
            },
            timeout: 120000,
            rollback: true,
            description: 'Restart the crashed application gracefully',
          },
        ],
        conditions: [
          { field: 'severity', operator: 'in', value: ['critical', 'warning'] },
        ],
      },
      // Scale strategy for high CPU usage
      {
        id: 'scale-on-high-cpu',
        name: 'Auto Scale on High CPU',
        triggerType: 'high_cpu',
        confidence: 75,
        enabled: true,
        description: 'Scale out instances when CPU usage exceeds threshold',
        maxRetries: 2,
        retryCooldownMs: 60000,
        actions: [
          {
            type: 'scale',
            params: {
              target: '{{appName}}',
              direction: 'up',
              increment: 2,
              maxReplicas: 10,
            },
            timeout: 180000,
            rollback: true,
            description: 'Scale up by 2 replicas (max 10)',
          },
        ],
      },
      // Scale strategy for high memory usage
      {
        id: 'scale-on-high-memory',
        name: 'Auto Scale on High Memory',
        triggerType: 'high_memory',
        confidence: 70,
        enabled: true,
        description: 'Scale out instances when memory usage exceeds threshold',
        maxRetries: 2,
        retryCooldownMs: 60000,
        actions: [
          {
            type: 'scale',
            params: {
              target: '{{appName}}',
              direction: 'up',
              increment: 1,
              maxReplicas: 8,
            },
            timeout: 180000,
            rollback: true,
            description: 'Scale up by 1 replica (max 8)',
          },
        ],
      },
      // Failover strategy for node failures
      {
        id: 'failover-on-node-failure',
        name: 'Failover on Node Failure',
        triggerType: 'node_failure',
        confidence: 85,
        enabled: true,
        description: 'Failover workloads to healthy nodes',
        maxRetries: 1,
        retryCooldownMs: 120000,
        actions: [
          {
            type: 'failover',
            params: {
              target: '{{appName}}',
              sourceNode: '{{failedNode}}',
              targetNode: 'auto',
              drainTimeoutMs: 30000,
            },
            timeout: 300000,
            rollback: true,
            description: 'Migrate workloads from failed node to healthy node',
          },
        ],
      },
      // Rollback strategy for deployment failures
      {
        id: 'rollback-on-deployment-failure',
        name: 'Auto Rollback on Deployment Failure',
        triggerType: 'deployment_failure',
        confidence: 95,
        enabled: true,
        description: 'Automatically rollback failed deployments to previous version',
        maxRetries: 1,
        retryCooldownMs: 0,
        actions: [
          {
            type: 'rollback',
            params: {
              target: '{{appName}}',
              environment: '{{environment}}',
              targetVersion: 'previous',
            },
            timeout: 300000,
            rollback: false,
            description: 'Rollback to the previous deployment version',
          },
        ],
      },
      // Restart strategy for service down
      {
        id: 'restart-on-service-down',
        name: 'Auto Restart on Service Down',
        triggerType: 'service_down',
        confidence: 80,
        enabled: true,
        description: 'Restart services that are detected as down',
        maxRetries: 3,
        retryCooldownMs: 30000,
        actions: [
          {
            type: 'restart',
            params: {
              target: '{{appName}}',
              graceful: false,
              timeoutMs: 30000,
            },
            timeout: 90000,
            rollback: true,
            description: 'Force restart the downed service',
          },
        ],
      },
      // Scale strategy for high error rate
      {
        id: 'scale-on-high-error-rate',
        name: 'Auto Scale on High Error Rate',
        triggerType: 'high_error_rate',
        confidence: 60,
        enabled: true,
        description: 'Scale out when error rate exceeds threshold (may help with load-related errors)',
        maxRetries: 2,
        retryCooldownMs: 60000,
        actions: [
          {
            type: 'scale',
            params: {
              target: '{{appName}}',
              direction: 'up',
              increment: 2,
              maxReplicas: 12,
            },
            timeout: 180000,
            rollback: true,
            description: 'Scale up to distribute error load',
          },
          {
            type: 'restart',
            params: {
              target: '{{appName}}',
              graceful: true,
              timeoutMs: 60000,
            },
            timeout: 120000,
            rollback: true,
            description: 'Restart if scaling alone does not resolve errors',
          },
        ],
      },
      // Restart strategy for network timeouts
      {
        id: 'restart-on-network-timeout',
        name: 'Auto Restart on Network Timeout',
        triggerType: 'network_timeout',
        confidence: 55,
        enabled: true,
        description: 'Restart service experiencing network timeouts',
        maxRetries: 2,
        retryCooldownMs: 45000,
        actions: [
          {
            type: 'restart',
            params: {
              target: '{{appName}}',
              graceful: true,
              timeoutMs: 90000,
            },
            timeout: 180000,
            rollback: true,
            description: 'Restart service to reset network connections',
          },
        ],
      },
    ];
  }
}
