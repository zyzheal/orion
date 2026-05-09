/**
 * SubPipelineRepository - Database layer for sub-pipeline invocations
 *
 * Tracks invocations of child pipelines as sub-pipeline stages
 * within parent pipeline runs. Enables reusable workflow composition.
 */

import { DatabasePool } from '../services/database';

export interface SubPipelineRecord {
  id: string;
  parent_run_id: string;
  child_pipeline_id: string;
  child_run_id: string | null;
  status: string;
  input_params: Record<string, any>;
  output_results: Record<string, any>;
  stage_name: string;
  output_mapping: Record<string, any>;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface CreateSubPipelineInput {
  parent_run_id: string;
  child_pipeline_id: string;
  input_params: Record<string, any>;
  stage_name: string;
  output_mapping?: Record<string, any>;
}

export class SubPipelineRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * Create a new sub-pipeline invocation record
   */
  async create(input: CreateSubPipelineInput): Promise<SubPipelineRecord> {
    const result = await this.pool.query(
      `INSERT INTO sub_pipeline_invocations
        (parent_run_id, child_pipeline_id, input_params, stage_name, output_mapping, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [
        input.parent_run_id,
        input.child_pipeline_id,
        JSON.stringify(input.input_params),
        input.stage_name,
        JSON.stringify(input.output_mapping || {}),
      ]
    );
    return result.rows[0];
  }

  /**
   * Find sub-pipeline invocation by ID
   */
  async findById(id: string): Promise<SubPipelineRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM sub_pipeline_invocations WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all sub-pipeline invocations for a parent run
   */
  async findByParentRunId(parentRunId: string): Promise<SubPipelineRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM sub_pipeline_invocations WHERE parent_run_id = $1 ORDER BY created_at',
      [parentRunId]
    );
    return result.rows;
  }

  /**
   * Find sub-pipeline invocation by child run ID
   */
  async findByChildRunId(childRunId: string): Promise<SubPipelineRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM sub_pipeline_invocations WHERE child_run_id = $1',
      [childRunId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all sub-pipeline invocations for a child pipeline definition
   */
  async findByPipelineId(childPipelineId: string, limit = 50): Promise<SubPipelineRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM sub_pipeline_invocations WHERE child_pipeline_id = $1 ORDER BY created_at DESC LIMIT $2',
      [childPipelineId, limit]
    );
    return result.rows;
  }

  /**
   * Update sub-pipeline invocation with child run ID and status
   */
  async updateChildRun(id: string, childRunId: string, status: string): Promise<SubPipelineRecord | null> {
    const result = await this.pool.query(
      `UPDATE sub_pipeline_invocations
       SET child_run_id = $1, status = $2
       WHERE id = $3
       RETURNING *`,
      [childRunId, status, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update sub-pipeline invocation status
   */
  async updateStatus(
    id: string,
    status: string,
    outputResults?: Record<string, any>,
    errorMessage?: string
  ): Promise<SubPipelineRecord | null> {
    const setClauses: string[] = ['status = $1'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (outputResults !== undefined) {
      params.push(JSON.stringify(outputResults));
      setClauses.push(`output_results = $${paramIndex++}`);
    }

    if (errorMessage !== undefined) {
      params.push(errorMessage);
      setClauses.push(`error_message = $${paramIndex++}`);
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      setClauses.push(`completed_at = NOW()`);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE sub_pipeline_invocations
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a sub-pipeline invocation
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM sub_pipeline_invocations WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Count sub-pipeline invocations by status
   */
  async countByStatus(status: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM sub_pipeline_invocations WHERE status = $1',
      [status]
    );
    return parseInt(result.rows[0].count, 10);
  }
}
