import { BaseRepository } from '../db/base-repository';

export interface TenantPrivacyPolicyEntity {
  id: string;
  tenant_id: number;
  policy_level: string;
  secret_sanitization_enabled: boolean;
  pii_sanitization_enabled: boolean;
  ner_model_type: string;
  local_model_required: boolean;
  sensitive_data_types: string[];
  pii_types: string[];
  custom_patterns: Array<{ type: string; pattern: string }>;
  audit_logging_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Legacy entity interface for backward compatibility
 */
export interface TenantPrivacyPolicyDbEntity {
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

export class TenantPrivacyPolicyRepository extends BaseRepository<TenantPrivacyPolicyEntity> {
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

  async upsert(tenantId: number, data: {
    policy_level: string;
    secret_sanitization_enabled: boolean;
    pii_sanitization_enabled: boolean;
    ner_model_type: string;
    local_model_required: boolean;
    sensitive_data_types: string[];
    pii_types: string[];
    custom_patterns: Array<{ type: string; pattern: string }>;
    audit_logging_enabled: boolean;
  }): Promise<TenantPrivacyPolicyEntity> {
    const result = await this.db.query(
      `INSERT INTO tenant_privacy_policies (
        tenant_id, policy_level, secret_sanitization_enabled, pii_sanitization_enabled,
        ner_model_type, local_model_required, sensitive_data_types, pii_types,
        custom_patterns, audit_logging_enabled, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        policy_level = $2,
        secret_sanitization_enabled = $3,
        pii_sanitization_enabled = $4,
        ner_model_type = $5,
        local_model_required = $6,
        sensitive_data_types = $7,
        pii_types = $8,
        custom_patterns = $9,
        audit_logging_enabled = $10,
        updated_at = NOW()
      RETURNING *`,
      [
        tenantId,
        data.policy_level,
        data.secret_sanitization_enabled,
        data.pii_sanitization_enabled,
        data.ner_model_type,
        data.local_model_required,
        JSON.stringify(data.sensitive_data_types),
        JSON.stringify(data.pii_types),
        JSON.stringify(data.custom_patterns),
        data.audit_logging_enabled,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByTenantId(tenantId: number): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM tenant_privacy_policies WHERE tenant_id = $1`,
      [tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): TenantPrivacyPolicyEntity {
    return {
      id: row.id ? String(row.id) : String(row.tenant_id),
      tenant_id: row.tenant_id,
      policy_level: row.policy_level ?? 'standard',
      secret_sanitization_enabled: row.secret_sanitization_enabled ?? true,
      pii_sanitization_enabled: row.pii_sanitization_enabled ?? true,
      ner_model_type: row.ner_model_type ?? 'bert-local',
      local_model_required: row.local_model_required ?? false,
      sensitive_data_types: typeof row.sensitive_data_types === 'string'
        ? JSON.parse(row.sensitive_data_types)
        : (row.sensitive_data_types ?? []),
      pii_types: typeof row.pii_types === 'string'
        ? JSON.parse(row.pii_types)
        : (row.pii_types ?? []),
      custom_patterns: typeof row.custom_patterns === 'string'
        ? JSON.parse(row.custom_patterns)
        : (row.custom_patterns ?? []),
      audit_logging_enabled: row.audit_logging_enabled ?? true,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

/**
 * @deprecated Use TenantPrivacyPolicyRepository instead
 */
export const TenantPrivacyPolicyDbRepository = TenantPrivacyPolicyRepository;
