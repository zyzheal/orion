/**
 * Artifact Lifecycle Repository
 *
 * PostgreSQL-backed repository for artifact lifecycle policies and replication tasks.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { DatabasePool } from '../services/database';

export interface ArtifactLifecyclePolicyEntity {
  id: string;
  tenantId: string;
  artifactId: string;
  policyType: string;
  config: Record<string, any>;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtifactReplicationEntity {
  id: string;
  tenantId: string;
  artifactId: string;
  sourceRegistry: string;
  targetRegistry: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  initiatedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ArtifactLifecyclePolicyRepository extends BaseRepository<ArtifactLifecyclePolicyEntity> {
  constructor(db: DatabasePool) {
    super(db, 'artifact_lifecycle_policies');
  }

  async findByArtifact(artifactId: string): Promise<ArtifactLifecyclePolicyEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM artifact_lifecycle_policies WHERE artifact_id = $1 ORDER BY created_at DESC',
      [artifactId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantAndType(tenantId: string, policyType: string): Promise<ArtifactLifecyclePolicyEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM artifact_lifecycle_policies WHERE tenant_id = $1 AND policy_type = $2 ORDER BY created_at DESC',
      [tenantId, policyType],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabledByArtifact(artifactId: string): Promise<ArtifactLifecyclePolicyEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM artifact_lifecycle_policies WHERE artifact_id = $1 AND enabled = true ORDER BY created_at DESC',
      [artifactId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ArtifactLifecyclePolicyEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      artifactId: row.artifact_id,
      policyType: row.policy_type,
      config: row.config || {},
      enabled: row.enabled,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class ArtifactReplicationRepository extends BaseRepository<ArtifactReplicationEntity> {
  constructor(db: DatabasePool) {
    super(db, 'artifact_replications');
  }

  async findByArtifact(artifactId: string): Promise<ArtifactReplicationEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM artifact_replications WHERE artifact_id = $1 ORDER BY created_at DESC',
      [artifactId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, filters?: {
    artifactId?: string;
    status?: string;
  }): Promise<FindAllResult<ArtifactReplicationEntity>> {
    let query = 'SELECT * FROM artifact_replications WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (filters?.artifactId) {
      query += ` AND artifact_id = $${paramIdx}`;
      params.push(filters.artifactId);
      paramIdx++;
    }
    if (filters?.status) {
      query += ` AND status = $${paramIdx}`;
      params.push(filters.status);
      paramIdx++;
    }

    const orderBy = 'created_at';
    const orderDir = 'DESC';
    const limit = 20;
    const offset = 0;

    query += ` ORDER BY ${orderBy} ${orderDir} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const entities = result.rows.map(row => this.mapRowToEntity(row));

    const countQuery = query.slice(0, query.indexOf(' ORDER BY'));
    const countResult = await this.db.query(countQuery, params.slice(0, -2));

    return {
      entities,
      total: parseInt(countResult.rows[0]?.count || '0', 10),
    };
  }

  async updateStatus(id: string, status: string, progress?: number, errorMessage?: string): Promise<ArtifactReplicationEntity | null> {
    let query = 'UPDATE artifact_replications SET status = $1, updated_at = NOW()';
    const params: any[] = [status];
    let paramIdx = 2;

    if (progress !== undefined) {
      query += `, progress = $${paramIdx}`;
      params.push(progress);
      paramIdx++;
    }
    if (errorMessage !== undefined) {
      query += `, error_message = $${paramIdx}`;
      params.push(errorMessage);
      paramIdx++;
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      query += `, completed_at = NOW()`;
    }
    if (status === 'running') {
      query += `, started_at = NOW()`;
    }

    query += ` WHERE id = $${paramIdx} RETURNING *`;
    params.push(id);

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ArtifactReplicationEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      artifactId: row.artifact_id,
      sourceRegistry: row.source_registry,
      targetRegistry: row.target_registry,
      status: row.status,
      progress: row.progress,
      errorMessage: row.error_message,
      initiatedBy: row.initiated_by,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
