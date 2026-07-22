/**
 * ArtifactRetentionRepository
 *
 * PostgreSQL-backed repository for artifact retention policies and evaluations.
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { DatabasePool } from '../services/database';

export interface RetentionPolicyEntity {
  id: string;
  tenant_id: string;
  name: string;
  max_age_days: number;
  max_versions: number | null;
  max_size_mb: number | null;
  protected_tags: string[];
  schedule: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RetentionEvaluationEntity {
  id: string;
  policy_id: string;
  tenant_id: string;
  evaluated_at: Date;
  total_artifacts: number;
  expired_count: number;
  protected_count: number;
  expired_artifacts: Record<string, unknown>[];
  space_reclaimable_mb: number;
}

export class RetentionPolicyRepository extends BaseRepository<RetentionPolicyEntity> {
  constructor(db: DatabasePool) {
    super(db, 'retention_policies');
  }

  async findByTenant(tenantId: string): Promise<RetentionPolicyEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM retention_policies WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantAndEnabled(tenantId: string): Promise<RetentionPolicyEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM retention_policies WHERE tenant_id = $1 AND enabled = true ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): RetentionPolicyEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      max_age_days: row.max_age_days,
      max_versions: row.max_versions,
      max_size_mb: row.max_size_mb,
      protected_tags: row.protected_tags ?? [],
      schedule: row.schedule,
      enabled: row.enabled,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export class RetentionEvaluationRepository extends BaseRepository<RetentionEvaluationEntity> {
  constructor(db: DatabasePool) {
    super(db, 'retention_evaluations');
  }

  async findByPolicy(policyId: string): Promise<RetentionEvaluationEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM retention_evaluations WHERE policy_id = $1 ORDER BY evaluated_at DESC',
      [policyId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string): Promise<RetentionEvaluationEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM retention_evaluations WHERE tenant_id = $1 ORDER BY evaluated_at DESC',
      [tenantId]
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findLatestByPolicy(policyId: string): Promise<RetentionEvaluationEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM retention_evaluations WHERE policy_id = $1 ORDER BY evaluated_at DESC LIMIT 1',
      [policyId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM retention_evaluations WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): RetentionEvaluationEntity {
    return {
      id: row.id,
      policy_id: row.policy_id,
      tenant_id: row.tenant_id,
      evaluated_at: row.evaluated_at,
      total_artifacts: row.total_artifacts,
      expired_count: row.expired_count,
      protected_count: row.protected_count,
      expired_artifacts: row.expired_artifacts ?? [],
      space_reclaimable_mb: row.space_reclaimable_mb,
    };
  }
}
