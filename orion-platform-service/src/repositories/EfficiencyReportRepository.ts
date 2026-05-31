/**
 * EfficiencyReportRepository
 * Data access layer for efficiency team data, project data, report history,
 * global deployments, and global pipeline records.
 * Replaces in-memory Maps in EfficiencyReportService.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

// ==================== Team Data ====================

export interface EfficiencyTeamDataEntity {
  id: string;
  tenantId: string;
  name: string;
  members: number;
  pipelines: unknown[];
  deployments: unknown[];
  created_at: Date;
  updated_at: Date;
}

export class EfficiencyTeamDataRepository extends BaseRepository<EfficiencyTeamDataEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'efficiency_team_data');
  }

  async create(data: Omit<EfficiencyTeamDataEntity, 'created_at' | 'updated_at'> & Partial<Pick<EfficiencyTeamDataEntity, 'id'>>): Promise<EfficiencyTeamDataEntity> {
    const columns = ['id', 'tenant_id', 'name', 'members', 'pipelines', 'deployments'];
    const values = [data.id, data.tenantId, data.name, data.members, JSON.stringify(data.pipelines), JSON.stringify(data.deployments)];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<EfficiencyTeamDataEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): EfficiencyTeamDataEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      members: row.members,
      pipelines: row.pipelines ?? [],
      deployments: row.deployments ?? [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Project Data ====================

export interface EfficiencyProjectDataEntity {
  id: string;
  tenantId: string;
  name: string;
  pipelines: unknown[];
  deployments: unknown[];
  commits: number;
  created_at: Date;
  updated_at: Date;
}

export class EfficiencyProjectDataRepository extends BaseRepository<EfficiencyProjectDataEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'efficiency_project_data');
  }

  async create(data: Omit<EfficiencyProjectDataEntity, 'created_at' | 'updated_at'> & Partial<Pick<EfficiencyProjectDataEntity, 'id'>>): Promise<EfficiencyProjectDataEntity> {
    const columns = ['id', 'tenant_id', 'name', 'pipelines', 'deployments', 'commits'];
    const values = [data.id, data.tenantId, data.name, JSON.stringify(data.pipelines), JSON.stringify(data.deployments), data.commits];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<EfficiencyProjectDataEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): EfficiencyProjectDataEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      pipelines: row.pipelines ?? [],
      deployments: row.deployments ?? [],
      commits: row.commits,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Report History ====================

export interface EfficiencyReportEntity {
  id: string;
  tenantId: string;
  reportData: Record<string, unknown>;
  generatedAt: Date;
  created_at: Date;
}

export class EfficiencyReportHistoryRepository extends BaseRepository<EfficiencyReportEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'efficiency_reports');
  }

  async create(data: Omit<EfficiencyReportEntity, 'created_at'> & Partial<Pick<EfficiencyReportEntity, 'id'>>): Promise<EfficiencyReportEntity> {
    const columns = ['id', 'tenant_id', 'report_data', 'generated_at'];
    const values = [data.id, data.tenantId, JSON.stringify(data.reportData), data.generatedAt];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, limit: number = 10): Promise<EfficiencyReportEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY generated_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async pruneOld(tenantId: string, keepCount: number = 50): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id NOT IN (
        SELECT id FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY generated_at DESC LIMIT $2
      ) AND tenant_id = $1`,
      [tenantId, keepCount],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): EfficiencyReportEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      reportData: row.report_data ?? {},
      generatedAt: row.generated_at,
      created_at: row.created_at,
    };
  }
}

// ==================== Global Deployments ====================

export interface EfficiencyGlobalDeploymentEntity {
  id: string;
  tenantId: string;
  deploymentData: Record<string, unknown>;
  deployedAt: Date;
  created_at: Date;
}

export class EfficiencyGlobalDeploymentRepository extends BaseRepository<EfficiencyGlobalDeploymentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'efficiency_global_deployments');
  }

  async create(data: Omit<EfficiencyGlobalDeploymentEntity, 'createdAt'> & Partial<Pick<EfficiencyGlobalDeploymentEntity, 'id'>>): Promise<EfficiencyGlobalDeploymentEntity> {
    const columns = ['id', 'tenant_id', 'deployment_data', 'deployed_at'];
    const values = [data.id, data.tenantId, JSON.stringify(data.deploymentData), data.deployedAt];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<EfficiencyGlobalDeploymentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY deployed_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): EfficiencyGlobalDeploymentEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      deploymentData: row.deployment_data ?? {},
      deployedAt: row.deployed_at,
      created_at: row.created_at,
    };
  }
}

// ==================== Global Pipeline Records ====================

export interface EfficiencyGlobalPipelineEntity {
  id: string;
  tenantId: string;
  pipelineData: Record<string, unknown>;
  completedAt: Date;
  created_at: Date;
}

export class EfficiencyGlobalPipelineRepository extends BaseRepository<EfficiencyGlobalPipelineEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'efficiency_global_pipelines');
  }

  async create(data: Omit<EfficiencyGlobalPipelineEntity, 'createdAt'> & Partial<Pick<EfficiencyGlobalPipelineEntity, 'id'>>): Promise<EfficiencyGlobalPipelineEntity> {
    const columns = ['id', 'tenant_id', 'pipeline_data', 'completed_at'];
    const values = [data.id, data.tenantId, JSON.stringify(data.pipelineData), data.completedAt];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<EfficiencyGlobalPipelineEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY completed_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): EfficiencyGlobalPipelineEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pipelineData: row.pipeline_data ?? {},
      completedAt: row.completed_at,
      created_at: row.created_at,
    };
  }
}
