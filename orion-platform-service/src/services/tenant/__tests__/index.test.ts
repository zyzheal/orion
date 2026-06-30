/**
 * Tenant Module Barrel Export Tests
 *
 * Verifies that all expected exports are accessible from the tenant index.
 */

import * as tenantExports from '../index';

describe('tenant/index.ts barrel exports', () => {
  describe('TenantContext exports', () => {
    it('should export TenantContext class', () => {
      expect(tenantExports.TenantContext).toBeDefined();
      expect(typeof tenantExports.TenantContext).toBe('function');
    });

    it('should export tenantContext singleton', () => {
      expect(tenantExports.tenantContext).toBeDefined();
      expect(typeof tenantExports.tenantContext).toBe('object');
    });
  });

  describe('TenantMiddleware exports', () => {
    it('should export createTenantMiddleware function', () => {
      expect(tenantExports.createTenantMiddleware).toBeDefined();
      expect(typeof tenantExports.createTenantMiddleware).toBe('function');
    });

    it('should export createTenantDatabaseHook function', () => {
      expect(tenantExports.createTenantDatabaseHook).toBeDefined();
      expect(typeof tenantExports.createTenantDatabaseHook).toBe('function');
    });

    it('should export createTenantDatabaseCleanupHook function', () => {
      expect(tenantExports.createTenantDatabaseCleanupHook).toBeDefined();
      expect(typeof tenantExports.createTenantDatabaseCleanupHook).toBe('function');
    });

    it('should export createTenantCleanupHook function', () => {
      expect(tenantExports.createTenantCleanupHook).toBeDefined();
      expect(typeof tenantExports.createTenantCleanupHook).toBe('function');
    });

    it('should export requireTenantMatch function', () => {
      expect(tenantExports.requireTenantMatch).toBeDefined();
      expect(typeof tenantExports.requireTenantMatch).toBe('function');
    });
  });

  describe('RLSPolicyManager exports', () => {
    it('should export RLSPolicyManager class', () => {
      expect(tenantExports.RLSPolicyManager).toBeDefined();
      expect(typeof tenantExports.RLSPolicyManager).toBe('function');
    });

    it('should export createRLSPolicyManager factory', () => {
      expect(tenantExports.createRLSPolicyManager).toBeDefined();
      expect(typeof tenantExports.createRLSPolicyManager).toBe('function');
    });
  });

  describe('TenantIsolationService exports', () => {
    it('should export TenantIsolationService class', () => {
      expect(tenantExports.TenantIsolationService).toBeDefined();
      expect(typeof tenantExports.TenantIsolationService).toBe('function');
    });
  });

  describe('TenantValidatorMiddleware exports', () => {
    it('should export TenantValidatorMiddleware class', () => {
      expect(tenantExports.TenantValidatorMiddleware).toBeDefined();
      expect(typeof tenantExports.TenantValidatorMiddleware).toBe('function');
    });

    it('should export createTenantValidatorMiddleware function', () => {
      expect(tenantExports.createTenantValidatorMiddleware).toBeDefined();
      expect(typeof tenantExports.createTenantValidatorMiddleware).toBe('function');
    });
  });

  describe('TenantQuotaService exports', () => {
    it('should export TenantQuotaService class', () => {
      expect(tenantExports.TenantQuotaService).toBeDefined();
      expect(typeof tenantExports.TenantQuotaService).toBe('function');
    });
  });

  describe('NamespacePoolService exports', () => {
    it('should export NamespacePoolService class', () => {
      expect(tenantExports.NamespacePoolService).toBeDefined();
      expect(typeof tenantExports.NamespacePoolService).toBe('function');
    });
  });

  describe('TenantRepository exports', () => {
    it('should export TenantRepository class', () => {
      expect(tenantExports.TenantRepository).toBeDefined();
      expect(typeof tenantExports.TenantRepository).toBe('function');
    });
  });

  describe('TenantService exports', () => {
    it('should export TenantService class', () => {
      expect(tenantExports.TenantService).toBeDefined();
      expect(typeof tenantExports.TenantService).toBe('function');
    });
  });
});
