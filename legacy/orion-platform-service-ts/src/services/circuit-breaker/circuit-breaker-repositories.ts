/**
 * Circuit Breaker Repositories
 * Configuration, State, and Event persistence for circuit breakers.
 */

import { BaseRepository } from '../../db/base-repository';

// ─── Entity Definitions ────────────────────────────────────────────────────

export interface CircuitBreakerConfigEntity {
  id: string;
  targetKey: string;
  description: string | null;
  failureThreshold: number;
  recoveryTimeoutMs: number;
  successThreshold: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CircuitBreakerStateEntity {
  id: string;
  targetKey: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  lastStateChange: Date;
  updatedAt: Date;
}

export type CircuitBreakerEventType =
  | 'state_change'
  | 'failure'
  | 'success'
  | 'manual_trip'
  | 'manual_reset'
  | 'config_change';

export interface CircuitBreakerEventEntity {
  id: string;
  targetKey: string;
  eventType: CircuitBreakerEventType;
  fromState: string | null;
  toState: string | null;
  failureCount: number | null;
  successCount: number | null;
  message: string | null;
  createdAt: Date;
}

// ─── Config Repository ─────────────────────────────────────────────────────

export class CircuitBreakerConfigRepository extends BaseRepository<CircuitBreakerConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'circuit_breaker_configs');
  }

  async findByTargetKey(targetKey: string): Promise<CircuitBreakerConfigEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM circuit_breaker_configs WHERE target_key = $1`,
      [targetKey],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findEnabled(): Promise<CircuitBreakerConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM circuit_breaker_configs WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async upsertByTargetKey(
    targetKey: string,
    config: Partial<CircuitBreakerConfigEntity>,
  ): Promise<CircuitBreakerConfigEntity> {
    const {
      description = null,
      failureThreshold = 5,
      recoveryTimeoutMs = 60000,
      successThreshold = 1,
      enabled = true,
    } = config;

    const result = await this.db.query(
      `INSERT INTO circuit_breaker_configs
       (target_key, description, failure_threshold, recovery_timeout_ms, success_threshold, enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (target_key)
       DO UPDATE SET
         description = EXCLUDED.description,
         failure_threshold = EXCLUDED.failure_threshold,
         recovery_timeout_ms = EXCLUDED.recovery_timeout_ms,
         success_threshold = EXCLUDED.success_threshold,
         enabled = EXCLUDED.enabled,
         updated_at = NOW()
       RETURNING *`,
      [targetKey, description, failureThreshold, recoveryTimeoutMs, successThreshold, enabled],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): CircuitBreakerConfigEntity {
    return {
      id: row.id,
      targetKey: row.target_key,
      description: row.description,
      failureThreshold: row.failure_threshold,
      recoveryTimeoutMs: row.recovery_timeout_ms,
      successThreshold: row.success_threshold,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ─── State Repository ──────────────────────────────────────────────────────

export class CircuitBreakerStateRepository extends BaseRepository<CircuitBreakerStateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'circuit_breaker_states');
  }

  async findByTargetKey(targetKey: string): Promise<CircuitBreakerStateEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM circuit_breaker_states WHERE target_key = $1`,
      [targetKey],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByState(state: 'closed' | 'open' | 'half-open'): Promise<CircuitBreakerStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM circuit_breaker_states WHERE state = $1 ORDER BY last_state_change DESC`,
      [state],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  // @ts-ignore - Override with different return type
  async findAll(options?: any): Promise<CircuitBreakerStateEntity[] | any> {
    if (options) {
      // Called with options, check if it's a filter
      const { where, limit, offset } = options;
      let query = 'SELECT * FROM circuit_breaker_states';
      const values: any[] = [];
      const conditions: string[] = [];

      if (where) {
        Object.keys(where).forEach(key => {
          values.push(where[key]);
          conditions.push(`${key} = $${values.length}`);
        });
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      query += ` ORDER BY target_key`;
      if (limit) { values.push(limit); query += ` LIMIT $${values.length}`; }
      if (offset) { values.push(offset); query += ` OFFSET $${values.length}`; }

      const result = await this.db.query(query, values);
      const entities = result.rows.map((row) => this.mapRowToEntity(row));
      return { entities, total: entities.length };
    }
    const result = await this.db.query(
      `SELECT * FROM circuit_breaker_states ORDER BY target_key`,
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async upsertState(
    targetKey: string,
    state: 'closed' | 'open' | 'half-open',
    failureCount: number,
    successCount: number,
    lastFailureTime: Date | null,
    lastSuccessTime: Date | null,
  ): Promise<CircuitBreakerStateEntity> {
    const result = await this.db.query(
      `INSERT INTO circuit_breaker_states
       (target_key, state, failure_count, success_count, last_failure_time, last_success_time, last_state_change, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (target_key)
       DO UPDATE SET
         state = EXCLUDED.state,
         failure_count = EXCLUDED.failure_count,
         success_count = EXCLUDED.success_count,
         last_failure_time = EXCLUDED.last_failure_time,
         last_success_time = EXCLUDED.last_success_time,
         last_state_change = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [targetKey, state, failureCount, successCount, lastFailureTime, lastSuccessTime],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async resetState(targetKey: string): Promise<CircuitBreakerStateEntity> {
    const result = await this.db.query(
      `UPDATE circuit_breaker_states
       SET state = 'closed', failure_count = 0, success_count = 0,
           last_failure_time = NULL, last_success_time = NULL,
           last_state_change = NOW(), updated_at = NOW()
       WHERE target_key = $1
       RETURNING *`,
      [targetKey],
    );
    return result.rows.length > 0
      ? this.mapRowToEntity(result.rows[0])
      : this.upsertState(targetKey, 'closed', 0, 0, null, null);
  }

  protected mapRowToEntity(row: any): CircuitBreakerStateEntity {
    return {
      id: row.id,
      targetKey: row.target_key,
      state: row.state,
      failureCount: row.failure_count,
      successCount: row.success_count,
      lastFailureTime: row.last_failure_time,
      lastSuccessTime: row.last_success_time,
      lastStateChange: row.last_state_change,
      updatedAt: row.updated_at,
    };
  }
}

// ─── Event Repository ──────────────────────────────────────────────────────

export class CircuitBreakerEventRepository extends BaseRepository<CircuitBreakerEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'circuit_breaker_events');
  }

  async logEvent(
    targetKey: string,
    eventType: CircuitBreakerEventType,
    options: {
      fromState?: string | null;
      toState?: string | null;
      failureCount?: number | null;
      successCount?: number | null;
      message?: string | null;
    } = {},
  ): Promise<CircuitBreakerEventEntity> {
    const result = await this.db.query(
      `INSERT INTO circuit_breaker_events
       (target_key, event_type, from_state, to_state, failure_count, success_count, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        targetKey,
        eventType,
        options.fromState ?? null,
        options.toState ?? null,
        options.failureCount ?? null,
        options.successCount ?? null,
        options.message ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTargetKey(targetKey: string, limit = 50): Promise<CircuitBreakerEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM circuit_breaker_events
       WHERE target_key = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [targetKey, limit],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async countByEventType(eventType: CircuitBreakerEventType, since?: Date): Promise<number> {
    const params: unknown[] = [eventType];
    let query = `SELECT COUNT(*) FROM circuit_breaker_events WHERE event_type = $1`;
    if (since) {
      params.push(since);
      query += ` AND created_at >= $2`;
    }
    const result = await this.db.query(query, params);
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  protected mapRowToEntity(row: any): CircuitBreakerEventEntity {
    return {
      id: row.id,
      targetKey: row.target_key,
      eventType: row.event_type,
      fromState: row.from_state,
      toState: row.to_state,
      failureCount: row.failure_count,
      successCount: row.success_count,
      message: row.message,
      createdAt: row.created_at,
    };
  }
}
