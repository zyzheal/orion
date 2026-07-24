/**
 * ArtifactRetentionRepository — PostgreSQL data access for retention policies and evaluations.
 */
import { DatabasePool } from '../utils/database';

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

export class RetentionPolicyRepository {
  constructor(private pool: DatabasePool) {}

  async create(data: {
    id: string; tenant_id: string; name: string; max_age_days: number;
    max_versions: number | null; max_size_mb: number | null;
    protected_tags: string[]; schedule: string | null; enabled: boolean;
  }): Promise<RetentionPolicyEntity> {
    const result = await this.pool.query(
      `INSERT INTO retention_policies (id, tenant_id, name, max_age_days, max_versions, max_size_mb, protected_tags, schedule, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.id, data.tenant_id, data.name, data.max_age_days, data.max_versions, data.max_size_mb, data.protected_tags, data.schedule, data.enabled]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<RetentionPolicyEntity | null> {
    const result = await this.pool.query('SELECT * FROM retention_policies WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByTenant(tenantId: string): Promise<RetentionPolicyEntity[]> {
    const result = await this.pool.query('SELECT * FROM retention_policies WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    return result.rows;
  }

  async findByTenantAndEnabled(tenantId: string): Promise<RetentionPolicyEntity[]> {
    const result = await this.pool.query('SELECT * FROM retention_policies WHERE tenant_id = $1 AND enabled = true ORDER BY created_at DESC', [tenantId]);
    return result.rows;
  }

  async update(id: string, data: Partial<RetentionPolicyEntity>): Promise<RetentionPolicyEntity> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`${key} = $${idx++}`);
      params.push(value);
    }
    params.push(id);
    const result = await this.pool.query(
      `UPDATE retention_policies SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM retention_policies WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}

export class RetentionEvaluationRepository {
  constructor(private pool: DatabasePool) {}

  async create(data: {
    id: string; policy_id: string; tenant_id: string; evaluated_at: Date;
    total_artifacts: number; expired_count: number; protected_count: number;
    expired_artifacts: Record<string, unknown>[]; space_reclaimable_mb: number;
  }): Promise<RetentionEvaluationEntity> {
    const result = await this.pool.query(
      `INSERT INTO retention_evaluations (id, policy_id, tenant_id, evaluated_at, total_artifacts, expired_count, protected_count, expired_artifacts, space_reclaimable_mb)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.id, data.policy_id, data.tenant_id, data.evaluated_at, data.total_artifacts, data.expired_count, data.protected_count, data.expired_artifacts, data.space_reclaimable_mb]
    );
    return result.rows[0];
  }

  async findByTenant(tenantId: string): Promise<RetentionEvaluationEntity[]> {
    const result = await this.pool.query('SELECT * FROM retention_evaluations WHERE tenant_id = $1 ORDER BY evaluated_at DESC', [tenantId]);
    return result.rows;
  }
}
