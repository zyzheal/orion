/**
 * Policy Module Barrel Export Tests
 *
 * Verifies that all expected exports are accessible from the policy index.
 */

import * as policyExports from '../index';

describe('policy/index.ts barrel exports', () => {
  describe('PolicyRepository exports', () => {
    it('should export PolicyRepository class', () => {
      expect(policyExports.PolicyRepository).toBeDefined();
      expect(typeof policyExports.PolicyRepository).toBe('function');
    });
  });

  describe('PolicyService exports', () => {
    it('should export PolicyService class', () => {
      expect(policyExports.PolicyService).toBeDefined();
      expect(typeof policyExports.PolicyService).toBe('function');
    });
  });

  describe('PolicyEvaluationService exports', () => {
    it('should export PolicyEvaluationService class', () => {
      expect(policyExports.PolicyEvaluationService).toBeDefined();
      expect(typeof policyExports.PolicyEvaluationService).toBe('function');
    });
  });

  describe('PolicyOverrideService exports', () => {
    it('should export PolicyOverrideService class', () => {
      expect(policyExports.PolicyOverrideService).toBeDefined();
      expect(typeof policyExports.PolicyOverrideService).toBe('function');
    });
  });
});
