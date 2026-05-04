// orion-platform-service/src/services/privacy/TenantPrivacyPolicyService.ts
import pino from 'pino';

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
}

const DEFAULT_POLICY: TenantPrivacyPolicy = {
  tenantId: 0,
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

export class TenantPrivacyPolicyService {
  private policies: Map<number, TenantPrivacyPolicy> = new Map();

  constructor() {
    // Initialize with default policies
  }

  async getPolicy(tenantId: number): Promise<TenantPrivacyPolicy> {
    const policy = this.policies.get(tenantId);
    if (policy) {
      return policy;
    }

    // Load from database (placeholder)
    return { ...DEFAULT_POLICY, tenantId };
  }

  async setPolicy(tenantId: number, policy: Partial<TenantPrivacyPolicy>): Promise<void> {
    const existing = await this.getPolicy(tenantId);
    const updated = { ...existing, ...policy, tenantId };

    this.policies.set(tenantId, updated);

    // Store in database (placeholder)
    logger.info(`[TenantPrivacyPolicy] Policy updated for tenant: ${tenantId}`);
  }

  async isLocalModelRequired(tenantId: number): Promise<boolean> {
    const policy = await this.getPolicy(tenantId);
    return policy.localModelRequired || policy.policyLevel === 'strict';
  }

  async getSanitizationConfig(tenantId: number): Promise<{
    secretEnabled: boolean;
    piiEnabled: boolean;
    nerModel: string;
  }> {
    const policy = await this.getPolicy(tenantId);
    return {
      secretEnabled: policy.secretSanitizationEnabled,
      piiEnabled: policy.piiSanitizationEnabled,
      nerModel: policy.nerModelType,
    };
  }

  async validatePolicyCompliance(tenantId: number, actualModel: string): Promise<boolean> {
    const policy = await this.getPolicy(tenantId);

    if (policy.localModelRequired && actualModel.includes('openai')) {
      return false;
    }

    return true;
  }
}