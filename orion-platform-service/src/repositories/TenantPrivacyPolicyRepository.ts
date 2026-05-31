import { BaseRepository } from '../db/base-repository';

export interface TenantPrivacyPolicyEntity {
  id: string;
  tenantId: number;
  dataRetentionDays: number;
  anonymizePii: boolean;
  allowedRegions: string[];
  encryptionAtRest: boolean;
  auditLogging: boolean;
  policyDocument: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class TenantPrivacyPolicyDbRepository extends BaseRepository<TenantPrivacyPolicyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'tenant_privacy_policies');
  }

  async findByTenantId(tenantId: number): Promise<TenantPrivacyPolicyEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM tenant_privacy_policies WHERE tenant_id = $1 LIMIT 1`,
      [tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): TenantPrivacyPolicyEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      dataRetentionDays: row.data_retention_days,
      anonymizePii: row.anonymize_pii,
      allowedRegions: typeof row.allowed_regions === 'string' ? JSON.parse(row.allowed_regions) : (row.allowed_regions || []),
      encryptionAtRest: row.encryption_at_rest,
      auditLogging: row.audit_logging,
      policyDocument: row.policy_document,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
