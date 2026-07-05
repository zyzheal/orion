/**
 * PipelineExecutionRepository - PostgreSQL persistence for PipelineEngine execution state
 *
 * Persists the in-memory PipelineEngine.executions Map to PostgreSQL
 * to enable crash recovery of in-flight pipeline executions.
 */

import { PipelineRunStatus } from '../models/PipelineRun';

export interface PipelineExecutionRecord {
  run_id: string;
  pipeline_id: string;
  tenant_id: string;
  status: string;
  pending_stages: string[];
  running_stages: string[];
  completed_stages: string[];
  created_at: Date;
  updated_at: Date;
}

export class PipelineExecutionRepository {
  constructor(
    private pool: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
    }
  ) {}

  // ==================== CRUD ====================

  async save(record: {
    runId: string;
    pipelineId: string;
    tenantId: string;
    status: PipelineRunStatus;
    pendingStages: string[];
    runningStages: string[];
    completedStages: string[];
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO pipeline_executions
        (run_id, pipeline_id, tenant_id, status, pending_stages, running_stages, completed_stages, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (run_id) DO UPDATE SET
        status = EXCLUDED.status,
        pending_stages = EXCLUDED.pending_stages,
        running_stages = EXCLUDED.running_stages,
        completed_stages = EXCLUDED.completed_stages,
        updated_at = NOW()`,
      [
        record.runId,
        record.pipelineId,
        record.tenantId,
        record.status,
        JSON.stringify(record.pendingStages),
        JSON.stringify(record.runningStages),
        JSON.stringify(record.completedStages),
      ]
    );
  }

  async findByRunId(runId: string): Promise<PipelineExecutionRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_executions WHERE run_id = $1',
      [runId]
    );
    if (result.rows[0]) {
      return this.mapRow(result.rows[0]);
    }
    return null;
  }

  async findByTenant(tenantId: string): Promise<PipelineExecutionRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM pipeline_executions
       WHERE tenant_id = $1 AND status IN ('running', 'pending')
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async findByStatus(status: string): Promise<PipelineExecutionRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM pipeline_executions
       WHERE status = $1
       ORDER BY created_at DESC`,
      [status]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async delete(runId: string): Promise<void> {
    await this.pool.query('DELETE FROM pipeline_executions WHERE run_id = $1', [runId]);
  }

  // ==================== Mapping ====================

  private mapRow(row: any): PipelineExecutionRecord {
    return {
      run_id: row.run_id,
      pipeline_id: row.pipeline_id,
      tenant_id: row.tenant_id,
      status: row.status,
      pending_stages: Array.isArray(row.pending_stages) ? row.pending_stages : [],
      running_stages: Array.isArray(row.running_stages) ? row.running_stages : [],
      completed_stages: Array.isArray(row.completed_stages) ? row.completed_stages : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
