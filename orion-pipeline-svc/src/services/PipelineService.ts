import type { Pool } from 'pg';

export interface PipelineStage {
  name: string;
  type: string;
  command: string;
  dependsOn: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
  continueOnError: boolean;
}

export interface PipelineTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  cron?: string;
  events?: string[];
}

export interface CreatePipelineInput {
  name: string;
  description?: string;
  stages: PipelineStage[];
  triggers?: PipelineTrigger[];
  envTemplate?: Record<string, string>;
}

export interface PipelineListOptions {
  projectId?: string;
  status?: string;
  limit: number;
  offset: number;
}

export class PipelineService {
  constructor(private pool: Pool) {}

  async create(input: CreatePipelineInput): Promise<{ id: string; name: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO pipelines (name, description, stages, triggers, env_template, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, name',
        [input.name, input.description || '', JSON.stringify(input.stages), JSON.stringify(input.triggers || []), JSON.stringify(input.envTemplate || {})]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async list(options: PipelineListOptions): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT id, name, description, created_at, updated_at FROM pipelines WHERE ($1::text IS NULL OR project_id = $1) AND ($2::text IS NULL OR status = $2) ORDER BY created_at DESC LIMIT $3 OFFSET $4',
      [options.projectId || null, options.status || null, options.limit, options.offset]
    );
    return result.rows;
  }

  async getById(id: string): Promise<any> {
    const result = await this.pool.query('SELECT * FROM pipelines WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async update(id: string, input: Partial<CreatePipelineInput>): Promise<any> {
    const result = await this.pool.query(
      'UPDATE pipelines SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = NOW() WHERE id = $3 RETURNING *',
      [input.name, input.description, id]
    );
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM pipelines WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async run(pipelineId: string, options?: { envOverrides?: Record<string, string>; stages?: string[] }): Promise<any> {
    const result = await this.pool.query(
      "INSERT INTO pipeline_runs (pipeline_id, status, env_overrides, started_at) VALUES ($1, 'running', $2, NOW()) RETURNING *",
      [pipelineId, JSON.stringify(options?.envOverrides || {})]
    );
    return result.rows[0];
  }

  async listRuns(pipelineId: string): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_runs WHERE pipeline_id = $1 ORDER BY started_at DESC',
      [pipelineId]
    );
    return result.rows;
  }

  async getRun(pipelineId: string, runId: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM pipeline_runs WHERE id = $1 AND pipeline_id = $2',
      [runId, pipelineId]
    );
    return result.rows[0] || null;
  }

  async cancelRun(pipelineId: string, runId: string): Promise<any> {
    const result = await this.pool.query(
      "UPDATE pipeline_runs SET status = 'cancelled', completed_at = NOW() WHERE id = $1 AND pipeline_id = $2 AND status = 'running' RETURNING *",
      [runId, pipelineId]
    );
    return result.rows[0] || null;
  }
}
