/**
 * TriggerRepository
 * Data access layer for pipeline triggers and execution history.
 * Supports trigger persistence for GAP-11 (previously in-memory only).
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { OrionError } from '../errors';

/**
 * Trigger entity mapped from pipeline_triggers table.
 */
export interface TriggerEntity {
  id: string;
  tenantId: string;
  pipelineId: string;
  type: string;
  config: Record<string, unknown>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Trigger execution record entity mapped from pipeline_trigger_executions table.
 */
export interface TriggerExecutionEntity {
  id: string;
  triggerId: string;
  runId: string | null;
  status: string;
  contextJson: Record<string, unknown>;
  createdAt: Date;
  executedAt: Date;
}

export class TriggerRepository extends BaseRepository<TriggerEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'pipeline_triggers');
  }

  /**
   * Override create to map entity properties to database column names.
   * Entity uses camelCase (type, config), DB uses snake_case (trigger_type, trigger_config).
   */
  async create(data: Omit<TriggerEntity, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<TriggerEntity, 'id'>>): Promise<TriggerEntity> {
    const columns = ['tenant_id', 'pipeline_id', 'trigger_type', 'trigger_config', 'status'];
    const values = [data.tenantId, data.pipelineId, data.type, data.config, data.status];

    if (data.id !== undefined) {
      columns.unshift('id');
      values.unshift(data.id);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO pipeline_triggers (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `INSERT into pipeline_triggers returned no rows`)
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all triggers for a specific tenant.
   */
  async findByTenant(tenantId: string): Promise<TriggerEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_triggers WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all triggers for a specific tenant and pipeline.
   */
  async findByPipeline(tenantId: string, pipelineId: string): Promise<TriggerEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_triggers WHERE tenant_id = $1 AND pipeline_id = $2 ORDER BY created_at DESC`,
      [tenantId, pipelineId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all active triggers (used on startup to re-hydrate in-memory state).
   */
  async findActiveTriggers(): Promise<TriggerEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_triggers WHERE status = 'active' ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update trigger status only (used by service to persist status changes).
   */
  async updateStatus(id: string, status: string): Promise<TriggerEntity> {
    const result = await this.db.query(
      `UPDATE pipeline_triggers SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `UPDATE on pipeline_triggers affected no rows (id: ${id})`)
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update trigger type and config (used by service to persist trigger updates).
   */
  async updateTriggerConfig(id: string, type: string, config: Record<string, unknown>): Promise<TriggerEntity> {
    const result = await this.db.query(
      `UPDATE pipeline_triggers SET trigger_type = $1, trigger_config = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [type, config, id],
    );
    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `UPDATE on pipeline_triggers affected no rows (id: ${id})`)
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * List triggers with pagination.
   */
  async list(options: FindAllOptions = {}): Promise<FindAllResult<TriggerEntity>> {
    return this.findAll(options);
  }

  protected mapRowToEntity(row: any): TriggerEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pipelineId: row.pipeline_id,
      type: row.trigger_type,
      config: row.trigger_config ?? {},
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ==================== Execution Record Methods ====================

  /**
   * Save a trigger execution record.
   */
  async saveExecutionRecord(record: any): Promise<TriggerExecutionEntity> {
    const result = await this.db.query(
      `INSERT INTO pipeline_trigger_executions (id, trigger_id, run_id, status, context_json, executed_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [record.id, record.triggerId, record.runId ?? null, record.status, record.contextJson ?? {}, record.executedAt],
    );
    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', `INSERT into pipeline_trigger_executions returned no rows`)
    }
    return this.mapExecutionRowToEntity(result.rows[0]);
  }

  /**
   * Find execution history for a specific trigger, ordered by execution time.
   */
  async findExecutionHistory(triggerId: string): Promise<TriggerExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_trigger_executions WHERE trigger_id = $1 ORDER BY executed_at DESC`,
      [triggerId],
    );
    return result.rows.map(row => this.mapExecutionRowToEntity(row));
  }

  /**
   * Find recent failures for a trigger within a time window.
   * Used to determine if a trigger should be marked as failed after consecutive failures.
   */
  async findRecentFailures(triggerId: string, since: Date): Promise<TriggerExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_trigger_executions
       WHERE trigger_id = $1 AND status = 'failed' AND executed_at >= $2
       ORDER BY executed_at DESC`,
      [triggerId, since],
    );
    return result.rows.map(row => this.mapExecutionRowToEntity(row));
  }

  protected mapExecutionRowToEntity(row: any): TriggerExecutionEntity {
    return {
      id: row.id,
      triggerId: row.trigger_id,
      runId: row.run_id ?? null,
      status: row.status,
      contextJson: row.context_json ?? {},
      createdAt: row.created_at,
      executedAt: row.executed_at,
    };
  }

  // Public methods for testing (expose protected mappers)
  mapRowToEntityPublic(row: any): TriggerEntity {
    return this.mapRowToEntity(row);
  }

  mapExecutionRowToEntityPublic(row: any): TriggerExecutionEntity {
    return this.mapExecutionRowToEntity(row);
  }
}
