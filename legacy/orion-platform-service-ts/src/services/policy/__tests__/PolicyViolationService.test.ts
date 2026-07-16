/**
 * PolicyViolationService - Unit Tests
 *
 * Tests for violation recording, listing, updating, statistics,
 * bulk operations, and mock mode behavior.
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import { PolicyViolationService, RecordViolationInput } from '../PolicyViolationService';

describe('PolicyViolationService', () => {
  let service: PolicyViolationService;

  beforeEach(() => {
    service = new PolicyViolationService(); // No db = mock mode
  });

  // ==================== recordViolation ====================

  describe('recordViolation', () => {
    it('should record a violation with required fields', async () => {
      const input: RecordViolationInput = {
        severity: 'high',
        message: 'Security scan failed',
      };

      const violation = await service.recordViolation(input);

      expect(violation.id).toBeDefined();
      expect(violation.severity).toBe('high');
      expect(violation.message).toBe('Security scan failed');
      expect(violation.status).toBe('open');
      expect(violation.created_at).toBeInstanceOf(Date);
    });

    it('should record a violation with all optional fields', async () => {
      const input: RecordViolationInput = {
        evaluationId: 'eval-1',
        policyId: 'policy-1',
        severity: 'critical',
        message: 'Critical security issue',
        resourceType: 'deployment',
        resourceId: 'deploy-123',
      };

      const violation = await service.recordViolation(input);

      expect(violation.evaluation_id).toBe('eval-1');
      expect(violation.policy_id).toBe('policy-1');
      expect(violation.severity).toBe('critical');
      expect(violation.resource_type).toBe('deployment');
      expect(violation.resource_id).toBe('deploy-123');
    });

    it('should default optional fields to null', async () => {
      const violation = await service.recordViolation({
        severity: 'low',
        message: 'Minor issue',
      });

      expect(violation.evaluation_id).toBeNull();
      expect(violation.policy_id).toBeNull();
      expect(violation.resource_type).toBeNull();
      expect(violation.resource_id).toBeNull();
    });

    it('should support all severity levels', async () => {
      const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;

      for (const severity of severities) {
        const violation = await service.recordViolation({
          severity,
          message: `${severity} issue`,
        });
        expect(violation.severity).toBe(severity);
      }
    });
  });

  // ==================== recordViolations ====================

  describe('recordViolations', () => {
    it('should record multiple violations', async () => {
      const inputs: RecordViolationInput[] = [
        { severity: 'high', message: 'Issue 1' },
        { severity: 'medium', message: 'Issue 2' },
        { severity: 'low', message: 'Issue 3' },
      ];

      const violations = await service.recordViolations(inputs);

      expect(violations).toHaveLength(3);
      expect(violations[0].message).toBe('Issue 1');
      expect(violations[1].message).toBe('Issue 2');
      expect(violations[2].message).toBe('Issue 3');
    });

    it('should return empty array for empty input', async () => {
      const violations = await service.recordViolations([]);
      expect(violations).toEqual([]);
    });
  });

  // ==================== getViolation ====================

  describe('getViolation', () => {
    it('should return null in mock mode', async () => {
      const result = await service.getViolation('any-id');
      expect(result).toBeNull();
    });
  });

  // ==================== listViolations ====================

  describe('listViolations', () => {
    it('should return empty list in mock mode', async () => {
      const result = await service.listViolations();
      expect(result.violations).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should accept filter options', async () => {
      const result = await service.listViolations({
        status: 'open',
        severity: 'high',
        policyId: 'policy-1',
        limit: 10,
        offset: 0,
      });
      expect(result.violations).toEqual([]);
    });
  });

  // ==================== updateViolation ====================

  describe('updateViolation', () => {
    it('should return null in mock mode', async () => {
      const result = await service.updateViolation('any-id', { status: 'resolved' });
      expect(result).toBeNull();
    });
  });

  // ==================== deleteViolation ====================

  describe('deleteViolation', () => {
    it('should return false in mock mode', async () => {
      const result = await service.deleteViolation('any-id');
      expect(result).toBe(false);
    });
  });

  // ==================== getViolationStats ====================

  describe('getViolationStats', () => {
    it('should return empty stats in mock mode', async () => {
      const stats = await service.getViolationStats();

      expect(stats.total).toBe(0);
      expect(stats.bySeverity).toEqual({});
      expect(stats.byStatus).toEqual({});
      expect(stats.byPolicy).toEqual({});
      expect(stats.recentTrend).toEqual([]);
    });

    it('should accept filter options', async () => {
      const stats = await service.getViolationStats({
        policyId: 'policy-1',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });
      expect(stats.total).toBe(0);
    });
  });

  // ==================== getOpenViolationsCount ====================

  describe('getOpenViolationsCount', () => {
    it('should return 0 in mock mode', async () => {
      const count = await service.getOpenViolationsCount();
      expect(count).toBe(0);
    });

    it('should accept policyId filter', async () => {
      const count = await service.getOpenViolationsCount('policy-1');
      expect(count).toBe(0);
    });
  });

  // ==================== getCriticalViolations ====================

  describe('getCriticalViolations', () => {
    it('should return empty array in mock mode', async () => {
      const violations = await service.getCriticalViolations();
      expect(violations).toEqual([]);
    });
  });

  // ==================== acknowledgeViolations ====================

  describe('acknowledgeViolations', () => {
    it('should return 0 acknowledged in mock mode', async () => {
      const count = await service.acknowledgeViolations(['id-1', 'id-2']);
      expect(count).toBe(0);
    });

    it('should handle empty array', async () => {
      const count = await service.acknowledgeViolations([]);
      expect(count).toBe(0);
    });
  });

  // ==================== resolveViolations ====================

  describe('resolveViolations', () => {
    it('should return 0 resolved in mock mode', async () => {
      const count = await service.resolveViolations(['id-1']);
      expect(count).toBe(0);
    });
  });

  // ==================== setRepository ====================

  describe('setRepository', () => {
    it('should accept a repository instance', () => {
      const mockRepo = {} as any;
      // Should not throw
      service.setRepository(mockRepo);
    });
  });
});
