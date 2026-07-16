/**
 * TenantPrivacyPolicyService Tests
 *
 * Covers:
 * - Constructor: with/without DB
 * - getPolicy: default policy, cached policy
 * - setPolicy: create/update policy
 * - getSanitizationConfig: config extraction
 * - checkCompliance: compliant/non-compliant
 */

import { TenantPrivacyPolicyService } from '../TenantPrivacyPolicyService';

jest.mock('pino', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return jest.fn(() => mockLogger);
});

describe('TenantPrivacyPolicyService', () => {
  let service: TenantPrivacyPolicyService;

  beforeEach(() => {
    service = new TenantPrivacyPolicyService();
  });

  describe('constructor', () => {
    it('should create without DB', () => {
      expect(service).toBeDefined();
    });

    it('should create with DB', () => {
      const mockDb = { query: jest.fn() };
      const svc = new TenantPrivacyPolicyService(mockDb);
      expect(svc).toBeDefined();
    });
  });

  describe('getPolicy', () => {
    it('should return default policy for new tenant', async () => {
      const policy = await service.getPolicy(1);
      expect(policy.tenantId).toBe(1);
      expect(policy.policyLevel).toBe('standard');
      expect(policy.secretSanitizationEnabled).toBe(true);
      expect(policy.piiSanitizationEnabled).toBe(true);
    });

    it('should return cached policy on second call', async () => {
      await service.getPolicy(1);
      const policy = await service.getPolicy(1);
      expect(policy.tenantId).toBe(1);
    });
  });

  describe('setPolicy', () => {
    it('should set custom policy', async () => {
      const policy = await service.setPolicy(1, {
        policyLevel: 'strict',
        nerModelType: 'bert-local',
        localModelRequired: true,
      });

      expect(policy.policyLevel).toBe('strict');
      expect(policy.localModelRequired).toBe(true);
    });

    it('should merge with defaults', async () => {
      const policy = await service.setPolicy(2, { policyLevel: 'enhanced' });
      expect(policy.policyLevel).toBe('enhanced');
      expect(policy.secretSanitizationEnabled).toBe(true); // default
    });
  });

  describe('getSanitizationConfig', () => {
    it('should return sanitization config', async () => {
      const config = await service.getSanitizationConfig(1);
      expect(config).toHaveProperty('secretEnabled');
      expect(config).toHaveProperty('piiEnabled');
      expect(config).toHaveProperty('nerModel');
    });
  });

  describe('validatePolicyCompliance', () => {
    it('should return compliant for local model', async () => {
      const result = await service.validatePolicyCompliance(1, 'bert-local-model');
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should flag violation for remote model when strict', async () => {
      await service.setPolicy(1, { policyLevel: 'strict' });
      const result = await service.validatePolicyCompliance(1, 'openai-gpt-4');
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('isLocalModelRequired', () => {
    it('should return false for standard policy', async () => {
      expect(await service.isLocalModelRequired(1)).toBe(false);
    });

    it('should return true for strict policy', async () => {
      await service.setPolicy(1, { policyLevel: 'strict' });
      expect(await service.isLocalModelRequired(1)).toBe(true);
    });
  });

  describe('getSensitiveDataTypes', () => {
    it('should return default sensitive data types', async () => {
      const types = await service.getSensitiveDataTypes(1);
      expect(types).toContain('api_key');
      expect(types).toContain('password');
    });
  });

  describe('getPIITypes', () => {
    it('should return default PII types', async () => {
      const types = await service.getPIITypes(1);
      expect(types).toContain('email');
      expect(types).toContain('phone');
    });
  });

  describe('isAuditLoggingEnabled', () => {
    it('should return true by default', async () => {
      expect(await service.isAuditLoggingEnabled(1)).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear cached policies', async () => {
      await service.getPolicy(1);
      service.clearCache();
      // Next getPolicy should return fresh default
      const policy = await service.getPolicy(1);
      expect(policy.tenantId).toBe(1);
    });
  });

  describe('deletePolicy', () => {
    it('should delete policy from cache', async () => {
      await service.getPolicy(1);
      const deleted = await service.deletePolicy(1);
      expect(deleted).toBe(true);
    });
  });
});
