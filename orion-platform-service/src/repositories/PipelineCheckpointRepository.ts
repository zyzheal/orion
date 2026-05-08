/**
 * PipelineCheckpointRepository - Database layer for pipeline execution checkpoints
 *
 * Stores serialized execution state for crash recovery and startup restoration.
 * Each pipeline run has at most one active checkpoint (run_id is UNIQUE).
 */

import { DatabasePool } from '../services/database';

export interface PipelineCheckpointRecord {
  id: string;
  run_id: string;
  pipeline_id: string;
  checkpoint_data: Record<string, any>;
  status: string;
  last_stage_name: string | null;
  last_task_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCheckpointInput {
  run_id: string;
  pipeline_id: string;
  checkpoint_data: Record<string, any>;
  status: string;
  last_stage_name?: string;
  last_task_name?: string;
}

export class PipelineCheckpointRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * Save or update a checkpoint for a given run_id.
   * Uses INSERT ... ON CONFLICT (run_id) DO UPDATE to upsert.
   */
  async saveCheckpoint(input: CreateCheckpointInput): Promise<PipelineCheckpointRecord> {
    const { run_id, pipeline_id, checkpoint_data, status, last_stage_name, last_task_name } = input;

    const result = await this.pool.query(
      `INSERT INTO pipeline_checkpoints (run_id, pipeline_id, checkpoint_data, status, last_stage_name, last_task_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (run_id)
       DO UPDATE SET
         checkpoint_data = EXCLUDED.checkpoint_data,
         status = EXCLUDED.status,
         last_stage_name = EXCLUDED.last_stage_name,
         last_task_name = EXCLUDED.last_task_name,
         updated_at = NOW()
       RETURNING *`,
      [run_id, pipeline_id, JSON.stringify(checkpoint_data), status, last_stage_name || null, last_task_name || null]
    );

    return result.rows[0];
  }

  /**
   * Find checkpoint by run_id
   */
  async findByRunId(runId: string): Promise<PipelineCheckpointRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_checkpoints WHERE run_id = $1',
      [runId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all checkpoints with a specific status (used for startup recovery)
   */
  async findAllByStatus(status: string): Promise<PipelineCheckpointRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_checkpoints WHERE status = $1 ORDER BY updated_at DESC',
      [status]
    );
    return result.rows;
  }

  /**
   * Delete checkpoint by run_id (cleanup after pipeline completion)
   */
  async deleteByRunId(runId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM pipeline_checkpoints WHERE run_id = $1',
      [runId]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Find checkpoints by pipeline_id (for audit/history)
   */
  async findByPipelineId(pipelineId: string, limit = 50): Promise<PipelineCheckpointRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_checkpoints WHERE pipeline_id = $1 ORDER BY updated_at DESC LIMIT $2',
      [pipelineId, limit]
    );
    return result.rows;
  }

  /**
   * Count checkpoints by status
   */
  async countByStatus(status: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM pipeline_checkpoints WHERE status = $1',
      [status]
    );
    return parseInt(result.rows[0].count, 10);
  }
}
