/**
 * EmergencyDeployRepository 单元测试
 *
 * Coverage: findById, findAll, count, create, approve, reject, complete, fail
 */

import { EmergencyDeployRepository } from '../EmergencyDeployRepository';

describe('EmergencyDeployRepository', () => {
  let repo: EmergencyDeployRepository;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new EmergencyDeployRepository(mockPool as any);
  });

  // ==================== findById ====================

  describe('findById', () => {
    it('should return emergency deploy by id', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'e-1',
          tenant_id: 't-1',
          deployment_id: 'd-1',
          reason: 'Production outage',
          status: 'pending',
        }],
      });

      const result = await repo.findById('e-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('e-1');
      expect(result!.reason).toBe('Production outage');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== findAll ====================

  describe('findAll', () => {
    it('should find all emergency deploys', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'e-1', tenant_id: 't-1' },
          { id: 'e-2', tenant_id: 't-1' },
        ],
      });

      const result = await repo.findAll();

      expect(result).toHaveLength(2);
    });

    it('should filter by tenantId', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll({ tenantId: 't-1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        expect.arrayContaining(['t-1'])
      );
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll({ status: 'approved' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.arrayContaining(['approved'])
      );
    });

    it('should filter by multiple options', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll({ tenantId: 't-1', status: 'pending', limit: 10, offset: 5 });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('tenant_id');
      expect(query).toContain('status');
      expect(query).toContain('LIMIT');
      expect(query).toContain('OFFSET');
      expect(params).toEqual(['t-1', 'pending', 10, 5]);
    });

    it('should order by created_at DESC', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });
  });

  // ==================== count ====================

  describe('count', () => {
    it('should count all emergency deploys', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '15' }] });

      const result = await repo.count();

      expect(result).toBe(15);
    });

    it('should count with tenantId filter', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '3' }] });

      const result = await repo.count({ tenantId: 't-1' });

      expect(result).toBe(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t-1']
      );
    });

    it('should count with status filter', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '7' }] });

      const result = await repo.count({ status: 'pending' });

      expect(result).toBe(7);
    });

    it('should count with both filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '2' }] });

      const result = await repo.count({ tenantId: 't-1', status: 'approved' });

      expect(result).toBe(2);
    });
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create a new emergency deploy', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'e-1',
          tenant_id: 't-1',
          deployment_id: 'd-1',
          reason: 'Production hotfix',
          requested_by: 'user-1',
          status: 'pending',
        }],
      });

      const result = await repo.create({
        tenant_id: 't-1',
        deployment_id: 'd-1',
        reason: 'Production hotfix',
        requested_by: 'user-1',
      });

      expect(result.id).toBe('e-1');
      expect(result.status).toBe('pending');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deploy_emergencies'),
        ['t-1', 'd-1', 'Production hotfix', 'user-1']
      );
    });
  });

  // ==================== approve ====================

  describe('approve', () => {
    it('should approve an emergency deploy', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'e-1',
          status: 'approved',
          approved_by: 'approver-1',
        }],
      });

      const result = await repo.approve('e-1', 'approver-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('approved');
      expect(result!.approved_by).toBe('approver-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'approved'"),
        ['approver-1', 'e-1']
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.approve('non-existent', 'approver-1');

      expect(result).toBeNull();
    });
  });

  // ==================== reject ====================

  describe('reject', () => {
    it('should reject an emergency deploy', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'e-1', status: 'rejected' }],
      });

      const result = await repo.reject('e-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('rejected');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'rejected'"),
        ['e-1']
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.reject('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== complete ====================

  describe('complete', () => {
    it('should complete with post-mortem', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'e-1', status: 'completed', post_mortem: 'Root cause analysis' }],
      });

      const result = await repo.complete('e-1', 'Root cause analysis');

      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
      expect(result!.post_mortem).toBe('Root cause analysis');
    });

    it('should complete without post-mortem', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'e-1', status: 'completed', post_mortem: null }],
      });

      const result = await repo.complete('e-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'completed'"),
        [null, 'e-1']
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.complete('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== fail ====================

  describe('fail', () => {
    it('should mark as failed', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'e-1', status: 'failed' }],
      });

      const result = await repo.fail('e-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('failed');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'failed'"),
        ['e-1']
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.fail('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repo.findById('e-1')).rejects.toThrow('Connection refused');
    });

    it('should propagate errors on create', async () => {
      mockPool.query.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(repo.create({
        tenant_id: 't-1',
        deployment_id: 'd-1',
        reason: 'test',
        requested_by: 'user-1',
      })).rejects.toThrow('Unique constraint violation');
    });
  });
});
