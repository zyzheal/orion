/**
 * TrafficManagerRepository - Database layer for canary traffic management
 *
 * Provides PostgreSQL persistence for traffic split configurations and
 * execution history, replacing the Map() in-memory storage.
 */

import { BaseRepository, FindAllResult } from '../db/base-repository';

// ==================== Traffic Config ====================

export interface TrafficConfigEntity {
  id: string;
  canary_id: string;
  strategy: string;
  host: string | null;
  namespace: string | null;
  upstream_name: string | null;
  phase: string | null;
  baseline_weight: number | null;
  canary_weight: number | null;
  baseline_destination: string | null;
  baseline_subset: string | null;
  canary_destination: string | null;
  canary_subset: string | null;
  servers: Record<string, any>[];
  created_at: Date;
  updated_at: Date;
}

export class TrafficConfigRepository extends BaseRepository<TrafficConfigEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'canary_traffic_configs');
  }

  async findByCanaryId(canaryId: string): Promise<TrafficConfigEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM canary_traffic_configs WHERE canary_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [canaryId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAll(): Promise<FindAllResult<TrafficConfigEntity>> {
    const result = await this.db.query(
      `SELECT * FROM canary_traffic_configs ORDER BY updated_at DESC`,
    );
    const entities = result.rows.map(row => this.mapRowToEntity(row));
    return { entities, total: entities.length };
  }

  async upsertConfig(input: {
    id: string;
    canary_id: string;
    strategy: string;
    phase?: string;
    host?: string;
    namespace?: string;
    upstream_name?: string;
    baseline_weight?: number;
    canary_weight?: number;
    baseline_destination?: string;
    baseline_subset?: string;
    canary_destination?: string;
    canary_subset?: string;
    servers?: Record<string, any>[];
  }): Promise<TrafficConfigEntity> {
    const result = await this.db.query(
      `INSERT INTO canary_traffic_configs
        (id, canary_id, strategy, host, namespace, upstream_name, phase,
         baseline_weight, canary_weight, baseline_destination, baseline_subset,
         canary_destination, canary_subset, servers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         strategy = EXCLUDED.strategy,
         host = EXCLUDED.host,
         namespace = EXCLUDED.namespace,
         upstream_name = EXCLUDED.upstream_name,
         phase = EXCLUDED.phase,
         baseline_weight = EXCLUDED.baseline_weight,
         canary_weight = EXCLUDED.canary_weight,
         baseline_destination = EXCLUDED.baseline_destination,
         baseline_subset = EXCLUDED.baseline_subset,
         canary_destination = EXCLUDED.canary_destination,
         canary_subset = EXCLUDED.canary_subset,
         servers = EXCLUDED.servers,
         updated_at = NOW()
       RETURNING *`,
      [
        input.id,
        input.canary_id,
        input.strategy,
        input.host || null,
        input.namespace || 'default',
        input.upstream_name || null,
        input.phase || 'initial',
        input.baseline_weight || null,
        input.canary_weight || null,
        input.baseline_destination || null,
        input.baseline_subset || null,
        input.canary_destination || null,
        input.canary_subset || null,
        JSON.stringify(input.servers || []),
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): TrafficConfigEntity {
    return {
      id: row.id,
      canary_id: row.canary_id,
      strategy: row.strategy,
      host: row.host,
      namespace: row.namespace,
      upstream_name: row.upstream_name,
      phase: row.phase,
      baseline_weight: row.baseline_weight,
      canary_weight: row.canary_weight,
      baseline_destination: row.baseline_destination,
      baseline_subset: row.baseline_subset,
      canary_destination: row.canary_destination,
      canary_subset: row.canary_subset,
      servers: row.servers || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Traffic Execution History ====================

export interface TrafficHistoryEntity {
  id: string;
  canary_id: string;
  success: boolean;
  result: string;
  error: string | null;
  executed_at: Date;
}

export class TrafficHistoryRepository extends BaseRepository<TrafficHistoryEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'canary_traffic_history');
  }

  async findByCanaryId(canaryId: string): Promise<TrafficHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM canary_traffic_history WHERE canary_id = $1 ORDER BY executed_at DESC`,
      [canaryId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findAll(): Promise<FindAllResult<TrafficHistoryEntity>> {
    const result = await this.db.query(
      `SELECT * FROM canary_traffic_history ORDER BY executed_at DESC`,
    );
    const entities = result.rows.map(row => this.mapRowToEntity(row));
    return { entities, total: entities.length };
  }

  async createEntry(input: {
    id: string;
    canary_id: string;
    success: boolean;
    result: string;
    error?: string;
  }): Promise<TrafficHistoryEntity> {
    const result = await this.db.query(
      `INSERT INTO canary_traffic_history
        (id, canary_id, success, result, error)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.id,
        input.canary_id,
        input.success,
        input.result,
        input.error || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): TrafficHistoryEntity {
    return {
      id: row.id,
      canary_id: row.canary_id,
      success: row.success,
      result: row.result,
      error: row.error,
      executed_at: row.executed_at,
    };
  }
}
