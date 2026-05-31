// orion-platform-service/src/services/privacy/TenantPrivacyPolicyService.ts
import pino from 'pino';
import { DatabasePool } from '../database';
import { TenantPrivacyPolicyRepository } from '../../repositories/TenantPrivacyPolicyRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface TenantPrivacyPolicy {
  tenantId: number;
  policyLevel: 'standard' | 'enhanced' | 'strict' | 'custom';
  secretSanitizationEnabled: boolean;
  piiSanitizationEnabled: boolean;
  nerModelType: 'bert-local' | 'bert-remote' | 'regex-only';
  localModelRequired: boolean;
  sensitiveDataTypes: string[];
  piiTypes: string[];
  customPatterns: Array<{ type: string; pattern: string }>;
  auditLoggingEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SanitizationConfig {
  secretEnabled: boolean;
  piiEnabled: boolean;
  nerModel: string;
}

export interface ComplianceResult {
  compliant: boolean;
  violations: string[];
  policyLevel: string;
  actualModel: string;
}

const DEFAULT_POLICY: Omit<TenantPrivacyPolicy, 'tenantId'> = {
  policyLevel: 'standard',
  secretSanitizationEnabled: true,
  piiSanitizationEnabled: true,
  nerModelType: 'bert-local',
  localModelRequired: false,
  sensitiveDataTypes: ['api_key', 'password', 'token', 'secret'],
  piiTypes: ['email', 'phone', 'name', 'id_card', 'address'],
  customPatterns: [],
  auditLoggingEnabled: true,
};

// Policy level presets
const POLICY_PRESETS: Record<string, Partial<TenantPrivacyPolicy>> = {
  standard: {
    secretSanitizationEnabled: true,
    piiSanitizationEnabled: true,
    nerModelType: 'regex-only',
    localModelRequired: false,
  },
  enhanced: {
    secretSanitizationEnabled: true,
    piiSanitizationEnabled: true,
    nerModelType: 'bert-local',
    localModelRequired: false,
  },
  strict: {
    secretSanitizationEnabled: true,
    piiSanitizationEnabled: true,
    nerModelType: 'bert-local',
    localModelRequired: true,
  },
  custom: {
    // Uses custom settings
  },
};

export class TenantPrivacyPolicyService {
  private policies: Map<number, TenantPrivacyPolicy> = new Map();
  private db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
  private repo?: TenantPrivacyPolicyRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
    if (db) {
      this.repo = new TenantPrivacyPolicyRepository(db);
    }
  }

  /**
   * Get privacy policy for a tenant
   * Returns default policy if none exists
   */
  async getPolicy(tenantId: number): Promise<TenantPrivacyPolicy> {
    // Check in-memory cache first
    const cached = this.policies.get(tenantId);
    if (cached) {
      return cached;
    }

    // Try to load from repository or database
    try {
      if (this.repo) {
        const entity = await this.repo.findByTenantId(tenantId);
        if (entity) {
          const policy: TenantPrivacyPolicy = {
            tenantId: entity.tenant_id,
            policyLevel: entity.policy_level as TenantPrivacyPolicy['policyLevel'],
            secretSanitizationEnabled: entity.secret_sanitization_enabled,
            piiSanitizationEnabled: entity.pii_sanitization_enabled,
            nerModelType: entity.ner_model_type as TenantPrivacyPolicy['nerModelType'],
            localModelRequired: entity.local_model_required,
            sensitiveDataTypes: entity.sensitive_data_types,
            piiTypes: entity.pii_types,
            customPatterns: entity.custom_patterns,
            auditLoggingEnabled: entity.audit_logging_enabled,
            createdAt: entity.created_at,
            updatedAt: entity.updated_at,
          };
          this.policies.set(tenantId, policy);
          return policy;
        }
      } else if (this.db) {
        const result = await this.db.query(
          `SELECT * FROM tenant_privacy_policies WHERE tenant_id = $1`,
          [tenantId],
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          const policy: TenantPrivacyPolicy = {
            tenantId: row.tenant_id,
            policyLevel: row.policy_level,
            secretSanitizationEnabled: row.secret_sanitization_enabled,
            piiSanitizationEnabled: row.pii_sanitization_enabled,
            nerModelType: row.ner_model_type,
            localModelRequired: row.local_model_required,
            sensitiveDataTypes: row.sensitive_data_types || [],
            piiTypes: row.pii_types || [],
            customPatterns: row.custom_patterns || [],
            auditLoggingEnabled: row.audit_logging_enabled,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
          this.policies.set(tenantId, policy);
          return policy;
        }
      }
    } catch (error) {
      logger.warn(`[TenantPrivacyPolicy] Database query failed, using default: ${(error as Error).message}`);
    }

    // Return default policy
    return { ...DEFAULT_POLICY, tenantId };
  }

  /**
   * Set or update privacy policy for a tenant
   */
  async setPolicy(tenantId: number, policy: Partial<TenantPrivacyPolicy>): Promise<TenantPrivacyPolicy> {
    const existing = await this.getPolicy(tenantId);

    // Apply preset if policy level changed
    let updated: TenantPrivacyPolicy;
    if (policy.policyLevel && policy.policyLevel !== existing.policyLevel) {
      const preset = POLICY_PRESETS[policy.policyLevel] || {};
      updated = { ...DEFAULT_POLICY, ...existing, ...preset, ...policy, tenantId };
    } else {
      updated = { ...existing, ...policy, tenantId };
    }

    // Ensure tenantId is correct
    updated.tenantId = tenantId;
    updated.updatedAt = new Date();

    // Update in-memory cache
    this.policies.set(tenantId, updated);

    // Persist to repository or database
    if (this.repo) {
      this.repo.upsert(tenantId, {
        policy_level: updated.policyLevel,
        secret_sanitization_enabled: updated.secretSanitizationEnabled,
        pii_sanitization_enabled: updated.piiSanitizationEnabled,
        ner_model_type: updated.nerModelType,
        local_model_required: updated.localModelRequired,
        sensitive_data_types: updated.sensitiveDataTypes,
        pii_types: updated.piiTypes,
        custom_patterns: updated.customPatterns,
        audit_logging_enabled: updated.auditLoggingEnabled,
      }).catch((err: any) => {
        logger.warn(`[TenantPrivacyPolicy] Repository save failed: ${err.message}`);
      });
    } else if (this.db) {
      try {
        await this.db.query(
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
            updated_at = NOW()`,
          [
            tenantId,
            updated.policyLevel,
            updated.secretSanitizationEnabled,
            updated.piiSanitizationEnabled,
            updated.nerModelType,
            updated.localModelRequired,
            JSON.stringify(updated.sensitiveDataTypes),
            JSON.stringify(updated.piiTypes),
            JSON.stringify(updated.customPatterns),
            updated.auditLoggingEnabled,
          ],
        );
      } catch (error) {
        logger.warn(`[TenantPrivacyPolicy] Database save failed: ${(error as Error).message}`);
      }
    }

    logger.info(`[TenantPrivacyPolicy] Policy updated for tenant: ${tenantId}, level: ${updated.policyLevel}`);
    return updated;
  }

  /**
   * Check if local model is required for tenant
   * Returns true if policy level is 'strict' or localModelRequired is true
   */
  async isLocalModelRequired(tenantId: number): Promise<boolean> {
    const policy = await this.getPolicy(tenantId);
    return policy.localModelRequired || policy.policyLevel === 'strict';
  }

  /**
   * Get sanitization configuration for a tenant
   */
  async getSanitizationConfig(tenantId: number): Promise<SanitizationConfig> {
    const policy = await this.getPolicy(tenantId);
    return {
      secretEnabled: policy.secretSanitizationEnabled,
      piiEnabled: policy.piiSanitizationEnabled,
      nerModel: policy.nerModelType,
    };
  }

  /**
   * Validate that actual model usage complies with tenant policy
   */
  async validatePolicyCompliance(tenantId: number, actualModel: string): Promise<ComplianceResult> {
    const policy = await this.getPolicy(tenantId);
    const violations: string[] = [];

    // Check if local model is required but remote model is being used
    if (policy.localModelRequired || policy.policyLevel === 'strict') {
      const remoteModelPatterns = [
        /openai/i,
        /anthropic/i,
        /azure.*openai/i,
        /gpt-[34]/i,
        /claude/i,
        /gemini/i,
      ];

      const isRemoteModel = remoteModelPatterns.some(pattern => pattern.test(actualModel));

      if (isRemoteModel) {
        violations.push(`Policy requires local model but remote model '${actualModel}' is being used`);
      }
    }

    // Check NER model type compliance
    if (policy.nerModelType === 'bert-local' && actualModel.includes('remote')) {
      violations.push(`Policy requires local NER model but remote model is configured`);
    }

    return {
      compliant: violations.length === 0,
      violations,
      policyLevel: policy.policyLevel,
      actualModel,
    };
  }

  /**
   * Get all sensitive data types for a tenant
   */
  async getSensitiveDataTypes(tenantId: number): Promise<string[]> {
    const policy = await this.getPolicy(tenantId);
    return policy.sensitiveDataTypes;
  }

  /**
   * Get all PII types for a tenant
   */
  async getPIITypes(tenantId: number): Promise<string[]> {
    const policy = await this.getPolicy(tenantId);
    return policy.piiTypes;
  }

  /**
   * Add custom pattern for secret detection
   */
  async addCustomPattern(tenantId: number, pattern: { type: string; pattern: string }): Promise<void> {
    const policy = await this.getPolicy(tenantId);
    const customPatterns = [...policy.customPatterns, pattern];
    await this.setPolicy(tenantId, { customPatterns });
  }

  /**
   * Check if audit logging is enabled for tenant
   */
  async isAuditLoggingEnabled(tenantId: number): Promise<boolean> {
    const policy = await this.getPolicy(tenantId);
    return policy.auditLoggingEnabled;
  }

  /**
   * Clear policy cache (useful for testing)
   */
  clearCache(): void {
    this.policies.clear();
  }

  /**
   * Delete policy for a tenant
   */
  async deletePolicy(tenantId: number): Promise<boolean> {
    this.policies.delete(tenantId);

    if (this.repo) {
      try {
        return await this.repo.deleteByTenantId(tenantId);
      } catch (error) {
        logger.warn(`[TenantPrivacyPolicy] Repository delete failed: ${(error as Error).message}`);
        return false;
      }
    }

    if (this.db) {
      try {
        const result = await this.db.query(
          `DELETE FROM tenant_privacy_policies WHERE tenant_id = $1`,
          [tenantId],
        );
        return (result.rowCount ?? 0) > 0;
      } catch (error) {
        logger.warn(`[TenantPrivacyPolicy] Database delete failed: ${(error as Error).message}`);
        return false;
      }
    }

    return true;
  }
}