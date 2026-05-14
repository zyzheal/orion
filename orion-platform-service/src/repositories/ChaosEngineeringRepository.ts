/**
 * ChaosEngineeringRepository - PostgreSQL Repository for Chaos Experiment CRUD operations
 *
 * Maps to the `chaos_experiments` and `chaos_runs` tables defined in migration 147.
 */

import { DatabasePool } from '../services/database';
import { BaseRepository } from '../db/base-repository';

// ==================== Entity Interfaces ====================

export interface ChaosExperimentEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: string;
  service_id: string | null;
  environment: string;
  scope: Record<string, any>;
  faults: any[];
  steady_state_hypothesis: Record<string, any> | null;
  auto_rollback: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChaosRunEntity {
  id: string;
  experiment_id: string;
  tenant_id: string;
  status: string;
  dry_run: boolean;
  result: Record<string, any> | null;
  events: any[];
  error_message: string | null;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
}

// ==================== Input Interfaces ====================

export interface CreateExperimentInput {
  tenant_id: string;
  name: string;
  description?: string;
  service_id?: string;
  environment?: string;
  scope?: Record<string, any>;
  faults?: any[];
  steady_state_hypothesis?: Record<string, any>;
  auto_rollback?: boolean;
  created_by?: string | null;
}

export interface ChaosFault {
  type: string;
  target: string;
  config: Record<string, any>;
  duration_ms: number;
  delay_ms: number;
}

// ==================== ChaosExperimentRepository ====================

export class ChaosExperimentRepository extends BaseRepository<ChaosExperimentEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chaos_experiments');
  }

  /**
   * Find experiments by tenant ID with optional status filter
   */
  async findByTenant(
    tenantId: string,
    options?: { status?: string; limit?: number; offset?: number },
  ): Promise<ChaosExperimentEntity[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    let query = `SELECT * FROM chaos_experiments WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find experiment by name within a tenant
   */
  async findByName(tenantId: string, name: string): Promise<ChaosExperimentEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM chaos_experiments WHERE tenant_id = $1 AND name = $2`,
      [tenantId, name],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find experiments by service ID
   */
  async findByService(tenantId: string, serviceId: string): Promise<ChaosExperimentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM chaos_experiments WHERE tenant_id = $1 AND service_id = $2 ORDER BY created_at DESC`,
      [tenantId, serviceId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update experiment status
   */
  async updateStatus(id: string, status: string): Promise<ChaosExperimentEntity | null> {
    const result = await this.db.query(
      `UPDATE chaos_experiments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Get experiment count by status for a tenant
   */
  async getStats(tenantId: string): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT status, COUNT(*) as count FROM chaos_experiments WHERE tenant_id = $1 GROUP BY status`,
      [tenantId],
    );
    const stats: Record<string, number> = {};
    for (const row of result.rows) {
      stats[row.status] = parseInt(row.count, 10);
    }
    return stats;
  }

  protected mapRowToEntity(row: any): ChaosExperimentEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description || null,
      status: row.status || 'draft',
      service_id: row.service_id || null,
      environment: row.environment || 'staging',
      scope: row.scope || {},
      faults: row.faults || [],
      steady_state_hypothesis: row.steady_state_hypothesis || null,
      auto_rollback: row.auto_rollback ?? true,
      created_by: row.created_by || null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

// ==================== ChaosRunRepository ====================

export class ChaosRunRepository extends BaseRepository<ChaosRunEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chaos_runs');
  }

  /**
   * List runs for a specific experiment
   */
  async findByExperiment(
    experimentId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ChaosRunEntity[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const result = await this.db.query(
      `SELECT * FROM chaos_runs WHERE experiment_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [experimentId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find runs by tenant ID
   */
  async findByTenant(tenantId: string, options?: { limit?: number }): Promise<ChaosRunEntity[]> {
    const limit = options?.limit || 50;

    const result = await this.db.query(
      `SELECT * FROM chaos_runs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find the latest run for an experiment
   */
  async findLatestByExperiment(experimentId: string): Promise<ChaosRunEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM chaos_runs WHERE experiment_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [experimentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Create a new run
   */
  async createRun(
    experimentId: string,
    tenantId: string,
    options?: { dry_run?: boolean },
  ): Promise<ChaosRunEntity> {
    const result = await this.db.query(
      `INSERT INTO chaos_runs (experiment_id, tenant_id, status, dry_run)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [experimentId, tenantId, options?.dry_run ? 'dry_run' : 'pending', options?.dry_run ?? false],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update run status with timestamps
   */
  async updateStatus(
    id: string,
    status: string,
    options?: { started_at?: Date; ended_at?: Date; error_message?: string },
  ): Promise<ChaosRunEntity | null> {
    const result = await this.db.query(
      `UPDATE chaos_runs SET status = $1, started_at = $2, ended_at = $3, error_message = $4
       WHERE id = $5 RETURNING *`,
      [
        status,
        options?.started_at || null,
        options?.ended_at || null,
        options?.error_message || null,
        id,
      ],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Append an event to the run's events array
   */
  async addEvent(
    runId: string,
    event: { timestamp: Date; type: string; service?: string; details?: string },
  ): Promise<ChaosRunEntity | null> {
    const result = await this.db.query(
      `UPDATE chaos_runs SET events = events || $1::jsonb WHERE id = $2 RETURNING *`,
      [JSON.stringify([event]), runId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update run result
   */
  async updateResult(id: string, result: Record<string, any>): Promise<ChaosRunEntity | null> {
    const dbResult = await this.db.query(
      `UPDATE chaos_runs SET result = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(result), id],
    );
    if (dbResult.rows.length === 0) return null;
    return this.mapRowToEntity(dbResult.rows[0]);
  }

  /**
   * Get run count by status for an experiment
   */
  async getRunStats(experimentId: string): Promise<Record<string, number>> {
    const result = await this.db.query(
      `SELECT status, COUNT(*) as count FROM chaos_runs WHERE experiment_id = $1 GROUP BY status`,
      [experimentId],
    );
    const stats: Record<string, number> = {};
    for (const row of result.rows) {
      stats[row.status] = parseInt(row.count, 10);
    }
    return stats;
  }

  protected mapRowToEntity(row: any): ChaosRunEntity {
    return {
      id: row.id,
      experiment_id: row.experiment_id,
      tenant_id: row.tenant_id,
      status: row.status || 'pending',
      dry_run: row.dry_run ?? false,
      result: row.result || null,
      events: row.events || [],
      error_message: row.error_message || null,
      started_at: row.started_at ? new Date(row.started_at) : null,
      ended_at: row.ended_at ? new Date(row.ended_at) : null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

export default ChaosExperimentRepository;
