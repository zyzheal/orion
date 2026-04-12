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
import {
  HealingStrategy,
  HealingAction,
  HealingCondition,
  StrategyTriggerType,
  IncidentType,
  HealingActionType,
  BuiltInStrategyId,
} from './types';

export class HealingStrategyEngine {
  private strategies: Map<string, HealingStrategy> = new Map();

  constructor() {
    this.registerBuiltInStrategies();
  }

  /**
   * Register a new healing strategy
   */
  registerStrategy(strategy: HealingStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  /**
   * Unregister a strategy by ID
   */
  unregisterStrategy(strategyId: string): boolean {
    return this.strategies.delete(strategyId);
  }

  /**
   * Get a strategy by ID
   */
  getStrategy(strategyId: string): HealingStrategy | undefined {
    return this.strategies.get(strategyId);
  }

  /**
   * Get all registered strategies
   */
  getAllStrategies(): HealingStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Enable a strategy
   */
  enableStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;
    strategy.enabled = true;
    return true;
  }

  /**
   * Disable a strategy
   */
  disableStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;
    strategy.enabled = false;
    return true;
  }

  /**
   * Match incident to applicable strategies
   * Returns all strategies that match the incident type and conditions
   */
  matchStrategies(
    incidentType: IncidentType,
    tags?: Record<string, string>
  ): HealingStrategy[] {
    const enabledStrategies = Array.from(this.strategies.values()).filter(
      (s) => s.enabled
    );

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
  selectBestStrategy(
    incidentType: IncidentType,
    tags?: Record<string, string>
  ): HealingStrategy | null {
    const matching = this.matchStrategies(incidentType, tags);

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

  // ==================== Built-in Strategies ====================

  /**
   * Register all built-in healing strategies
   */
  private registerBuiltInStrategies(): void {
    this.registerRestartOnCrash();
    this.registerScaleOnHighCpu();
    this.registerScaleOnHighMemory();
    this.registerFailoverOnNodeFailure();
    this.registerRollbackOnDeploymentFailure();
    this.registerRestartOnServiceDown();
    this.registerScaleOnHighErrorRate();
    this.registerRestartOnNetworkTimeout();
  }

  /**
   * Restart strategy for pod/service crashes
   */
  private registerRestartOnCrash(): void {
    this.registerStrategy({
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
    });
  }

  /**
   * Scale strategy for high CPU usage
   */
  private registerScaleOnHighCpu(): void {
    this.registerStrategy({
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
    });
  }

  /**
   * Scale strategy for high memory usage
   */
  private registerScaleOnHighMemory(): void {
    this.registerStrategy({
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
    });
  }

  /**
   * Failover strategy for node failures
   */
  private registerFailoverOnNodeFailure(): void {
    this.registerStrategy({
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
    });
  }

  /**
   * Rollback strategy for deployment failures
   */
  private registerRollbackOnDeploymentFailure(): void {
    this.registerStrategy({
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
    });
  }

  /**
   * Restart strategy for service down
   */
  private registerRestartOnServiceDown(): void {
    this.registerStrategy({
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
    });
  }

  /**
   * Scale strategy for high error rate
   */
  private registerScaleOnHighErrorRate(): void {
    this.registerStrategy({
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
    });
  }

  /**
   * Restart strategy for network timeouts
   */
  private registerRestartOnNetworkTimeout(): void {
    this.registerStrategy({
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
    });
  }
}
