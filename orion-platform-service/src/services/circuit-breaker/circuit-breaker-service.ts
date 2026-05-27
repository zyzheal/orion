/**
 * CircuitBreakerService
 *
 * Core service that manages circuit breaker instances with persistence.
 * Wraps the existing CircuitBreaker utility class with:
 * - Registry (manage multiple circuit breakers by target key)
 * - PostgreSQL persistence (configs, states, events)
 * - State synchronization between memory and DB
 *
 * F001: Circuit Breaker Service Layer
 */

import { CircuitBreaker, CircuitBreakerConfig, CircuitState } from '../../utils/rate-limit-circuit-breaker';
import {
  CircuitBreakerConfigRepository,
  CircuitBreakerStateRepository,
  CircuitBreakerEventRepository,
  type CircuitBreakerEventType,
} from './circuit-breaker-repositories';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CircuitBreakerRegistryEntry {
  targetKey: string;
  breaker: CircuitBreaker;
  config: CircuitBreakerConfig;
}

export interface CircuitBreakerSummary {
  total: number;
  closed: number;
  open: number;
  halfOpen: number;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class CircuitBreakerService {
  private registry = new Map<string, CircuitBreakerRegistryEntry>();

  constructor(
    private configRepo: CircuitBreakerConfigRepository,
    private stateRepo: CircuitBreakerStateRepository,
    private eventRepo: CircuitBreakerEventRepository,
  ) {}

  /**
   * Initialize the registry from database configs.
   * Should be called during application startup.
   */
  async initialize(): Promise<void> {
    const configs = await this.configRepo.findEnabled();
    for (const config of configs) {
      await this.register(config.targetKey, {
        failureThreshold: config.failureThreshold,
        recoveryTimeoutMs: config.recoveryTimeoutMs,
        successThreshold: config.successThreshold,
      });
    }
  }

  /**
   * Register a new circuit breaker. If one already exists for the key, it will be replaced.
   */
  async register(targetKey: string, config: CircuitBreakerConfig): Promise<CircuitBreakerRegistryEntry> {
    // Persist config to DB
    await this.configRepo.upsertByTargetKey(targetKey, {
      ...config,
      enabled: true,
    });

    // Create in-memory instance
    const breaker = new CircuitBreaker(config);
    const entry: CircuitBreakerRegistryEntry = { targetKey, breaker, config };
    this.registry.set(targetKey, entry);

    // Log event
    await this.eventRepo.logEvent(targetKey, 'config_change', {
      toState: breaker.currentState,
      message: `Circuit breaker registered with threshold=${config.failureThreshold}`,
    });

    // Persist initial state
    await this.stateRepo.upsertState(
      targetKey,
      breaker.currentState,
      0,
      0,
      null,
      null,
    );

    return entry;
  }

  /**
   * Get a circuit breaker by target key. Auto-creates with default config if not found.
   */
  async getOrCreate(targetKey: string, defaults?: CircuitBreakerConfig): Promise<CircuitBreaker> {
    let entry = this.registry.get(targetKey);
    if (entry) return entry.breaker;

    // Try DB config first
    const dbConfig = await this.configRepo.findByTargetKey(targetKey);
    if (dbConfig && dbConfig.enabled) {
      return this.register(targetKey, {
        failureThreshold: dbConfig.failureThreshold,
        recoveryTimeoutMs: dbConfig.recoveryTimeoutMs,
        successThreshold: dbConfig.successThreshold,
      }).then((e) => e.breaker);
    }

    // Use defaults or fall back to reasonable defaults
    const config = defaults ?? {
      failureThreshold: 5,
      recoveryTimeoutMs: 60000,
      successThreshold: 1,
    };

    return this.register(targetKey, config).then((e) => e.breaker);
  }

  /**
   * Execute a function through the circuit breaker.
   * Automatically syncs state to DB after each call.
   */
  async execute<T>(targetKey: string, fn: () => Promise<T>): Promise<T> {
    const breaker = await this.getOrCreate(targetKey);
    const previousState = breaker.currentState;

    try {
      const result = await breaker.execute(fn);
      const newState = breaker.currentState;

      // Sync to DB
      const stats = breaker.getStats();
      await this.stateRepo.upsertState(
        targetKey,
        stats.state,
        stats.failureCount,
        stats.successCount,
        stats.lastFailureTime,
        (stats as any).lastSuccessTime,
      );

      // Log state change
      if (newState !== previousState) {
        await this.logStateChange(targetKey, previousState, newState, stats);
      }

      // Log success event
      await this.eventRepo.logEvent(targetKey, 'success', {
        fromState: previousState,
        toState: newState,
        failureCount: stats.failureCount,
        successCount: stats.successCount,
      });

      return result;
    } catch (error) {
      const newState = breaker.currentState;
      const stats = breaker.getStats();

      // Sync to DB
      await this.stateRepo.upsertState(
        targetKey,
        stats.state,
        stats.failureCount,
        stats.successCount,
        stats.lastFailureTime,
        (stats as any).lastSuccessTime,
      );

      // Log state change
      if (newState !== previousState) {
        await this.logStateChange(targetKey, previousState, newState, stats);
      }

      // Log failure event
      await this.eventRepo.logEvent(targetKey, 'failure', {
        fromState: previousState,
        toState: newState,
        failureCount: stats.failureCount,
        successCount: stats.successCount,
        message: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Manually reset a circuit breaker to CLOSED state.
   */
  async reset(targetKey: string): Promise<void> {
    const entry = this.registry.get(targetKey);
    if (!entry) {
      throw new Error(`Circuit breaker not found for key: ${targetKey}`);
    }

    const previousState = entry.breaker.currentState;
    entry.breaker.close();

    // Reset DB state
    await this.stateRepo.resetState(targetKey);

    // Log event
    await this.eventRepo.logEvent(targetKey, 'manual_reset', {
      fromState: previousState,
      toState: 'closed',
      message: `Circuit breaker manually reset`,
    });
  }

  /**
   * Manually trip a circuit breaker to OPEN state.
   */
  async trip(targetKey: string): Promise<void> {
    const entry = this.registry.get(targetKey);
    if (!entry) {
      throw new Error(`Circuit breaker not found for key: ${targetKey}`);
    }

    const previousState = entry.breaker.currentState;
    entry.breaker.open();

    // Update DB state
    const stats = entry.breaker.getStats();
    await this.stateRepo.upsertState(
      targetKey,
      stats.state,
      stats.failureCount,
      stats.successCount,
      stats.lastFailureTime,
      (stats as any).lastSuccessTime,
    );

    // Log event
    await this.eventRepo.logEvent(targetKey, 'manual_trip', {
      fromState: previousState,
      toState: 'open',
      message: `Circuit breaker manually tripped`,
    });
  }

  /**
   * Update configuration for an existing circuit breaker.
   */
  async updateConfig(targetKey: string, config: Partial<CircuitBreakerConfig>): Promise<void> {
    // Update in-memory instance
    const entry = this.registry.get(targetKey);
    if (!entry) {
      throw new Error(`Circuit breaker not found for key: ${targetKey}`);
    }

    // Merge config
    const newConfig = { ...entry.config, ...config };
    entry.config = newConfig;

    // Create new breaker instance with updated config
    const newBreaker = new CircuitBreaker(newConfig);
    entry.breaker = newBreaker;

    // Persist
    await this.configRepo.upsertByTargetKey(targetKey, { ...newConfig, enabled: true });
    await this.eventRepo.logEvent(targetKey, 'config_change', {
      toState: newBreaker.currentState,
      message: `Configuration updated: ${JSON.stringify(config)}`,
    });
  }

  /**
   * Disable a circuit breaker (remove from registry but keep DB config).
   */
  async disable(targetKey: string): Promise<void> {
    this.registry.delete(targetKey);
    await this.configRepo.upsertByTargetKey(targetKey, { enabled: false });
  }

  /**
   * Enable a circuit breaker (re-create from DB config).
   */
  async enable(targetKey: string): Promise<void> {
    const dbConfig = await this.configRepo.findByTargetKey(targetKey);
    if (!dbConfig) {
      throw new Error(`No configuration found for key: ${targetKey}`);
    }
    await this.register(targetKey, {
      failureThreshold: dbConfig.failureThreshold,
      recoveryTimeoutMs: dbConfig.recoveryTimeoutMs,
      successThreshold: dbConfig.successThreshold,
    });
  }

  // ─── Query Methods ─────────────────────────────────────────────────────

  /**
   * Get the current state of a circuit breaker.
   */
  async getState(targetKey: string): Promise<{
    state: CircuitState;
    config: CircuitBreakerConfig;
    stats: ReturnType<CircuitBreaker['getStats']>;
  } | null> {
    const entry = this.registry.get(targetKey);
    if (!entry) return null;

    const stats = entry.breaker.getStats();
    return { state: stats.state, config: entry.config, stats };
  }

  /**
   * List all circuit breakers in the registry.
   */
  async listAll(): Promise<{
    targetKey: string;
    state: CircuitState;
    config: CircuitBreakerConfig;
    stats: ReturnType<CircuitBreaker['getStats']>;
  }[]> {
    const results: any[] = [];
    for (const entry of this.registry.values()) {
      const stats = entry.breaker.getStats();
      results.push({
        targetKey: entry.targetKey,
        state: stats.state,
        config: entry.config,
        stats,
      });
    }
    return results;
  }

  /**
   * Get summary counts.
   */
  async getSummary(): Promise<CircuitBreakerSummary> {
    const all = await this.listAll();
    return {
      total: all.length,
      closed: all.filter((b) => b.state === 'closed').length,
      open: all.filter((b) => b.state === 'open').length,
      halfOpen: all.filter((b) => b.state === 'half-open').length,
    };
  }

  /**
   * Get recent events for a target key.
   */
  async getEvents(targetKey: string, limit = 50) {
    return this.eventRepo.findByTargetKey(targetKey, limit);
  }

  /**
   * Get all persisted states from DB (useful for monitoring dashboard).
   */
  async getAllStates() {
    return this.stateRepo.findAll();
  }

  /**
   * Get all persisted configs from DB.
   */
  async getAllConfigs() {
    return this.configRepo.findEnabled();
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async logStateChange(
    targetKey: string,
    fromState: CircuitState,
    toState: CircuitState,
    stats: ReturnType<CircuitBreaker['getStats']>,
  ): Promise<void> {
    await this.eventRepo.logEvent(targetKey, 'state_change', {
      fromState,
      toState,
      failureCount: stats.failureCount,
      successCount: stats.successCount,
      message: `Circuit ${fromState} → ${toState}`,
    });
  }
}
