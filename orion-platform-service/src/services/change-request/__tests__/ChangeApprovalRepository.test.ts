/**
 * ChangeApprovalRepository Tests
 * Covers listByChange, getNextPending, approve, reject, countByStatus, areAllApproved, mapRowToEntity
 */
import { ChangeApprovalRepository } from '../ChangeApprovalRepository';

describe('ChangeApprovalRepository', () => {
  let mockDb: { query: jest.Mock };
  let repo: ChangeApprovalRepository;

  const snakeRow = {
    id: 'appr-1',
    tenant_id: 'tenant-1',
    change_request_id: 'cr-1',
    approver_role: 'supervisor',
    approver_id: null,
    approval_order: 1,
    status: 'pending',
    comment: null,
    decided_at: null,
    created_at: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ChangeApprovalRepository(mockDb as any);
  });

  describe('listByChange', () => {
    it('should query by change_request_id ordered by approval_order', async () => {
      mockDb.query.mockResolvedValue({ rows: [snakeRow] });
      const result = await repo.listByChange('cr-1');
      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('change_request_id = $1 ORDER BY approval_order ASC'),
        ['cr-1'],
      );
    });
  });

  describe('getNextPending', () => {
    it('should return first pending approval', async () => {
      mockDb.query.mockResolvedValue({ rows: [snakeRow] });
      const result = await repo.getNextPending('cr-1');
      expect(result?.status).toBe('pending');
      expect(result?.approvalOrder).toBe(1);
    });

    it('should return undefined when no pending approvals', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repo.getNextPending('cr-1');
      expect(result).toBeUndefined();
    });
  });

  describe('approve', () => {
    it('should update status to approved with approver info', async () => {
      const approvedRow = { ...snakeRow, status: 'approved', approver_id: 'mgr-1', comment: 'LGTM', decided_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [approvedRow], rowCount: 1 });
      const result = await repo.approve('appr-1', 'mgr-1', 'LGTM');
      expect(result?.status).toBe('approved');
      expect(result?.approverId).toBe('mgr-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'approved'"),
        ['mgr-1', 'LGTM', 'appr-1'],
      );
    });

    it('should return undefined when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.approve('missing', 'mgr-1');
      expect(result).toBeUndefined();
    });
  });

  describe('reject', () => {
    it('should update status to rejected', async () => {
      const rejectedRow = { ...snakeRow, status: 'rejected', approver_id: 'mgr-1', comment: 'No', decided_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [rejectedRow], rowCount: 1 });
      const result = await repo.reject('appr-1', 'mgr-1', 'No');
      expect(result?.status).toBe('rejected');
    });
  });

  describe('countByStatus', () => {
    it('should return count for given status', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '2' }] });
      const result = await repo.countByStatus('cr-1', 'pending');
      expect(result).toBe(2);
    });
  });

  describe('areAllApproved', () => {
    it('should return true when all approvals are approved', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ total: '2', approved: '2' }] });
      const result = await repo.areAllApproved('cr-1');
      expect(result).toBe(true);
    });

    it('should return false when not all approved', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ total: '2', approved: '1' }] });
      const result = await repo.areAllApproved('cr-1');
      expect(result).toBe(false);
    });

    it('should return false when no approvals exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ total: '0', approved: '0' }] });
      const result = await repo.areAllApproved('cr-1');
      expect(result).toBe(false);
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case to camelCase', () => {
      const entity = (repo as any).mapRowToEntity(snakeRow);
      expect(entity.tenantId).toBe('tenant-1');
      expect(entity.changeRequestId).toBe('cr-1');
      expect(entity.approverRole).toBe('supervisor');
      expect(entity.approvalOrder).toBe(1);
    });

    it('should apply defaults for nullable fields', () => {
      const minimal = { ...snakeRow, approver_id: null, status: null, comment: null, decided_at: null };
      const entity = (repo as any).mapRowToEntity(minimal);
      expect(entity.approverId).toBeNull();
      expect(entity.status).toBe('pending');
      expect(entity.comment).toBeNull();
      expect(entity.decidedAt).toBeNull();
    });
  });
});
