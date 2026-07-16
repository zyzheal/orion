/**
 * DeployRepository - Deploy Database Layer Unit Tests
 *
 * Coverage: findById, findAll, count, create, update, startDeployment,
 *           completeDeployment, findLatestByEnvironment, findByBuild,
 *           findRollbackTarget, findEvents, createEvent, getDeployStats, getEnvironments
 */

import { DeployRepository } from '../DeployRepository';

describe('DeployRepository', () => {
  let repo: DeployRepository;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new DeployRepository(mockPool as any);
  });

  // ==================== findById ====================

  describe('findById', () => {
    it('should return deployment by id', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-1', tenant_id: 't-1', environment: 'prod', status: 'success' }],
      });

      const result = await repo.findById('d-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('d-1');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== findAll ====================

  describe('findAll', () => {
    it('should find all deployments', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'd-1', tenant_id: 't-1' },
          { id: 'd-2', tenant_id: 't-1' },
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

    it('should filter by multiple options', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll({ tenantId: 't-1', environment: 'prod', status: 'success', limit: 10, offset: 5 });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('tenant_id');
      expect(query).toContain('environment');
      expect(query).toContain('status');
      expect(query).toContain('LIMIT');
      expect(query).toContain('OFFSET');
    });

    it('should filter by since date', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const since = new Date('2026-01-01');

      await repo.findAll({ since });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.arrayContaining([since])
      );
    });
  });

  // ==================== count ====================

  describe('count', () => {
    it('should count all deployments', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await repo.count();

      expect(result).toBe(42);
    });

    it('should count with filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await repo.count({ tenantId: 't-1', environment: 'prod' });

      expect(result).toBe(5);
    });
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create deployment', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-1', tenant_id: 't-1', environment: 'prod', status: 'pending' }],
      });

      const result = await repo.create({
        tenant_id: 't-1',
        environment: 'prod',
      });

      expect(result.id).toBe('d-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deployments'),
        expect.arrayContaining(['t-1', null, null, null, 'prod'])
      );
    });

    it('should create with all fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-1' }],
      });

      await repo.create({
        tenant_id: 't-1',
        project_id: 'p-1',
        pipeline_run_id: 'r-1',
        build_id: 'b-1',
        environment: 'staging',
        strategy: 'canary',
        config: { replicas: 3 },
        deployed_by: 'user-1',
        commit_sha: 'abc123',
      });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain('p-1');
      expect(params).toContain('canary');
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update deployment fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-1', status: 'deploying' }],
      });

      const result = await repo.update('d-1', { status: 'deploying', error_message: 'test' });

      expect(result).toBeDefined();
    });

    it('should return existing when no updates', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'd-1', status: 'pending' }],
      });

      const result = await repo.update('d-1', {});

      expect(result).toBeDefined();
    });

    it('should return null when not found after update', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.update('d-1', { status: 'failed' });

      expect(result).toBeNull();
    });
  });

  // ==================== startDeployment ====================

  describe('startDeployment', () => {
    it('should set status to deploying', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-1', status: 'deploying' }],
      });

      const result = await repo.startDeployment('d-1');

      expect(result!.status).toBe('deploying');
    });
  });

  // ==================== completeDeployment ====================

  describe('completeDeployment', () => {
    it('should complete with success', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-1', status: 'success' }],
      });

      const result = await repo.completeDeployment('d-1', 'success');

      expect(result!.status).toBe('success');
    });

    it('should complete with error message', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-1', status: 'failed', error_message: 'Build failed' }],
      });

      const result = await repo.completeDeployment('d-1', 'failed', 'Build failed');

      expect(result!.error_message).toBe('Build failed');
    });
  });

  // ==================== findLatestByEnvironment ====================

  describe('findLatestByEnvironment', () => {
    it('should find latest deployment', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-1', environment: 'prod' }],
      });

      const result = await repo.findLatestByEnvironment('t-1', 'prod');

      expect(result).toBeDefined();
    });

    it('should return null when none found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findLatestByEnvironment('t-1', 'staging');

      expect(result).toBeNull();
    });
  });

  // ==================== findByBuild ====================

  describe('findByBuild', () => {
    it('should find deployments by build id', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-1', build_id: 'b-1' }],
      });

      const result = await repo.findByBuild('b-1');

      expect(result).toHaveLength(1);
    });
  });

  // ==================== findRollbackTarget ====================

  describe('findRollbackTarget', () => {
    it('should find rollback target', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'd-old', status: 'success' }],
      });

      const result = await repo.findRollbackTarget('t-1', 'prod', 'd-current');

      expect(result).toBeDefined();
    });

    it('should return null when no target found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findRollbackTarget('t-1', 'prod', 'd-current');

      expect(result).toBeNull();
    });
  });

  // ==================== findEvents / createEvent ====================

  describe('events', () => {
    it('should find events by deployment', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'e-1', deployment_id: 'd-1', event_type: 'started' },
          { id: 'e-2', deployment_id: 'd-1', event_type: 'completed' },
        ],
      });

      const result = await repo.findEvents('d-1');

      expect(result).toHaveLength(2);
    });

    it('should create event', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'e-1', deployment_id: 'd-1', event_type: 'deployed' }],
      });

      const result = await repo.createEvent({
        deployment_id: 'd-1',
        event_type: 'deployed',
        message: 'Deployed successfully',
        actor_id: 'user-1',
      });

      expect(result.id).toBe('e-1');
    });
  });

  // ==================== getDeployStats ====================

  describe('getDeployStats', () => {
    it('should return deployment stats', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          total: '100',
          success: '85',
          failed: '10',
          deploying: '5',
          avg_duration: '45000',
        }],
      });

      const result = await repo.getDeployStats('t-1');

      expect(result.total).toBe(100);
      expect(result.success).toBe(85);
      expect(result.failed).toBe(10);
      expect(result.deploying).toBe(5);
      expect(result.avgDuration).toBe(45000);
    });

    it('should handle stats without tenant filter', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ total: '0', success: '0', failed: '0', deploying: '0', avg_duration: null }],
      });

      const result = await repo.getDeployStats();

      expect(result.total).toBe(0);
    });
  });

  // ==================== getEnvironments ====================

  describe('getEnvironments', () => {
    it('should return distinct environments', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ environment: 'dev' }, { environment: 'prod' }, { environment: 'staging' }],
      });

      const result = await repo.getEnvironments('t-1');

      expect(result).toEqual(['dev', 'prod', 'staging']);
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repo.findById('d-1')).rejects.toThrow('Connection refused');
    });
  });
});
