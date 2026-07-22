// orion-platform-service/src/services/privacy/__tests__/TenantPrivacyPolicy.test.ts
import { TenantPrivacyPolicyService, TenantPrivacyPolicy, ComplianceResult } from '../TenantPrivacyPolicyService';

describe('TenantPrivacyPolicyService', () => {
  let service: TenantPrivacyPolicyService;

  beforeEach(() => {
    service = new TenantPrivacyPolicyService();
  });

  describe('getPolicy', () => {
    it('should return default policy for new tenant', async () => {
      const policy = await service.getPolicy(1);
      expect(policy.tenantId).toBe(1);
      expect(policy.policyLevel).toBe('standard');
      expect(policy.secretSanitizationEnabled).toBe(true);
      expect(policy.piiSanitizationEnabled).toBe(true);
    });

    it('should return cached policy after first fetch', async () => {
      const policy1 = await service.getPolicy(1);
      const policy2 = await service.getPolicy(1);
      expect(policy1).toEqual(policy2);
    });

    it('should return different policies for different tenants', async () => {
      const policy1 = await service.getPolicy(1);
      const policy2 = await service.getPolicy(2);
      expect(policy1.tenantId).toBe(1);
      expect(policy2.tenantId).toBe(2);
    });
  });

  describe('setPolicy', () => {
    it('should update policy for tenant', async () => {
      const updated = await service.setPolicy(1, { policyLevel: 'enhanced' });
      expect(updated.policyLevel).toBe('enhanced');
      expect(updated.tenantId).toBe(1);
    });

    it('should apply preset when changing policy level', async () => {
      const updated = await service.setPolicy(1, { policyLevel: 'strict' });
      expect(updated.policyLevel).toBe('strict');
      expect(updated.localModelRequired).toBe(true);
    });

    it('should preserve existing settings when updating partial', async () => {
      await service.setPolicy(1, { secretSanitizationEnabled: true });
      const updated = await service.setPolicy(1, { piiSanitizationEnabled: false });
      expect(updated.secretSanitizationEnabled).toBe(true);
      expect(updated.piiSanitizationEnabled).toBe(false);
    });

    it('should allow custom sensitive data types', async () => {
      const customTypes = ['custom_secret', 'internal_token'];
      const updated = await service.setPolicy(1, { sensitiveDataTypes: customTypes });
      expect(updated.sensitiveDataTypes).toEqual(customTypes);
    });

    it('should allow custom PII types', async () => {
      const customPII = ['bank_account', 'credit_card'];
      const updated = await service.setPolicy(1, { piiTypes: customPII });
      expect(updated.piiTypes).toEqual(customPII);
    });
  });

  describe('isLocalModelRequired', () => {
    it('should return false for standard policy', async () => {
      await service.setPolicy(1, { policyLevel: 'standard' });
      const required = await service.isLocalModelRequired(1);
      expect(required).toBe(false);
    });

    it('should return true for strict policy', async () => {
      await service.setPolicy(1, { policyLevel: 'strict' });
      const required = await service.isLocalModelRequired(1);
      expect(required).toBe(true);
    });

    it('should return true if localModelRequired is set', async () => {
      await service.setPolicy(1, { policyLevel: 'enhanced', localModelRequired: true });
      const required = await service.isLocalModelRequired(1);
      expect(required).toBe(true);
    });
  });

  describe('getSanitizationConfig', () => {
    it('should return sanitization config for tenant', async () => {
      const config = await service.getSanitizationConfig(1);
      expect(config.secretEnabled).toBe(true);
      expect(config.piiEnabled).toBe(true);
      expect(config.nerModel).toBe('bert-local');
    });

    it('should reflect policy changes', async () => {
      await service.setPolicy(1, {
        secretSanitizationEnabled: false,
        piiSanitizationEnabled: false,
        nerModelType: 'regex-only',
      });
      const config = await service.getSanitizationConfig(1);
      expect(config.secretEnabled).toBe(false);
      expect(config.piiEnabled).toBe(false);
      expect(config.nerModel).toBe('regex-only');
    });
  });

  describe('validatePolicyCompliance', () => {
    it('should return compliant for standard policy with remote model', async () => {
      await service.setPolicy(1, { policyLevel: 'standard' });
      const result = await service.validatePolicyCompliance(1, 'openai-gpt-4');
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should return non-compliant for strict policy with remote model', async () => {
      await service.setPolicy(1, { policyLevel: 'strict' });
      const result = await service.validatePolicyCompliance(1, 'openai-gpt-4');
      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('remote model');
    });

    it('should return compliant for strict policy with local model', async () => {
      await service.setPolicy(1, { policyLevel: 'strict' });
      const result = await service.validatePolicyCompliance(1, 'local-bert-model');
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect various remote model patterns', async () => {
      await service.setPolicy(1, { policyLevel: 'strict' });

      const remoteModels = ['openai-gpt-4', 'anthropic-claude', 'azure-openai-gpt3', 'gemini-pro'];
      for (const model of remoteModels) {
        const result = await service.validatePolicyCompliance(1, model);
        expect(result.compliant).toBe(false);
      }
    });

    it('should include policy level and actual model in result', async () => {
      await service.setPolicy(1, { policyLevel: 'enhanced' });
      const result = await service.validatePolicyCompliance(1, 'test-model');
      expect(result.policyLevel).toBe('enhanced');
      expect(result.actualModel).toBe('test-model');
    });
  });

  describe('getSensitiveDataTypes', () => {
    it('should return default sensitive data types', async () => {
      const types = await service.getSensitiveDataTypes(1);
      expect(types).toContain('api_key');
      expect(types).toContain('password');
      expect(types).toContain('token');
      expect(types).toContain('secret');
    });

    it('should return custom sensitive data types', async () => {
      await service.setPolicy(1, { sensitiveDataTypes: ['custom_type'] });
      const types = await service.getSensitiveDataTypes(1);
      expect(types).toEqual(['custom_type']);
    });
  });

  describe('getPIITypes', () => {
    it('should return default PII types', async () => {
      const types = await service.getPIITypes(1);
      expect(types).toContain('email');
      expect(types).toContain('phone');
      expect(types).toContain('name');
      expect(types).toContain('id_card');
      expect(types).toContain('address');
    });

    it('should return custom PII types', async () => {
      await service.setPolicy(1, { piiTypes: ['credit_card'] });
      const types = await service.getPIITypes(1);
      expect(types).toEqual(['credit_card']);
    });
  });

  describe('addCustomPattern', () => {
    it('should add custom pattern to policy', async () => {
      await service.addCustomPattern(1, { type: 'custom_token', pattern: 'CUSTOM-[a-zA-Z0-9]{16}' });
      const policy = await service.getPolicy(1);
      expect(policy.customPatterns.length).toBeGreaterThan(0);
      expect(policy.customPatterns[0].type).toBe('custom_token');
    });

    it('should preserve existing custom patterns', async () => {
      await service.addCustomPattern(1, { type: 'pattern1', pattern: 'REGEX1' });
      await service.addCustomPattern(1, { type: 'pattern2', pattern: 'REGEX2' });
      const policy = await service.getPolicy(1);
      expect(policy.customPatterns.length).toBe(2);
    });
  });

  describe('isAuditLoggingEnabled', () => {
    it('should return true by default', async () => {
      const enabled = await service.isAuditLoggingEnabled(1);
      expect(enabled).toBe(true);
    });

    it('should reflect policy changes', async () => {
      await service.setPolicy(1, { auditLoggingEnabled: false });
      const enabled = await service.isAuditLoggingEnabled(1);
      expect(enabled).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear cached policies', async () => {
      await service.setPolicy(1, { policyLevel: 'strict' });
      service.clearCache();
      const policy = await service.getPolicy(1);
      expect(policy.policyLevel).toBe('standard'); // Back to default
    });
  });

  describe('deletePolicy', () => {
    it('should delete policy for tenant', async () => {
      await service.setPolicy(1, { policyLevel: 'strict' });
      const deleted = await service.deletePolicy(1);
      expect(deleted).toBe(true);
      const policy = await service.getPolicy(1);
      expect(policy.policyLevel).toBe('standard'); // Back to default
    });
  });

  describe('policy levels', () => {
    it('should support all policy levels', async () => {
      const levels = ['standard', 'enhanced', 'strict', 'custom'];
      for (const level of levels) {
        const policy = await service.setPolicy(1, { policyLevel: level as any });
        expect(policy.policyLevel).toBe(level);
      }
    });

    it('should apply correct preset for enhanced level', async () => {
      const policy = await service.setPolicy(1, { policyLevel: 'enhanced' });
      expect(policy.nerModelType).toBe('bert-local');
      expect(policy.localModelRequired).toBe(false);
    });

    it('should apply correct preset for strict level', async () => {
      const policy = await service.setPolicy(1, { policyLevel: 'strict' });
      expect(policy.nerModelType).toBe('bert-local');
      expect(policy.localModelRequired).toBe(true);
    });
  });

  describe('with mock database', () => {
    it('should query database for policy', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({
          rows: [{
            tenant_id: 1,
            policy_level: 'strict',
            secret_sanitization_enabled: true,
            pii_sanitization_enabled: true,
            ner_model_type: 'bert-local',
            local_model_required: true,
            sensitive_data_types: ['api_key'],
            pii_types: ['email'],
            custom_patterns: [],
            audit_logging_enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          }],
          rowCount: 1,
        }),
      };

      const dbService = new TenantPrivacyPolicyService(mockDb as any);
      const policy = await dbService.getPolicy(1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_privacy_policies'),
        [1],
      );
      expect(policy.policyLevel).toBe('strict');
      expect(policy.localModelRequired).toBe(true);
    });

    it('should handle database query failure gracefully', async () => {
      const mockDb = {
        query: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      const dbService = new TenantPrivacyPolicyService(mockDb as any);
      const policy = await dbService.getPolicy(1);

      // Should return default policy on failure
      expect(policy.policyLevel).toBe('standard');
    });

    it('should persist policy to database', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      };

      const dbService = new TenantPrivacyPolicyService(mockDb as any);
      await dbService.setPolicy(1, { policyLevel: 'strict' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining([1, 'strict']),
      );
    });
  });
});