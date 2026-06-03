/**
 * ProgressiveDeployRepository 单元测试
 *
 * Coverage: findById, findByDeployment, findCurrentStage, findNextPendingStage,
 *           findPreviousCompletedStage, create, createMany, update, countByDeployment
 */

import { ProgressiveDeployRepository } from '../ProgressiveDeployRepository';

describe('ProgressiveDeployRepository', () => {
  let repo: ProgressiveDeployRepository;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new ProgressiveDeployRepository(mockPool as any);
  });

  // ==================== findById ====================

  describe('findById', () => {
    it('should return stage by id', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 's-1',
          tenant_id: 't-1',
          deployment_id: 'd-1',
          stage_name: 'canary',
          stage_order: 1,
          traffic_percent: 10,
          status: 'running',
        }],
      });

      const result = await repo.findById('s-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('s-1');
      expect(result!.stage_name).toBe('canary');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== findByDeployment ====================

  describe('findByDeployment', () => {
    it('should return all stages for a deployment', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 's-1', stage_order: 1, stage_name: 'canary' },
          { id: 's-2', stage_order: 2, stage_name: 'blue-green' },
          { id: 's-3', stage_order: 3, stage_name: 'full' },
        ],
      });

      const result = await repo.findByDeployment('d-1');

      expect(result).toHaveLength(3);
      expect(result[0].stage_order).toBe(1);
    });

    it('should return empty when no stages', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByDeployment('d-empty');

      expect(result).toHaveLength(0);
    });

    it('should order by stage_order ASC', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findByDeployment('d-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY stage_order ASC'),
        ['d-1']
      );
    });
  });

  // ==================== findCurrentStage ====================

  describe('findCurrentStage', () => {
    it('should return the running stage', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 's-2',
          deployment_id: 'd-1',
          status: 'running',
          stage_order: 2,
        }],
      });

      const result = await repo.findCurrentStage('d-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('running');
    });

    it('should return null when no running stage', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findCurrentStage('d-1');

      expect(result).toBeNull();
    });
  });

  // ==================== findNextPendingStage ====================

  describe('findNextPendingStage', () => {
    it('should return the next pending stage', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 's-3',
          deployment_id: 'd-1',
          status: 'pending',
          stage_order: 3,
        }],
      });

      const result = await repo.findNextPendingStage('d-1');

      expect(result).toBeDefined();
      expect(result!.status).toBe('pending');
    });

    it('should return null when no pending stage', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findNextPendingStage('d-1');

      expect(result).toBeNull();
    });
  });

  // ==================== findPreviousCompletedStage ====================

  describe('findPreviousCompletedStage', () => {
    it('should return the previous completed stage', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 's-1',
          deployment_id: 'd-1',
          status: 'completed',
          stage_order: 1,
        }],
      });

      const result = await repo.findPreviousCompletedStage('d-1', 2);

      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
      expect(result!.stage_order).toBe(1);
    });

    it('should return null when no previous completed stage', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findPreviousCompletedStage('d-1', 1);

      expect(result).toBeNull();
    });
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create a progressive stage', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 's-1',
          tenant_id: 't-1',
          deployment_id: 'd-1',
          stage_name: 'canary',
          stage_order: 1,
          traffic_percent: 10,
          instance_count: 1,
          status: 'pending',
          auto_promote: true,
        }],
      });

      const result = await repo.create({
        tenant_id: 't-1',
        deployment_id: 'd-1',
        stage_name: 'canary',
        stage_order: 1,
        traffic_percent: 10,
      });

      expect(result.id).toBe('s-1');
      expect(result.status).toBe('pending');
    });

    it('should create with optional fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's-1' }],
      });

      await repo.create({
        tenant_id: 't-1',
        deployment_id: 'd-1',
        stage_name: 'canary',
        stage_order: 1,
        traffic_percent: 10,
        instance_count: 3,
        auto_promote: false,
      });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(3);
      expect(params).toContain(false);
    });

    it('should default instance_count to 1', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's-1' }],
      });

      await repo.create({
        tenant_id: 't-1',
        deployment_id: 'd-1',
        stage_name: 'canary',
        stage_order: 1,
        traffic_percent: 10,
      });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(1);
    });

    it('should default auto_promote to true when not specified', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's-1' }],
      });

      await repo.create({
        tenant_id: 't-1',
        deployment_id: 'd-1',
        stage_name: 'canary',
        stage_order: 1,
        traffic_percent: 10,
      });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(true);
    });
  });

  // ==================== createMany ====================

  describe('createMany', () => {
    it('should create multiple stages', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 's-1', stage_name: 'canary', stage_order: 1 }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 's-2', stage_name: 'blue-green', stage_order: 2 }],
        });

      const result = await repo.createMany([
        {
          tenant_id: 't-1',
          deployment_id: 'd-1',
          stage_name: 'canary',
          stage_order: 1,
          traffic_percent: 10,
        },
        {
          tenant_id: 't-1',
          deployment_id: 'd-1',
          stage_name: 'blue-green',
          stage_order: 2,
          traffic_percent: 50,
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('s-1');
      expect(result[1].id).toBe('s-2');
    });

    it('should return empty array for empty input', async () => {
      const result = await repo.createMany([]);

      expect(result).toHaveLength(0);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update status', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's-1', status: 'running' }],
      });

      const result = await repo.update('s-1', { status: 'running' });

      expect(result).toBeDefined();
      expect(result!.status).toBe('running');
    });

    it('should update validation_result', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's-1', validation_result: { passed: true } }],
      });

      const result = await repo.update('s-1', {
        validation_result: { passed: true },
      });

      expect(result).toBeDefined();
    });

    it('should update started_at', async () => {
      const now = new Date();
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's-1', started_at: now }],
      });

      const result = await repo.update('s-1', { started_at: now });

      expect(result).toBeDefined();
    });

    it('should update completed_at', async () => {
      const now = new Date();
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's-1', completed_at: now }],
      });

      const result = await repo.update('s-1', { completed_at: now });

      expect(result).toBeDefined();
    });

    it('should update multiple fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 's-1', status: 'completed' }],
      });

      const result = await repo.update('s-1', {
        status: 'completed',
        validation_result: { passed: true },
        completed_at: new Date(),
      });

      const [query] = mockPool.query.mock.calls[0];
      expect(query).toContain('status = $');
      expect(query).toContain('validation_result = $');
      expect(query).toContain('completed_at = $');
      expect(query).toContain('updated_at = NOW()');
    });

    it('should return existing stage when no updates provided', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 's-1', status: 'pending' }],
      });

      const result = await repo.update('s-1', {});

      expect(result).toBeDefined();
    });

    it('should return null when not found after update', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.update('s-1', { status: 'running' });

      expect(result).toBeNull();
    });
  });

  // ==================== countByDeployment ====================

  describe('countByDeployment', () => {
    it('should return counts by status', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          total: '5',
          pending: '2',
          running: '1',
          completed: '1',
          failed: '1',
          skipped: '0',
        }],
      });

      const result = await repo.countByDeployment('d-1');

      expect(result.total).toBe(5);
      expect(result.pending).toBe(2);
      expect(result.running).toBe(1);
      expect(result.completed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should handle null values', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          total: null,
          pending: null,
          running: null,
          completed: null,
          failed: null,
          skipped: null,
        }],
      });

      const result = await repo.countByDeployment('d-1');

      expect(result.total).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.running).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repo.findById('s-1')).rejects.toThrow('Connection refused');
    });

    it('should propagate errors on create', async () => {
      mockPool.query.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(repo.create({
        tenant_id: 't-1',
        deployment_id: 'd-1',
        stage_name: 'canary',
        stage_order: 1,
        traffic_percent: 10,
      })).rejects.toThrow('Unique constraint violation');
    });
  });
});
