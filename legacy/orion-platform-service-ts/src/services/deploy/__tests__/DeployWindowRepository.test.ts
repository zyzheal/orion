/**
 * DeployWindowRepository - Deploy Window Database Layer Unit Tests
 *
 * Coverage: findById, findAll, count, create, update, softDelete, getActiveWindows
 */

import { DeployWindowRepository } from '../DeployWindowRepository';

describe('DeployWindowRepository', () => {
  let repo: DeployWindowRepository;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new DeployWindowRepository(mockPool as any);
  });

  describe('findById', () => {
    it('should return deploy window by id', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-1', tenant_id: 't-1', name: 'Maintenance Window' }],
      });

      const result = await repo.findById('w-1');
      expect(result!.id).toBe('w-1');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.findById('non-existent')).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all deploy windows', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'w-1' }, { id: 'w-2' }] });
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

    it('should filter by environmentId and status', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      await repo.findAll({ environmentId: 'env-1', status: 'active' });
      const [query] = mockPool.query.mock.calls[0];
      expect(query).toContain('environment_id');
      expect(query).toContain('status');
    });

    it('should apply limit and offset', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      await repo.findAll({ limit: 10, offset: 5 });
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(10);
      expect(params).toContain(5);
    });
  });

  describe('count', () => {
    it('should count all deploy windows', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '3' }] });
      expect(await repo.count()).toBe(3);
    });

    it('should count with filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: '1' }] });
      expect(await repo.count({ tenantId: 't-1', status: 'active' })).toBe(1);
    });
  });

  describe('create', () => {
    it('should create deploy window', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-1', name: 'Maintenance', status: 'active' }],
      });

      const result = await repo.create({
        tenant_id: 't-1',
        environment_id: 'env-1',
        name: 'Maintenance',
        cron_expression: '0 2 * * SUN',
        created_by: 'admin',
      });

      expect(result.name).toBe('Maintenance');
    });

    it('should use defaults for optional fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{}] });

      await repo.create({
        tenant_id: 't-1',
        environment_id: 'env-1',
        name: 'Window',
        cron_expression: '0 * * * *',
        created_by: 'admin',
      });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(60); // default duration
      expect(params).toContain('Asia/Shanghai'); // default timezone
    });
  });

  describe('update', () => {
    it('should update deploy window fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-1', name: 'Updated' }],
      });

      const result = await repo.update('w-1', { name: 'Updated', status: 'paused' });
      expect(result!.name).toBe('Updated');
    });

    it('should return existing when no updates', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'w-1' }] });
      const result = await repo.update('w-1', {});
      expect(result).toBeDefined();
    });

    it('should return null when not found after update', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      expect(await repo.update('w-1', { name: 'New' })).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('should soft delete deploy window', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-1', status: 'deleted' }],
      });

      const result = await repo.softDelete('w-1');
      expect(result!.status).toBe('deleted');
    });
  });

  describe('getActiveWindows', () => {
    it('should get active windows for tenant and environment', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w-1', status: 'active' }],
      });

      const result = await repo.getActiveWindows('t-1', 'env-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('error propagation', () => {
    it('should propagate database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Connection refused'));
      await expect(repo.findById('w-1')).rejects.toThrow('Connection refused');
    });
  });
});
