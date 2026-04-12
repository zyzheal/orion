/**
 * CI/CD Repository - CI/CD 资源数据访问层
 */

import { DatabasePool } from '../database';

export interface CICDPipeline {
  id: string;
  tenantId: bigint;
  name: string;
  description?: string;
  provider: string;
  namespace?: string;
  pipelineName?: string;
  status: string;
  lastRunId?: string;
  lastRunStatus?: string;
  lastRunDurationMs?: number;
  lastRunAt?: Date;
  totalRuns: number;
  successRate?: number;
  labels: Record<string, string>;
  spec: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CICDPipelineRun {
  id: string;
  tenantId: bigint;
  pipelineId?: string;
  name: string;
  uid: string;
  namespace?: string;
  pipelineRef?: string;
  status: string;
  startTime?: Date;
  endTime?: Date;
  durationMs?: number;
  triggeredBy?: string;
  triggerReason?: string;
  gitCommit?: string;
  gitBranch?: string;
  gitRepository?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  statusJson: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CICDTaskRun {
  id: string;
  tenantId: bigint;
  pipelineRunId: string;
  name: string;
  uid: string;
  taskRef?: string;
  status: string;
  startTime?: Date;
  endTime?: Date;
  durationMs?: number;
  podName?: string;
  containerName?: string;
  retryCount: number;
  reason?: string;
  message?: string;
  logPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CICDFilters {
  tenantId: bigint;
  pipelineId?: string;
  status?: string;
  labels?: Record<string, string>;
  limit?: number;
  offset?: number;
}

export interface CICDListResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export class CICDRepository {
  private database: DatabasePool;

  constructor(database: DatabasePool) {
    this.database = database;
  }

  // ==================== Pipeline ====================

  /**
   * 创建流水线
   */
  async createPipeline(input: {
    tenantId: bigint;
    name: string;
    description?: string;
    provider?: string;
    namespace?: string;
    pipelineName?: string;
    labels?: Record<string, string>;
    spec?: Record<string, any>;
    createdBy: string;
  }): Promise<CICDPipeline> {
    const query = `
      INSERT INTO cmdb_cicd_pipeline (
        tenant_id, name, description, provider, namespace, pipeline_name,
        labels, spec, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const params = [
      input.tenantId.toString(),
      input.name,
      input.description || null,
      input.provider || 'tekton',
      input.namespace || null,
      input.pipelineName || null,
      JSON.stringify(input.labels || {}),
      JSON.stringify(input.spec || {}),
      input.createdBy,
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToPipeline(result.rows[0]);
  }

  /**
   * 更新流水线状态
   */
  async updatePipelineStatus(
    id: string,
    status: string,
    lastRunId?: string,
    lastRunStatus?: string,
    lastRunDurationMs?: number,
    lastRunAt?: Date
  ): Promise<CICDPipeline | null> {
    const query = `
      UPDATE cmdb_cicd_pipeline
      SET status = $1,
          last_run_id = $2,
          last_run_status = $3,
          last_run_duration_ms = $4,
          last_run_at = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.database.query(query, [
      status,
      lastRunId || null,
      lastRunStatus || null,
      lastRunDurationMs || null,
      lastRunAt || null,
      id,
    ]);

    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToPipeline(result.rows[0]);
  }

  /**
   * 获取流水线列表
   */
  async listPipelines(filters: CICDFilters): Promise<CICDListResponse<CICDPipeline>> {
    const whereClauses: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    whereClauses.push(`tenant_id = $${paramIndex++}`);
    params.push(filters.tenantId.toString());

    if (filters.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const whereClause = whereClauses.join(' AND ');
    const countQuery = `SELECT COUNT(*) as total FROM cmdb_cicd_pipeline WHERE ${whereClause}`;
    const countResult = await this.database.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const dataQuery = `
      SELECT * FROM cmdb_cicd_pipeline
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.database.query(dataQuery, params);
    return {
      data: result.rows.map((row: any) => this.mapRowToPipeline(row)),
      total,
      limit,
      offset,
    };
  }

  /**
   * 获取流水线详情
   */
  async getPipelineById(id: string, tenantId: bigint): Promise<CICDPipeline | null> {
    const query = `
      SELECT * FROM cmdb_cicd_pipeline
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id, tenantId.toString()]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToPipeline(result.rows[0]);
  }

  /**
   * 删除流水线（软删除）
   */
  async deletePipeline(id: string): Promise<boolean> {
    const query = `
      UPDATE cmdb_cicd_pipeline
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ==================== PipelineRun ====================

  /**
   * 创建 PipelineRun
   */
  async createPipelineRun(input: {
    tenantId: bigint;
    pipelineId?: string;
    name: string;
    uid: string;
    namespace?: string;
    pipelineRef?: string;
    status?: string;
    triggeredBy?: string;
    triggerReason?: string;
    gitCommit?: string;
    gitBranch?: string;
    gitRepository?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  }): Promise<CICDPipelineRun> {
    const query = `
      INSERT INTO cmdb_cicd_pipeline_run (
        tenant_id, pipeline_id, name, uid, namespace, pipeline_ref,
        status, triggered_by, trigger_reason, git_commit, git_branch, git_repository,
        labels, annotations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const params = [
      input.tenantId.toString(),
      input.pipelineId || null,
      input.name,
      input.uid,
      input.namespace || null,
      input.pipelineRef || null,
      input.status || 'pending',
      input.triggeredBy || null,
      input.triggerReason || null,
      input.gitCommit || null,
      input.gitBranch || null,
      input.gitRepository || null,
      JSON.stringify(input.labels || {}),
      JSON.stringify(input.annotations || {}),
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToPipelineRun(result.rows[0]);
  }

  /**
   * 更新 PipelineRun 状态
   */
  async updatePipelineRunStatus(
    id: string,
    status: string,
    startTime?: Date,
    endTime?: Date,
    durationMs?: number
  ): Promise<CICDPipelineRun | null> {
    const updates: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (startTime) {
      updates.push(`start_time = $${paramIndex++}`);
      params.push(startTime);
    }
    if (endTime) {
      updates.push(`end_time = $${paramIndex++}`);
      params.push(endTime);
    }
    if (durationMs !== undefined) {
      updates.push(`duration_ms = $${paramIndex++}`);
      params.push(durationMs);
    }

    params.push(id);

    const query = `
      UPDATE cmdb_cicd_pipeline_run
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.database.query(query, params);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToPipelineRun(result.rows[0]);
  }

  /**
   * 获取 PipelineRun 列表
   */
  async listPipelineRuns(filters: CICDFilters): Promise<CICDListResponse<CICDPipelineRun>> {
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    whereClauses.push(`tenant_id = $${paramIndex++}`);
    params.push(filters.tenantId.toString());

    if (filters.pipelineId) {
      whereClauses.push(`pipeline_id = $${paramIndex++}`);
      params.push(filters.pipelineId);
    }
    if (filters.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const whereClause = whereClauses.join(' AND ');
    const countQuery = `SELECT COUNT(*) as total FROM cmdb_cicd_pipeline_run WHERE ${whereClause}`;
    const countResult = await this.database.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const dataQuery = `
      SELECT * FROM cmdb_cicd_pipeline_run
      WHERE ${whereClause}
      ORDER BY start_time DESC NULLS LAST, created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.database.query(dataQuery, params);
    return {
      data: result.rows.map((row: any) => this.mapRowToPipelineRun(row)),
      total,
      limit,
      offset,
    };
  }

  /**
   * 获取 PipelineRun 详情
   */
  async getPipelineRunById(id: string): Promise<CICDPipelineRun | null> {
    const query = `
      SELECT * FROM cmdb_cicd_pipeline_run
      WHERE id = $1
    `;

    const result = await this.database.query(query, [id]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToPipelineRun(result.rows[0]);
  }

  // ==================== TaskRun ====================

  /**
   * 创建 TaskRun
   */
  async createTaskRun(input: {
    tenantId: bigint;
    pipelineRunId: string;
    name: string;
    uid: string;
    taskRef?: string;
    status?: string;
  }): Promise<CICDTaskRun> {
    const query = `
      INSERT INTO cmdb_cicd_task_run (
        tenant_id, pipeline_run_id, name, uid, task_ref, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const params = [
      input.tenantId.toString(),
      input.pipelineRunId,
      input.name,
      input.uid,
      input.taskRef || null,
      input.status || 'pending',
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToTaskRun(result.rows[0]);
  }

  /**
   * 更新 TaskRun 状态
   */
  async updateTaskRunStatus(
    id: string,
    status: string,
    startTime?: Date,
    endTime?: Date,
    durationMs?: number,
    podName?: string,
    reason?: string,
    message?: string
  ): Promise<CICDTaskRun | null> {
    const updates: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (startTime) {
      updates.push(`start_time = $${paramIndex++}`);
      params.push(startTime);
    }
    if (endTime) {
      updates.push(`end_time = $${paramIndex++}`);
      params.push(endTime);
    }
    if (durationMs !== undefined) {
      updates.push(`duration_ms = $${paramIndex++}`);
      params.push(durationMs);
    }
    if (podName) {
      updates.push(`pod_name = $${paramIndex++}`);
      params.push(podName);
    }
    if (reason) {
      updates.push(`reason = $${paramIndex++}`);
      params.push(reason);
    }
    if (message) {
      updates.push(`message = $${paramIndex++}`);
      params.push(message);
    }

    params.push(id);

    const query = `
      UPDATE cmdb_cicd_task_run
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.database.query(query, params);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToTaskRun(result.rows[0]);
  }

  /**
   * 获取 TaskRun 列表
   */
  async listTaskRuns(pipelineRunId: string): Promise<CICDTaskRun[]> {
    const query = `
      SELECT * FROM cmdb_cicd_task_run
      WHERE pipeline_run_id = $1
      ORDER BY created_at ASC
    `;

    const result = await this.database.query(query, [pipelineRunId]);
    return result.rows.map((row: any) => this.mapRowToTaskRun(row));
  }

  // ==================== Mappers ====================

  private mapRowToPipeline(row: any): CICDPipeline {
    return {
      id: row.id,
      tenantId: BigInt(row.tenant_id),
      name: row.name,
      description: row.description,
      provider: row.provider,
      namespace: row.namespace,
      pipelineName: row.pipeline_name,
      status: row.status,
      lastRunId: row.last_run_id,
      lastRunStatus: row.last_run_status,
      lastRunDurationMs: row.last_run_duration_ms,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
      totalRuns: row.total_runs,
      successRate: row.success_rate ? parseFloat(row.success_rate) : undefined,
      labels: row.labels || {},
      spec: row.spec || {},
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }

  private mapRowToPipelineRun(row: any): CICDPipelineRun {
    return {
      id: row.id,
      tenantId: BigInt(row.tenant_id),
      pipelineId: row.pipeline_id,
      name: row.name,
      uid: row.uid,
      namespace: row.namespace,
      pipelineRef: row.pipeline_ref,
      status: row.status,
      startTime: row.start_time ? new Date(row.start_time) : undefined,
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      durationMs: row.duration_ms,
      triggeredBy: row.triggered_by,
      triggerReason: row.trigger_reason,
      gitCommit: row.git_commit,
      gitBranch: row.git_branch,
      gitRepository: row.git_repository,
      labels: row.labels || {},
      annotations: row.annotations || {},
      statusJson: row.status_json || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToTaskRun(row: any): CICDTaskRun {
    return {
      id: row.id,
      tenantId: BigInt(row.tenant_id),
      pipelineRunId: row.pipeline_run_id,
      name: row.name,
      uid: row.uid,
      taskRef: row.task_ref,
      status: row.status,
      startTime: row.start_time ? new Date(row.start_time) : undefined,
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      durationMs: row.duration_ms,
      podName: row.pod_name,
      containerName: row.container_name,
      retryCount: row.retry_count,
      reason: row.reason,
      message: row.message,
      logPath: row.log_path,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
