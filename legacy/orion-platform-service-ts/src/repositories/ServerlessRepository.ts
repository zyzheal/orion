/**
 * ServerlessRepository — PostgreSQL data access for serverless module
 *
 * Manages 5 tables: serverless_functions, serverless_triggers,
 * serverless_deployments, serverless_logs, serverless_metrics
 */

import { BaseRepository } from '../db/base-repository';

// --- Entities ---

export interface ServerlessFunctionEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  runtime: string;
  handler: string;
  memory: number;
  timeout: number;
  status: string;
  version: number;
  environment: Record<string, string>;
  code: string;
  triggerIds: string[];
  endpoint?: string;
  replicasMin: number;
  replicasMax: number;
  replicasCurrent: number;
  lastDeployedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerlessTriggerEntity {
  id: string;
  tenantId: string;
  functionId: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  invocationCount: number;
  lastInvokedAt?: Date;
  createdAt: Date;
}

export interface ServerlessDeploymentEntity {
  id: string;
  tenantId: string;
  functionId: string;
  version: number;
  status: string;
  codeVersion: string;
  deployedBy: string;
  error?: string;
  rollbackTo?: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface ServerlessLogEntity {
  id: string;
  tenantId: string;
  functionId: string;
  deploymentId: string;
  level: string;
  message: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface ServerlessMetricEntity {
  id: string;
  functionId: string;
  tenantId: string;
  period: Date;
  invocations: number;
  errors: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  avgMemoryUsed: number;
  throttledRequests: number;
  activeConnections: number;
  cpuUtilization: number;
}

// --- Repositories ---

export class ServerlessFunctionRepository extends BaseRepository<ServerlessFunctionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'serverless_functions');
  }

  async findByTenant(tenantId: string, options?: { status?: string; runtime?: string }): Promise<ServerlessFunctionEntity[]> {
    let query = 'SELECT * FROM serverless_functions WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let idx = 2;

    if (options?.status) {
      query += ` AND status = $${idx++}`;
      params.push(options.status);
    }
    if (options?.runtime) {
      query += ` AND runtime = $${idx++}`;
      params.push(options.runtime);
    }
    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async findDeployedByTenant(tenantId: string): Promise<ServerlessFunctionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM serverless_functions WHERE tenant_id = $1 AND status = 'deployed' ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async updateStatus(id: string, status: string, extra?: { version?: number; endpoint?: string; replicasCurrent?: number; lastDeployedAt?: Date }): Promise<ServerlessFunctionEntity | null> {
    const sets: string[] = ['status = $1', 'updated_at = NOW()'];
    const params: any[] = [status];
    let idx = 2;

    if (extra?.version !== undefined) {
      sets.push(`version = $${idx++}`);
      params.push(extra.version);
    }
    if (extra?.endpoint !== undefined) {
      sets.push(`endpoint = $${idx++}`);
      params.push(extra.endpoint);
    }
    if (extra?.replicasCurrent !== undefined) {
      sets.push(`replicas_current = $${idx++}`);
      params.push(extra.replicasCurrent);
    }
    if (extra?.lastDeployedAt !== undefined) {
      sets.push(`last_deployed_at = $${idx++}`);
      params.push(extra.lastDeployedAt);
    }

    params.push(id);
    const query = `UPDATE serverless_functions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.db.query(query, params);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async addTriggerId(id: string, triggerId: string): Promise<ServerlessFunctionEntity | null> {
    const result = await this.db.query(
      `UPDATE serverless_functions SET trigger_ids = trigger_ids || $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify([triggerId]), id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async removeTriggerId(id: string, triggerId: string): Promise<ServerlessFunctionEntity | null> {
    const current = await this.findById(id);
    if (!current) return null;
    const updated = current.triggerIds.filter(tid => tid !== triggerId);
    const result = await this.db.query(
      `UPDATE serverless_functions SET trigger_ids = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(updated), id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  protected mapRowToEntity(row: any): ServerlessFunctionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || '',
      runtime: row.runtime,
      handler: row.handler,
      memory: row.memory,
      timeout: row.timeout,
      status: row.status,
      version: row.version,
      environment: row.environment || {},
      code: row.code || '',
      triggerIds: row.trigger_ids || [],
      endpoint: row.endpoint,
      replicasMin: row.replicas_min,
      replicasMax: row.replicas_max,
      replicasCurrent: row.replicas_current,
      lastDeployedAt: row.last_deployed_at ? new Date(row.last_deployed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export class ServerlessTriggerRepository extends BaseRepository<ServerlessTriggerEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'serverless_triggers');
  }

  async findByTenant(tenantId: string, options?: { functionId?: string; type?: string }): Promise<ServerlessTriggerEntity[]> {
    let query = 'SELECT * FROM serverless_triggers WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let idx = 2;

    if (options?.functionId) {
      query += ` AND function_id = $${idx++}`;
      params.push(options.functionId);
    }
    if (options?.type) {
      query += ` AND type = $${idx++}`;
      params.push(options.type);
    }
    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async findByFunctionId(functionId: string): Promise<ServerlessTriggerEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM serverless_triggers WHERE function_id = $1',
      [functionId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async incrementInvocation(id: string): Promise<void> {
    await this.db.query(
      `UPDATE serverless_triggers SET invocation_count = invocation_count + 1, last_invoked_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async deleteByFunctionId(functionId: string): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM serverless_triggers WHERE function_id = $1',
      [functionId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): ServerlessTriggerEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      functionId: row.function_id,
      type: row.type,
      name: row.name,
      config: row.config || {},
      enabled: row.enabled,
      invocationCount: row.invocation_count,
      lastInvokedAt: row.last_invoked_at ? new Date(row.last_invoked_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

export class ServerlessDeploymentRepository extends BaseRepository<ServerlessDeploymentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'serverless_deployments');
  }

  async findByFunction(functionId: string, tenantId: string): Promise<ServerlessDeploymentEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM serverless_deployments WHERE function_id = $1 AND tenant_id = $2 ORDER BY started_at DESC',
      [functionId, tenantId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async updateStatus(id: string, status: string, extra?: { completedAt?: Date; error?: string }): Promise<ServerlessDeploymentEntity | null> {
    const sets: string[] = ['status = $1'];
    const params: any[] = [status];
    let idx = 2;

    if (extra?.completedAt) {
      sets.push(`completed_at = $${idx++}`);
      params.push(extra.completedAt);
    }
    if (extra?.error !== undefined) {
      sets.push(`error = $${idx++}`);
      params.push(extra.error);
    }

    params.push(id);
    const query = `UPDATE serverless_deployments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.db.query(query, params);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async deleteByFunctionId(functionId: string, tenantId: string): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM serverless_deployments WHERE function_id = $1 AND tenant_id = $2',
      [functionId, tenantId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): ServerlessDeploymentEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      functionId: row.function_id,
      version: row.version,
      status: row.status,
      codeVersion: row.code_version,
      deployedBy: row.deployed_by,
      error: row.error,
      rollbackTo: row.rollback_to,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }
}

export class ServerlessLogRepository extends BaseRepository<ServerlessLogEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'serverless_logs');
  }

  async findByFunction(functionId: string, tenantId: string, options?: { level?: string; limit?: number }): Promise<ServerlessLogEntity[]> {
    let query = 'SELECT * FROM serverless_logs WHERE function_id = $1 AND tenant_id = $2';
    const params: any[] = [functionId, tenantId];
    let idx = 3;

    if (options?.level) {
      query += ` AND level = $${idx++}`;
      params.push(options.level);
    }
    query += ' ORDER BY timestamp DESC';

    const limit = options?.limit || 100;
    query += ` LIMIT $${idx}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async deleteByFunctionId(functionId: string, tenantId: string): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM serverless_logs WHERE function_id = $1 AND tenant_id = $2',
      [functionId, tenantId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): ServerlessLogEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      functionId: row.function_id,
      deploymentId: row.deployment_id || '',
      level: row.level,
      message: row.message,
      requestId: row.request_id,
      metadata: row.metadata,
      timestamp: new Date(row.timestamp),
    };
  }
}

export class ServerlessMetricRepository extends BaseRepository<ServerlessMetricEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'serverless_metrics');
  }

  async findByFunction(functionId: string, tenantId: string): Promise<ServerlessMetricEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM serverless_metrics WHERE function_id = $1 AND tenant_id = $2 ORDER BY period DESC',
      [functionId, tenantId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async findByTenant(tenantId: string): Promise<ServerlessMetricEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM serverless_metrics WHERE tenant_id = $1 ORDER BY period DESC',
      [tenantId],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  protected mapRowToEntity(row: any): ServerlessMetricEntity {
    return {
      id: row.id,
      functionId: row.function_id,
      tenantId: row.tenant_id,
      period: new Date(row.period),
      invocations: row.invocations,
      errors: row.errors,
      avgDuration: parseFloat(row.avg_duration),
      p95Duration: parseFloat(row.p95_duration),
      p99Duration: parseFloat(row.p99_duration),
      avgMemoryUsed: parseFloat(row.avg_memory_used),
      throttledRequests: row.throttled_requests,
      activeConnections: row.active_connections,
      cpuUtilization: parseFloat(row.cpu_utilization),
    };
  }
}
