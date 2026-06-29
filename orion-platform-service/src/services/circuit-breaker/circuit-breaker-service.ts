/**
 * CircuitBreakerService
 *
 * Core service that manages circuit breaker instances with persistence.
 * Wraps the existing CircuitBreaker utility class with:
 * - Registry (manage multiple circuit breakers by target key)
 * - PostgreSQL persistence (configs, states, events)
 * - State synchronization between memory and DB
 * - Graceful degradation: falls back to in-memory Map when DB is unavailable
 *
 * F001: Circuit Breaker Service Layer
 */

import { CircuitBreaker, CircuitBreakerConfig, CircuitState } from '../../utils/rate-limit-circuit-breaker';
import {
  CircuitBreakerConfigRepository,
  CircuitBreakerStateRepository,
  CircuitBreakerEventRepository,
  CircuitBreakerStateEntity,
  CircuitBreakerConfigEntity,
  type CircuitBreakerEventType,
} from './circuit-breaker-repositories';
import { OrionError, ErrorCode } from '../../errors';

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

/** In-memory fallback store used when DB is unavailable */
type MemoryRegistry = Map<string, CircuitBreakerRegistryEntry>;
type MemoryStateStore = Map<string, {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
}>;

// ─── Service ───────────────────────────────────────────────────────────────

export class CircuitBreakerService {
  private registry: MemoryRegistry = new Map();
  private memoryStateStore: MemoryStateStore = new Map();
  private dbAvailable = false;

  constructor(
    private configRepo: CircuitBreakerConfigRepository,
    private stateRepo: CircuitBreakerStateRepository,
    private eventRepo: CircuitBreakerEventRepository,
  ) {}

  // ─── DB Availability Gate ──────────────────────────────────────────────

  /** Mark DB as available; also hydrates registry from DB */
  private markDbAvailable(): void {
    this.dbAvailable = true;
  }

  /** Mark DB as unavailable; registry continues to serve from memory */
  private markDbUnavailable(): void {
    this.dbAvailable = false;
  }

  /** Check if the DB-backed repository is considered healthy */
  private async pingDb(): Promise<boolean> {
    try {
      await this.stateRepo.findAll();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize the registry from database configs.
   * Should be called during application startup.
   */
  async initialize(): Promise<void> {
    // Quick health-check: is DB available at all?
    const reachable = await this.pingDb();
    if (!reachable) {
      this.markDbUnavailable();
      return;
    }

    this.markDbAvailable();

    // Load configs and build the memory registry
    const configs = await safeQuery(
      () => this.configRepo.findEnabled(),
      [],
      { logger: { warn: () => {} } }, // silent — we already pinged
    );

    for (const config of configs) {
      await this._registerUnsafe(config.targetKey, {
        failureThreshold: config.failureThreshold,
        recoveryTimeoutMs: config.recoveryTimeoutMs,
        successThreshold: config.successThreshold,
      });
    }

    // Hydrate memory state store from DB
    const allStates = await safeQuery(
      () => this.stateRepo.findAll(),
      [],
      { fallback: [] as CircuitBreakerStateEntity[] },
    );

    for (const entity of allStates) {
      this.memoryStateStore.set(entity.targetKey, {
        state: entity.state,
        failureCount: entity.failureCount,
        successCount: entity.successCount,
        lastFailureTime: entity.lastFailureTime,
      });
    }
  }

  /**
   * Register a new circuit breaker. If one already exists for the key, it will be replaced.
   * DB operations are fire-and-forget — failures degrade gracefully to in-memory mode.
   */
  async register(targetKey: string, config: CircuitBreakerConfig): Promise<CircuitBreakerRegistryEntry> {
    // If DB wasn't yet confirmed available, check now
    if (!this.dbAvailable) {
      const reachable = await this.pingDb();
      if (reachable) {
        this.markDbAvailable();
      }
    }

    // Persist config to DB (best-effort)
    await safeQuery(
      () => this.configRepo.upsertByTargetKey(targetKey, { ...config, enabled: true }),
      undefined,
      { silent: true },
    );

    // Create in-memory instance
    const breaker = new CircuitBreaker(config);
    const entry: CircuitBreakerRegistryEntry = { targetKey, breaker, config };
    this.registry.set(targetKey, entry);

    // Log event to DB (best-effort)
    await safeQuery(
      () => this.eventRepo.logEvent(targetKey, 'config_change', {
        toState: breaker.currentState,
        message: `Circuit breaker registered with threshold=${config.failureThreshold}`,
      }),
      undefined,
      { silent: true },
    );

    // Persist initial state to DB (best-effort)
    await safeQuery(
      () => this.stateRepo.upsertState(targetKey, breaker.currentState, 0, 0, null, null),
      undefined,
      { silent: true },
    );

    return entry;
  }

  /**
   * Internal register that skips DB ping / availability check.
   * Used by initialize() to avoid redundant DB checks.
   */
  private async _registerUnsafe(targetKey: string, config: CircuitBreakerConfig): Promise<CircuitBreakerRegistryEntry> {
    const breaker = new CircuitBreaker(config);
    const entry: CircuitBreakerRegistryEntry = { targetKey, breaker, config };
    this.registry.set(targetKey, entry);

    // Capture DB state directly without await to keep initialization fast
    void safeQuery(
      () => this.stateRepo.upsertState(targetKey, breaker.currentState, 0, 0, null, null),
      undefined,
      { silent: true },
    );

    return entry;
  }

  /**
   * Get a circuit breaker by target key. Auto-creates with default config if not found.
   */
  async getOrCreate(targetKey: string, defaults?: CircuitBreakerConfig): Promise<CircuitBreaker> {
    let entry = this.registry.get(targetKey);
    if (entry) return entry.breaker;

    // Ensure DB availability is confirmed
    if (!this.dbAvailable) {
      const reachable = await this.pingDb();
      if (reachable) {
        this.markDbAvailable();
      }
    }

    // Try DB config first
    const dbConfig = await safeQuery(
      () => this.configRepo.findByTargetKey(targetKey),
      null,
      { fallback: null },
    );

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

      // Sync to DB (best-effort — failure does not affect result)
      const stats = breaker.getStats();
      await safeQuery(
        () => this.stateRepo.upsertState(
          targetKey,
          stats.state,
          stats.failureCount,
          stats.successCount,
          stats.lastFailureTime,
          (stats as any).lastSuccessTime,
        ),
        undefined,
        { silent: true },
      );

      // Update memory state store
      this.memoryStateStore.set(targetKey, {
        state: stats.state,
        failureCount: stats.failureCount,
        successCount: stats.successCount,
        lastFailureTime: stats.lastFailureTime,
      });

      // Log state change
      if (newState !== previousState) {
        await safeQuery(
          () => this._logStateChange(targetKey, previousState, newState, stats),
          undefined,
          { silent: true },
        );
      }

      // Log success event
      await safeQuery(
        () => this.eventRepo.logEvent(targetKey, 'success', {
          fromState: previousState,
          toState: newState,
          failureCount: stats.failureCount,
          successCount: stats.successCount,
        }),
        undefined,
        { silent: true },
      );

      return result;
    } catch (error) {
      const newState = breaker.currentState;
      const stats = breaker.getStats();

      // Sync to DB (best-effort)
      await safeQuery(
        () => this.stateRepo.upsertState(
          targetKey,
          stats.state,
          stats.failureCount,
          stats.successCount,
          stats.lastFailureTime,
          (stats as any).lastSuccessTime,
        ),
        undefined,
        { silent: true },
      );

      // Update memory state store
      this.memoryStateStore.set(targetKey, {
        state: stats.state,
        failureCount: stats.failureCount,
        successCount: stats.successCount,
        lastFailureTime: stats.lastFailureTime,
      });

      // Log state change
      if (newState !== previousState) {
        await safeQuery(
          () => this._logStateChange(targetKey, previousState, newState, stats),
          undefined,
          { silent: true },
        );
      }

      // Log failure event
      await safeQuery(
        () => this.eventRepo.logEvent(targetKey, 'failure', {
          fromState: previousState,
          toState: newState,
          failureCount: stats.failureCount,
          successCount: stats.successCount,
          message: error instanceof Error ? error.message : String(error),
        }),
        undefined,
        { silent: true },
      );

      throw error;
    }
  }

  /**
   * Manually reset a circuit breaker to CLOSED state.
   */
  async reset(targetKey: string): Promise<void> {
    const entry = this.registry.get(targetKey);
    if (!entry) {
      throw new OrionError(`Circuit breaker not found for key: ${targetKey}`, ErrorCode.NOT_FOUND);
    }

    const previousState = entry.breaker.currentState;
    entry.breaker.close();

    // Reset DB state (best-effort)
    await safeQuery(
      () => this.stateRepo.resetState(targetKey),
      undefined,
      { silent: true },
    );

    // Update memory state
    this.memoryStateStore.set(targetKey, {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
    });

    // Log event (best-effort)
    await safeQuery(
      () => this.eventRepo.logEvent(targetKey, 'manual_reset', {
        fromState: previousState,
        toState: 'closed',
        message: `Circuit breaker manually reset`,
      }),
      undefined,
      { silent: true },
    );
  }

  /**
   * Manually trip a circuit breaker to OPEN state.
   */
  async trip(targetKey: string): Promise<void> {
    const entry = this.registry.get(targetKey);
    if (!entry) {
      throw new OrionError(`Circuit breaker not found for key: ${targetKey}`, ErrorCode.NOT_FOUND);
    }

    const previousState = entry.breaker.currentState;
    entry.breaker.open();

    // Update DB state (best-effort)
    const stats = entry.breaker.getStats();
    await safeQuery(
      () => this.stateRepo.upsertState(
        targetKey,
        stats.state,
        stats.failureCount,
        stats.successCount,
        stats.lastFailureTime,
        (stats as any).lastSuccessTime,
      ),
      undefined,
      { silent: true },
    );

    // Update memory state
    this.memoryStateStore.set(targetKey, {
      state: stats.state,
      failureCount: stats.failureCount,
      successCount: stats.successCount,
      lastFailureTime: stats.lastFailureTime,
    });

    // Log event (best-effort)
    await safeQuery(
      () => this.eventRepo.logEvent(targetKey, 'manual_trip', {
        fromState: previousState,
        toState: 'open',
        message: `Circuit breaker manually tripped`,
      }),
      undefined,
      { silent: true },
    );
  }

  /**
   * Update configuration for an existing circuit breaker.
   */
  async updateConfig(targetKey: string, config: Partial<CircuitBreakerConfig>): Promise<void> {
    // Update in-memory instance
    const entry = this.registry.get(targetKey);
    if (!entry) {
      throw new OrionError(`Circuit breaker not found for key: ${targetKey}`, ErrorCode.NOT_FOUND);
    }

    // Merge config
    const newConfig = { ...entry.config, ...config };
    entry.config = newConfig;

    // Create new breaker instance with updated config
    const newBreaker = new CircuitBreaker(newConfig);
    entry.breaker = newBreaker;

    // Persist (best-effort)
    await safeQuery(
      () => this.configRepo.upsertByTargetKey(targetKey, { ...newConfig, enabled: true }),
      undefined,
      { silent: true },
    );
    await safeQuery(
      () => this.eventRepo.logEvent(targetKey, 'config_change', {
        toState: newBreaker.currentState,
        message: `Configuration updated: ${JSON.stringify(config)}`,
      }),
      undefined,
      { silent: true },
    );
  }

  /**
   * Disable a circuit breaker (remove from registry but keep DB config).
   */
  async disable(targetKey: string): Promise<void> {
    this.registry.delete(targetKey);
    this.memoryStateStore.delete(targetKey);
    await safeQuery(
      () => this.configRepo.upsertByTargetKey(targetKey, { enabled: false }),
      undefined,
      { silent: true },
    );
  }

  /**
   * Enable a circuit breaker (re-create from DB config).
   */
  async enable(targetKey: string): Promise<void> {
    const dbConfig = await safeQuery(
      () => this.configRepo.findByTargetKey(targetKey),
      null,
      { fallback: null },
    );
    if (!dbConfig) {
      throw new OrionError(`No configuration found for key: ${targetKey}`, 'OPERATION_FAILED');
    }
    await this.register(targetKey, {
      failureThreshold: dbConfig.failureThreshold,
      recoveryTimeoutMs: dbConfig.recoveryTimeoutMs,
      successThreshold: dbConfig.successThreshold,
    });
  }

  // ─── Query Methods (Dual-Source: DB + Memory) ──────────────────────────

  /**
   * Get the current state of a circuit breaker.
   * Reads from DB as authoritative source; falls back to memory on failure.
   */
  async getState(targetKey: string): Promise<{
    state: CircuitState;
    config: CircuitBreakerConfig;
    stats: ReturnType<CircuitBreaker['getStats']>;
  } | null> {
    // Fast path: in-memory registry has the live breaker
    const entry = this.registry.get(targetKey);
    if (entry) {
      const stats = entry.breaker.getStats();
      return { state: stats.state, config: entry.config, stats };
    }

    // Slow path: read from DB sources (state + config)
    const memState = this.memoryStateStore.get(targetKey);
    if (memState) {
      return {
        state: memState.state,
        config: { failureThreshold: 5, recoveryTimeoutMs: 60000, successThreshold: 1 },
        stats: {
          state: memState.state,
          failureCount: memState.failureCount,
          successCount: memState.successCount,
          lastFailureTime: memState.lastFailureTime,
        },
      };
    }

    // Ultimate fallback: direct DB read
    const dbState = await safeQuery(
      () => this.stateRepo.findByTargetKey(targetKey),
      null,
      { fallback: null },
    );
    if (!dbState || !dbState.state) {
      return null;
    }

    const dbConfig = await safeQuery(
      () => this.configRepo.findByTargetKey(targetKey),
      null,
      { fallback: null },
    );

    return {
      state: dbState.state,
      config: dbConfig
        ? {
            failureThreshold: dbConfig.failureThreshold,
            recoveryTimeoutMs: dbConfig.recoveryTimeoutMs,
            successThreshold: dbConfig.successThreshold,
          }
        : { failureThreshold: 5, recoveryTimeoutMs: 60000, successThreshold: 1 },
      stats: {
        state: dbState.state,
        failureCount: dbState.failureCount,
        successCount: dbState.successCount,
        lastFailureTime: dbState.lastFailureTime,
      },
    };
  }

  /**
   * List all circuit breakers.
   * Merges memory registry with DB state; DB as authoritative only after initialize().
   */
  async listAll(): Promise<{
    targetKey: string;
    state: CircuitState;
    config: CircuitBreakerConfig;
    stats: ReturnType<CircuitBreaker['getStats']>;
  }[]> {
    if (this.dbAvailable) {
      // DB authoritative: fetch states from DB, merge with in-memory configs
      const allStates = await safeQuery(
        () => this.stateRepo.findAll(),
        [],
        { fallback: [] as CircuitBreakerStateEntity[] },
      );

      // Filter out malformed rows (state is required)
      const validStates = allStates.filter((s) => s.state);

      const results: any[] = [];
      for (const stateEntity of validStates) {
        const entry = this.registry.get(stateEntity.targetKey);
        results.push({
          targetKey: stateEntity.targetKey,
          state: stateEntity.state,
          config: entry?.config ?? {
            failureThreshold: 5,
            recoveryTimeoutMs: 60000,
            successThreshold: 1,
          },
          stats: {
            state: stateEntity.state,
            failureCount: stateEntity.failureCount,
            successCount: stateEntity.successCount,
            lastFailureTime: stateEntity.lastFailureTime,
          },
        });
      }

      // Include any registry entries not found in DB
      const dbKeys = new Set(validStates.map((s) => s.targetKey));
      for (const entry of this.registry.values()) {
        if (!dbKeys.has(entry.targetKey)) {
          const stats = entry.breaker.getStats();
          results.push({
            targetKey: entry.targetKey,
            state: stats.state,
            config: entry.config,
            stats,
          });
        }
      }

      return results;
    }

    // Memory-only path (before initialize or DB unavailable)
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

  private async _logStateChange(
    targetKey: string,
    fromState: CircuitState,
    toState: CircuitState,
    stats: ReturnType<CircuitBreaker['getStats']>,
  ): Promise<void> {
    await safeQuery(
      () => this.eventRepo.logEvent(targetKey, 'state_change', {
        fromState,
        toState,
        failureCount: stats.failureCount,
        successCount: stats.successCount,
        message: `Circuit ${fromState} → ${toState}`,
      }),
      undefined,
      { silent: true },
    );
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Best-effort async query wrapper.
 *
 * On any error (network, constraint violation, table missing, etc.),
 * silently falls back to the provided `fallback` value or void — never
 * throws.  This keeps circuit-breaking operational even when PostgreSQL
 * is down.
 */
async function safeQuery<T>(
  fn: () => Promise<T>,
  defaultValueOnError: T,
  opts?: {
    fallback?: T;
    silent?: boolean;
    logger?: { warn: (msg: string, err?: unknown) => void };
  },
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const fallback = (opts?.fallback as T) ?? defaultValueOnError;

    if (!opts?.silent) {
      const logger = opts?.logger ?? console;
      logger.warn('[CircuitBreakerService] DB query failed, using fallback', err);
    }

    return fallback;
  }
}
