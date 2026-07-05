/**
 * StageStateRepository - Database layer for stage runtime state persistence
 *
 * Stores the runtime state of individual stages within a pipeline run.
 * Used for crash recovery and stage-level observability.
 */

import { DatabasePool } from '../services/database';

export interface StageStateRecord {
  id: string;
  run_id: string;
  stage_id: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SaveStageStateInput {
  run_id: string;
  stage_id: string;
  status: string;
  started_at?: Date | null;
  completed_at?: Date | null;
  duration_ms?: number | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

export class StageStateRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * Save or update a stage state record (upsert by stage_id).
   */
  async save(input: SaveStageStateInput): Promise<StageStateRecord> {
    const {
      run_id,
      stage_id,
      status,
      started_at = null,
      completed_at = null,
      duration_ms = null,
      error = null,
      metadata = {},
    } = input;

    const result = await this.pool.query(
      `INSERT INTO stage_states (run_id, stage_id, status, started_at, completed_at, duration_ms, error, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (stage_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         started_at = COALESCE(EXCLUDED.started_at, stage_states.started_at),
         completed_at = EXCLUDED.completed_at,
         duration_ms = EXCLUDED.duration_ms,
         error = EXCLUDED.error,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [run_id, stage_id, status, started_at, completed_at, duration_ms, error, JSON.stringify(metadata)]
    );

    return result.rows[0];
  }

  /**
   * Find stage state by stage_id.
   */
  async findByStageId(stageId: string): Promise<StageStateRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM stage_states WHERE stage_id = $1',
      [stageId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all stage states for a given run_id.
   */
  async findByRunId(runId: string): Promise<StageStateRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM stage_states WHERE run_id = $1 ORDER BY created_at ASC',
      [runId]
    );
    return result.rows;
  }

  /**
   * Find all incomplete stage states for a given run_id.
   * Used for crash recovery to determine which stages need to be re-executed.
   */
  async findIncompleteByRunId(runId: string): Promise<StageStateRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM stage_states
       WHERE run_id = $1 AND status NOT IN ('success', 'failed', 'skipped')
       ORDER BY created_at ASC`,
      [runId]
    );
    return result.rows;
  }

  /**
   * Delete all stage state records for a given run_id.
   * Called after pipeline run completes for cleanup.
   */
  async deleteByRunId(runId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM stage_states WHERE run_id = $1',
      [runId]
    );
    return (result.rowCount || 0) > 0;
  }
}
