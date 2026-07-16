/**
 * Tests for DeployWindowService
 */

import { DeployWindowService, DeployWindowServiceError, ListDeployWindowsOptions } from '../DeployWindowService';
import { DeployWindowRepository, DeployWindow } from '../DeployWindowRepository';

// Mock DeployWindowRepository
const mockRepository = {
  findById: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  getActiveWindows: jest.fn(),
};

const mockDb = {
  query: jest.fn(),
};

function makeRepository(): DeployWindowRepository {
  return new DeployWindowRepository(mockDb as any);
}

function makeWindow(overrides: Partial<DeployWindow> = {}): DeployWindow {
  return {
    id: 'win-001',
    tenant_id: 'tenant-001',
    environment_id: 'env-staging',
    name: 'Weekly Maintenance',
    cron_expression: '0 2 * * 0',
    duration_minutes: 120,
    timezone: 'Asia/Shanghai',
    status: 'active',
    created_by: 'admin',
    created_at: new Date('2026-05-01T00:00:00Z'),
    updated_at: new Date('2026-05-01T00:00:00Z'),
    ...overrides,
  };
}

describe('DeployWindowService', () => {
  let service: DeployWindowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeployWindowService(mockRepository as any);
  });

  // ==================== getWindow ====================

  describe('getWindow', () => {
    it('should return window by ID', async () => {
      const window = makeWindow();
      mockRepository.findById.mockResolvedValue(window);

      const result = await service.getWindow('win-001');

      expect(result.id).toBe('win-001');
      expect(result.name).toBe('Weekly Maintenance');
    });

    it('should throw WINDOW_NOT_FOUND for non-existent ID', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getWindow('non-existent')).rejects.toThrow(DeployWindowServiceError);
      await expect(service.getWindow('non-existent')).rejects.toThrow('Deploy window not found: non-existent');
    });
  });

  // ==================== listWindows ====================

  describe('listWindows', () => {
    it('should return paginated windows', async () => {
      const windows = [makeWindow(), makeWindow({ id: 'win-002', name: 'Deploy Friday' })];
      mockRepository.findAll.mockResolvedValue(windows);
      mockRepository.count.mockResolvedValue(2);

      const result = await service.listWindows({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should calculate totalPages correctly', async () => {
      const windows = [makeWindow()];
      mockRepository.findAll.mockResolvedValue(windows);
      mockRepository.count.mockResolvedValue(25);

      const result = await service.listWindows({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by tenantId', async () => {
      mockRepository.findAll.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await service.listWindows({ tenantId: 'tenant-001' });

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-001' })
      );
    });

    it('should filter by status', async () => {
      mockRepository.findAll.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await service.listWindows({ status: 'active' });

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
    });

    it('should use default pagination', async () => {
      mockRepository.findAll.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      await service.listWindows({});

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 })
      );
    });
  });

  // ==================== createWindow ====================

  describe('createWindow', () => {
    it('should create a window with valid input', async () => {
      const window = makeWindow();
      mockRepository.create.mockResolvedValue(window);

      const result = await service.createWindow({
        tenant_id: 'tenant-001',
        environment_id: 'env-staging',
        name: 'Weekly Maintenance',
        cron_expression: '0 2 * * 0',
        created_by: 'admin',
      });

      expect(result.name).toBe('Weekly Maintenance');
      expect(result.cron_expression).toBe('0 2 * * 0');
    });

    it('should throw error when name is missing', async () => {
      await expect(service.createWindow({
        tenant_id: 'tenant-001',
        environment_id: 'env-staging',
        name: '',
        cron_expression: '0 2 * * 0',
        created_by: 'admin',
      })).rejects.toThrow('name is required');
    });

    it('should throw error when cron_expression is missing', async () => {
      await expect(service.createWindow({
        tenant_id: 'tenant-001',
        environment_id: 'env-staging',
        name: 'Test',
        cron_expression: '',
        created_by: 'admin',
      })).rejects.toThrow('cron_expression is required');
    });

    it('should throw error when created_by is missing', async () => {
      await expect(service.createWindow({
        tenant_id: 'tenant-001',
        environment_id: 'env-staging',
        name: 'Test',
        cron_expression: '0 2 * * 0',
        created_by: '',
      })).rejects.toThrow('created_by is required');
    });
  });

  // ==================== updateWindow ====================

  describe('updateWindow', () => {
    it('should update a window', async () => {
      mockRepository.findById.mockResolvedValue(makeWindow());
      const updated = makeWindow({ name: 'Updated Window' });
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateWindow('win-001', { name: 'Updated Window' });

      expect(result.name).toBe('Updated Window');
    });

    it('should throw error for non-existent window', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updateWindow('non-existent', { name: 'New' }))
        .rejects.toThrow('Deploy window not found: non-existent');
    });

    it('should throw error when update fails', async () => {
      mockRepository.findById.mockResolvedValue(makeWindow());
      mockRepository.update.mockResolvedValue(null);

      await expect(service.updateWindow('win-001', { name: 'New' }))
        .rejects.toThrow('Failed to update deploy window');
    });
  });

  // ==================== deleteWindow ====================

  describe('deleteWindow', () => {
    it('should soft delete a window', async () => {
      mockRepository.findById.mockResolvedValue(makeWindow());
      const deleted = makeWindow({ status: 'deleted' });
      mockRepository.softDelete.mockResolvedValue(deleted);

      const result = await service.deleteWindow('win-001');

      expect(result.status).toBe('deleted');
    });

    it('should throw error for non-existent window', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.deleteWindow('non-existent'))
        .rejects.toThrow('Deploy window not found: non-existent');
    });
  });

  // ==================== checkWindowActive ====================

  describe('checkWindowActive', () => {
    it('should return isActive=true when no windows configured', async () => {
      mockRepository.getActiveWindows.mockResolvedValue([]);

      const result = await service.checkWindowActive('tenant-001', 'env-staging');

      expect(result.isActive).toBe(true);
      expect(result.matchedWindows).toHaveLength(0);
      expect(result.message).toContain('No deploy windows configured');
    });

    it('should return isActive=true when date matches cron schedule', async () => {
      // Sunday May 3, 2026 at 02:00 UTC matches "0 2 * * 0"
      const matchDate = new Date('2026-05-03T02:00:00Z');
      mockRepository.getActiveWindows.mockResolvedValue([makeWindow()]);

      const result = await service.checkWindowActive('tenant-001', 'env-staging', matchDate);

      expect(result.isActive).toBe(true);
      expect(result.matchedWindows).toHaveLength(1);
      expect(result.message).toContain('Currently within');
    });

    it('should return isActive=false when date is outside window', async () => {
      // Monday at noon - does not match "0 2 * * 0"
      const nonMatchDate = new Date('2026-05-04T12:00:00Z');
      mockRepository.getActiveWindows.mockResolvedValue([makeWindow()]);
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.checkWindowActive('tenant-001', 'env-staging', nonMatchDate);

      expect(result.isActive).toBe(false);
      expect(result.matchedWindows).toHaveLength(0);
    });

    it('should return multiple matched windows', async () => {
      const windows = [
        makeWindow({ id: 'win-001', name: 'Window A', cron_expression: '0 * * * *' }),
        makeWindow({ id: 'win-002', name: 'Window B', cron_expression: '0 * * * *' }),
      ];
      mockRepository.getActiveWindows.mockResolvedValue(windows);

      const date = new Date('2026-05-04T00:00:00Z');
      const result = await service.checkWindowActive('tenant-001', 'env-staging', date);

      expect(result.isActive).toBe(true);
      expect(result.matchedWindows).toHaveLength(2);
    });

    it('should handle invalid cron expressions gracefully', async () => {
      mockRepository.getActiveWindows.mockResolvedValue([
        makeWindow({ cron_expression: 'invalid cron' }),
      ]);

      const result = await service.checkWindowActive('tenant-001', 'env-staging', new Date());

      expect(result.isActive).toBe(false);
    });
  });

  // ==================== matchCronField (indirect) ====================

  describe('cron field matching', () => {
    it('should match wildcard cron fields', async () => {
      mockRepository.getActiveWindows.mockResolvedValue([
        makeWindow({ cron_expression: '0 * * * *' }),
      ]);

      const date = new Date('2026-05-04T05:00:00Z');
      const result = await service.checkWindowActive('tenant-001', 'env-staging', date);

      expect(result.isActive).toBe(true);
    });

    it('should match comma-separated values', async () => {
      mockRepository.getActiveWindows.mockResolvedValue([
        makeWindow({ cron_expression: '0 1,3,5 * * *' }),
      ]);

      const date = new Date('2026-05-04T03:00:00Z');
      const result = await service.checkWindowActive('tenant-001', 'env-staging', date);

      expect(result.isActive).toBe(true);
    });

    it('should match range values', async () => {
      mockRepository.getActiveWindows.mockResolvedValue([
        makeWindow({ cron_expression: '0 9-17 * * 1-5' }),
      ]);

      // Wednesday at 14:00 UTC
      const date = new Date('2026-05-06T14:00:00Z');
      const result = await service.checkWindowActive('tenant-001', 'env-staging', date);

      expect(result.isActive).toBe(true);
    });

    it('should not match outside range', async () => {
      mockRepository.getActiveWindows.mockResolvedValue([
        makeWindow({ cron_expression: '0 9-17 * * 1-5' }),
      ]);

      // Saturday at 14:00 UTC - not a weekday
      const date = new Date('2026-05-09T14:00:00Z');
      const result = await service.checkWindowActive('tenant-001', 'env-staging', date);

      expect(result.isActive).toBe(false);
    });

    it('should match step values', async () => {
      mockRepository.getActiveWindows.mockResolvedValue([
        makeWindow({ cron_expression: '0 */4 * * *' }),
      ]);

      const date = new Date('2026-05-04T08:00:00Z');
      const result = await service.checkWindowActive('tenant-001', 'env-staging', date);

      expect(result.isActive).toBe(true);
    });
  });

  // ==================== getNextWindows ====================

  describe('getNextWindows', () => {
    it('should return active windows', async () => {
      const windows = [makeWindow(), makeWindow({ id: 'win-002' })];
      mockRepository.findAll.mockResolvedValue(windows);

      const result = await service.getNextWindows('tenant-001', 'env-staging', 10);

      expect(result).toHaveLength(2);
      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active', limit: 10 })
      );
    });

    it('should use default limit of 10', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      await service.getNextWindows('tenant-001', 'env-staging');

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });
  });
});
