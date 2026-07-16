/**
 * ExemptionService - Unit Tests
 *
 * Tests for exemption submission, review (approve/reject), revocation,
 * expiration, active exemption checking, and filtering.
 *
 * Uses mock database pool since ExemptionService requires db.
 */

// Mock uuid
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `exemption-uuid-${++uuidCounter}`),
}));

import {
  ExemptionService,
  ExemptionServiceError,
  ExemptionCreateInput,
  ExemptionReviewInput,
} from '../ExemptionService';

// ==================== Mock Database ====================

function createMockDb() {
  const store = new Map<string, any>();

  const db = {
    query: jest.fn().mockImplementation(async (text: string, params?: unknown[]) => {
      // INSERT
      if (text.includes('INSERT INTO policy_exemptions')) {
        const id = params![0] as string;
        const row = {
          id,
          violation_id: params![1],
          policy_id: params![2],
          run_id: params![3],
          reason: params![4],
          category: params![5],
          requested_by: params![6],
          status: params![7],
          expires_at: params![8],
          approval_chain: params![9],
          created_at: params![10],
          updated_at: params![11],
        };
        store.set(id, row);
        return { rows: [], rowCount: 1 };
      }

      // UPDATE status + approval_chain (review)
      if (text.includes('UPDATE policy_exemptions SET status = $1, approval_chain = $2')) {
        const id = params![2] as string;
        const row = store.get(id);
        if (row) {
          row.status = params![0];
          row.approval_chain = params![1];
          row.updated_at = new Date();
        }
        return { rows: [], rowCount: row ? 1 : 0 };
      }

      // UPDATE status to revoked
      if (text.includes("SET status = 'revoked'")) {
        const id = params![0] as string;
        const row = store.get(id);
        if (row) {
          row.status = 'revoked';
          row.updated_at = new Date();
        }
        return { rows: [], rowCount: row ? 1 : 0 };
      }

      // UPDATE expire
      if (text.includes("SET status = 'expired'")) {
        let count = 0;
        for (const row of store.values()) {
          if (row.status === 'approved' && row.expires_at <= new Date()) {
            row.status = 'expired';
            row.updated_at = new Date();
            count++;
          }
        }
        return { rows: [], rowCount: count };
      }

      // SELECT by id (after UPDATE checks to avoid matching UPDATE ... WHERE id = $1)
      if (text.includes('WHERE id = $1') && text.includes('SELECT')) {
        const id = params![0] as string;
        const row = store.get(id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // SELECT COUNT for hasActiveExemption
      if (text.includes('SELECT COUNT(*)')) {
        const violationId = params![0] as string;
        let count = 0;
        for (const row of store.values()) {
          if (row.violation_id === violationId && row.status === 'approved' && row.expires_at > new Date()) {
            count++;
          }
        }
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }

      // SELECT with filters (getExemptions)
      if (text.includes('SELECT * FROM policy_exemptions WHERE 1=1')) {
        let rows = Array.from(store.values());
        const paramIdx = 1;

        // Simple filter matching based on params
        if (params && params.length >= 2) {
          // Parse filter from query
          if (text.includes('status = $')) {
            rows = rows.filter(r => r.status === params[0]);
          }
        }

        rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const limit = params ? params[params.length - 2] as number : 50;
        const offset = params ? params[params.length - 1] as number : 0;
        const paginated = rows.slice(offset, offset + limit);

        return { rows: paginated, rowCount: paginated.length };
      }

      return { rows: [], rowCount: 0 };
    }),
  };

  return { db, store };
}

// ==================== Tests ====================

describe('ExemptionService', () => {
  let service: ExemptionService;
  let mockDb: ReturnType<typeof createMockDb>['db'];
  let store: ReturnType<typeof createMockDb>['store'];

  beforeEach(() => {
    uuidCounter = 0;
    const mock = createMockDb();
    mockDb = mock.db;
    store = mock.store;
    service = new ExemptionService(mockDb);
  });

  // ==================== submitExemption ====================

  describe('submitExemption', () => {
    it('should submit an exemption with required fields', async () => {
      const input: ExemptionCreateInput = {
        violationId: 'viol-1',
        policyId: 'policy-1',
        runId: 'run-1',
        reason: 'False positive in security scan',
        category: 'false-positive',
        requestedBy: 'developer',
      };

      const exemption = await service.submitExemption(input);

      expect(exemption.id).toBe('exemption-uuid-1');
      expect(exemption.violationId).toBe('viol-1');
      expect(exemption.policyId).toBe('policy-1');
      expect(exemption.reason).toBe('False positive in security scan');
      expect(exemption.category).toBe('false-positive');
      expect(exemption.requestedBy).toBe('developer');
      expect(exemption.status).toBe('pending');
      expect(exemption.approvalChain).toEqual([]);
      expect(exemption.createdAt).toBeInstanceOf(Date);
    });

    it('should default expiresAt to 7 days', async () => {
      const before = new Date();
      const exemption = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'policy-1',
        runId: 'run-1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
      });

      const expectedExpiry = new Date(before.getTime() + 7 * 24 * 60 * 60 * 1000);
      // Allow 1 second tolerance
      expect(Math.abs(exemption.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });

    it('should use custom expiresAt when provided', async () => {
      const customExpiry = new Date('2026-12-31');
      const exemption = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'policy-1',
        runId: 'run-1',
        reason: 'test',
        category: 'tech-debt',
        requestedBy: 'dev',
        expiresAt: customExpiry,
      });

      expect(exemption.expiresAt).toEqual(customExpiry);
    });

    it('should throw error for missing required fields', async () => {
      await expect(
        service.submitExemption({
          violationId: '',
          policyId: 'p1',
          runId: 'r1',
          reason: 'test',
          category: 'temporary',
          requestedBy: 'dev',
        })
      ).rejects.toThrow(ExemptionServiceError);
    });

    it('should throw error for missing reason', async () => {
      await expect(
        service.submitExemption({
          violationId: 'v1',
          policyId: 'p1',
          runId: 'r1',
          reason: '',
          category: 'temporary',
          requestedBy: 'dev',
        })
      ).rejects.toThrow(ExemptionServiceError);
    });

    it('should support all exemption categories', async () => {
      const categories = ['business-urgency', 'tech-debt', 'false-positive', 'temporary'] as const;

      for (const category of categories) {
        const exemption = await service.submitExemption({
          violationId: `viol-${category}`,
          policyId: 'p1',
          runId: 'r1',
          reason: `Testing ${category}`,
          category,
          requestedBy: 'dev',
        });
        expect(exemption.category).toBe(category);
      }
    });
  });

  // ==================== getExemptionById ====================

  describe('getExemptionById', () => {
    it('should return exemption by ID', async () => {
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
      });

      const found = await service.getExemptionById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.reason).toBe('test');
    });

    it('should throw error for non-existent ID', async () => {
      await expect(service.getExemptionById('non-existent')).rejects.toThrow(ExemptionServiceError);
    });
  });

  // ==================== reviewExemption ====================

  describe('reviewExemption', () => {
    it('should approve a pending exemption', async () => {
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'false-positive',
        requestedBy: 'dev',
      });

      const reviewed = await service.reviewExemption(created.id, {
        action: 'approve',
        reviewer: 'manager',
        comment: 'Looks valid',
      });

      expect(reviewed.status).toBe('approved');
      expect(reviewed.approvalChain).toHaveLength(1);
      expect(reviewed.approvalChain[0].approver).toBe('manager');
      expect(reviewed.approvalChain[0].action).toBe('approve');
      expect(reviewed.approvalChain[0].comment).toBe('Looks valid');
    });

    it('should reject a pending exemption', async () => {
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
      });

      const reviewed = await service.reviewExemption(created.id, {
        action: 'reject',
        reviewer: 'manager',
        comment: 'Not justified',
      });

      expect(reviewed.status).toBe('rejected');
      expect(reviewed.approvalChain[0].action).toBe('reject');
    });

    it('should throw error for non-existent exemption', async () => {
      await expect(
        service.reviewExemption('non-existent', { action: 'approve', reviewer: 'mgr' })
      ).rejects.toThrow(ExemptionServiceError);
    });

    it('should throw error for already approved exemption', async () => {
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
      });

      await service.reviewExemption(created.id, { action: 'approve', reviewer: 'mgr-1' });

      await expect(
        service.reviewExemption(created.id, { action: 'approve', reviewer: 'mgr-2' })
      ).rejects.toThrow('not pending');
    });

    it('should throw error for missing action or reviewer', async () => {
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
      });

      await expect(
        service.reviewExemption(created.id, { action: '' as any, reviewer: 'mgr' })
      ).rejects.toThrow(ExemptionServiceError);

      await expect(
        service.reviewExemption(created.id, { action: 'approve', reviewer: '' })
      ).rejects.toThrow(ExemptionServiceError);
    });

    it('should throw error for invalid action', async () => {
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
      });

      await expect(
        service.reviewExemption(created.id, { action: 'invalid' as any, reviewer: 'mgr' })
      ).rejects.toThrow('approve or reject');
    });
  });

  // ==================== revokeExemption ====================

  describe('revokeExemption', () => {
    it('should revoke an approved exemption', async () => {
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
      });

      await service.reviewExemption(created.id, { action: 'approve', reviewer: 'mgr' });
      const revoked = await service.revokeExemption(created.id);

      expect(revoked.status).toBe('revoked');
    });

    it('should throw error for non-approved exemption', async () => {
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
      });

      // Still pending - cannot revoke
      await expect(service.revokeExemption(created.id)).rejects.toThrow('Only approved');
    });

    it('should throw error for non-existent exemption', async () => {
      await expect(service.revokeExemption('non-existent')).rejects.toThrow(ExemptionServiceError);
    });
  });

  // ==================== expireExemptions ====================

  describe('expireExemptions', () => {
    it('should expire past-due exemptions', async () => {
      // Create and approve an exemption with past expiry
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      await service.reviewExemption(created.id, { action: 'approve', reviewer: 'mgr' });
      const count = await service.expireExemptions();

      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should return 0 when no exemptions to expire', async () => {
      const count = await service.expireExemptions();
      expect(count).toBe(0);
    });
  });

  // ==================== hasActiveExemption ====================

  describe('hasActiveExemption', () => {
    it('should return false when no active exemption exists', async () => {
      const result = await service.hasActiveExemption('viol-1');
      expect(result).toBe(false);
    });

    it('should return true when active exemption exists', async () => {
      const created = await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test',
        category: 'temporary',
        requestedBy: 'dev',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      });

      await service.reviewExemption(created.id, { action: 'approve', reviewer: 'mgr' });
      const result = await service.hasActiveExemption('viol-1');
      expect(result).toBe(true);
    });
  });

  // ==================== getExemptions ====================

  describe('getExemptions', () => {
    it('should return exemptions list', async () => {
      await service.submitExemption({
        violationId: 'viol-1',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test 1',
        category: 'temporary',
        requestedBy: 'dev',
      });

      await service.submitExemption({
        violationId: 'viol-2',
        policyId: 'p1',
        runId: 'r1',
        reason: 'test 2',
        category: 'false-positive',
        requestedBy: 'dev',
      });

      const result = await service.getExemptions();
      expect(result.exemptions.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await service.submitExemption({
          violationId: `viol-${i}`,
          policyId: 'p1',
          runId: 'r1',
          reason: `test ${i}`,
          category: 'temporary',
          requestedBy: 'dev',
        });
      }

      const result = await service.getExemptions({ limit: 2, offset: 0 });
      expect(result.exemptions.length).toBeLessThanOrEqual(2);
    });
  });
});
