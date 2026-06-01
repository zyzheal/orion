/**
 * Policy Override Repository - PostgreSQL data access layer
 */

export interface PolicyOverrideEntity {
  id: string;
  policyId: string;
  runId?: string;
  reason: string;
  overriddenBy: string;
  overriddenAt: Date;
  expiresAt?: Date;
}

interface DbClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

export class PolicyOverrideRepository {
  constructor(private db: DbClient) {}

  async findAll(): Promise<PolicyOverrideEntity[]> {
    const result = await this.db.query('SELECT * FROM policy_overrides ORDER BY created_at DESC');
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findByPolicyId(policyId: string): Promise<PolicyOverrideEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM policy_overrides WHERE policy_id = $1 ORDER BY created_at DESC',
      [policyId]
    );
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async create(data: {
    policyId: string;
    runId?: string;
    reason: string;
    overriddenBy: string;
    expiresAt?: Date;
  }): Promise<PolicyOverrideEntity> {
    const id = `override-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const result = await this.db.query(
      `INSERT INTO policy_overrides (id, policy_id, resource_type, resource_id, reason, overrides_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, data.policyId, 'pipeline', data.runId || 'unknown', data.reason, data.overriddenBy, data.expiresAt || null]
    );
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: any): PolicyOverrideEntity {
    return {
      id: row.id,
      policyId: row.policy_id,
      runId: row.resource_id || undefined,
      reason: row.reason,
      overriddenBy: row.overrides_by,
      overriddenAt: row.created_at,
      expiresAt: row.expires_at || undefined,
    };
  }
}
