/**
 * MaintenanceWindowService unit tests
 *
 * Tests validation and business logic with a mocked repository.
 */

import { MaintenanceWindowService } from '../MaintenanceWindowService';
import { MaintenanceWindowRepository, MaintenanceWindowEntity } from '../../repositories/MaintenanceWindowRepository';

// Helper: create a mock repository with stubbed methods
function createMockRepository() {
  const entities: MaintenanceWindowEntity[] = [];

  const mock: jest.Mocked<MaintenanceWindowRepository> = {
    findByTenantId: jest.fn(async (tenantId: string) =>
      entities.filter(e => e.tenantId === tenantId),
    ),
    findActive: jest.fn(async (now?: Date) => {
      const currentTime = now ?? new Date();
      return entities.filter(
        e => e.startTime <= currentTime && e.endTime >= currentTime,
      );
    }),
    findUpcoming: jest.fn(async (startTime: Date, limit?: number) => {
      const upcoming = entities
        .filter(e => e.startTime >= startTime)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        .slice(0, limit ?? 10);
      return upcoming;
    }),
    deleteExpired: jest.fn(async () => 0),
    findById: jest.fn(async (id: string) => entities.find(e => e.id === id)),
    findAll: jest.fn(async () => ({ entities, total: entities.length })),
    create: jest.fn(async (data: any) => {
      const now = new Date();
      const entity: MaintenanceWindowEntity = {
        ...data,
        createdAt: now,
        updatedAt: now,
      } as MaintenanceWindowEntity;
      entities.push(entity);
      return entity;
    }),
    update: jest.fn(async () => {
      throw new Error('Not implemented');
    }),
    delete: jest.fn(async (id: string) => {
      const idx = entities.findIndex(e => e.id === id);
      if (idx === -1) return false;
      entities.splice(idx, 1);
      return true;
    }),
    // We don't need to mock db/tableName as they are protected
  } as unknown as jest.Mocked<MaintenanceWindowRepository>;

  return { mock, entities };
}

describe('MaintenanceWindowService', () => {
  let service: MaintenanceWindowService;
  let mock: jest.Mocked<MaintenanceWindowRepository>;

  beforeEach(() => {
    const { mock: m } = createMockRepository();
    mock = m;
    service = new MaintenanceWindowService(mock);
  });

  describe('createWindow', () => {
    it('should create a window with valid inputs', async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + 3600000);
      const endTime = new Date(now.getTime() + 7200000);

      const result = await service.createWindow({
        name: 'DB Maintenance',
        startTime,
        endTime,
      });

      expect(result.name).toBe('DB Maintenance');
      expect(result.startTime).toEqual(startTime);
      expect(result.endTime).toEqual(endTime);
      expect(result.timezone).toBe('UTC');
      expect(result.affectedServices).toEqual([]);
    });

    it('should throw if name is empty', async () => {
      await expect(
        service.createWindow({
          name: '',
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
        }),
      ).rejects.toThrow('Window name is required');
    });

    it('should throw if startTime is missing', async () => {
      await expect(
        service.createWindow({
          name: 'Test',
          startTime: undefined as any,
          endTime: new Date(Date.now() + 3600000),
        }),
      ).rejects.toThrow('Start time is required');
    });

    it('should throw if endTime is missing', async () => {
      await expect(
        service.createWindow({
          name: 'Test',
          startTime: new Date(),
          endTime: undefined as any,
        }),
      ).rejects.toThrow('End time is required');
    });

    it('should throw if endTime is before startTime', async () => {
      const now = new Date();
      await expect(
        service.createWindow({
          name: 'Test',
          startTime: new Date(now.getTime() + 7200000),
          endTime: now,
        }),
      ).rejects.toThrow('End time must be after start time');
    });

    it('should use custom timezone and description when provided', async () => {
      const now = new Date();
      const result = await service.createWindow({
        name: 'Deploy Window',
        startTime: new Date(now.getTime() + 3600000),
        endTime: new Date(now.getTime() + 7200000),
        timezone: 'Asia/Shanghai',
        description: 'Weekly deployment window',
        affectedServices: ['api-gateway', 'user-service'],
      });

      expect(result.timezone).toBe('Asia/Shanghai');
      expect(result.description).toBe('Weekly deployment window');
      expect(result.affectedServices).toEqual(['api-gateway', 'user-service']);
    });
  });

  describe('getWindowsByTenant', () => {
    it('should throw if tenantId is empty', async () => {
      await expect(service.getWindowsByTenant('')).rejects.toThrow('Tenant ID is required');
    });

    it('should return windows for a tenant', async () => {
      mock.findByTenantId.mockResolvedValue([
        {
          id: '1',
          tenantId: 'tenant-1',
          name: 'Window 1',
          startTime: new Date(),
          endTime: new Date(),
          timezone: 'UTC',
          description: null,
          affectedServices: [],
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getWindowsByTenant('tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Window 1');
    });
  });

  describe('getActiveWindows', () => {
    it('should return windows where now is between startTime and endTime', async () => {
      const now = new Date();
      mock.findActive.mockResolvedValue([
        {
          id: '1',
          tenantId: 'tenant-1',
          name: 'Active Window',
          startTime: new Date(now.getTime() - 3600000),
          endTime: new Date(now.getTime() + 3600000),
          timezone: 'UTC',
          description: null,
          affectedServices: ['service-a'],
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getActiveWindows();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Active Window');
    });

    it('should return empty array when no active windows', async () => {
      mock.findActive.mockResolvedValue([]);
      const result = await service.getActiveWindows();
      expect(result).toEqual([]);
    });
  });

  describe('getUpcomingWindows', () => {
    it('should return windows with startTime in the future', async () => {
      const now = new Date();
      mock.findUpcoming.mockResolvedValue([
        {
          id: '1',
          tenantId: 'tenant-1',
          name: 'Future Window',
          startTime: new Date(now.getTime() + 3600000),
          endTime: new Date(now.getTime() + 7200000),
          timezone: 'UTC',
          description: null,
          affectedServices: [],
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getUpcomingWindows(5);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Future Window');
    });
  });

  describe('deleteWindow', () => {
    it('should throw if id is empty', async () => {
      await expect(service.deleteWindow('')).rejects.toThrow('Window ID is required');
    });

    it('should return true when window is deleted', async () => {
      mock.delete.mockResolvedValue(true);
      const result = await service.deleteWindow('window-1');
      expect(result).toBe(true);
    });

    it('should return false when window does not exist', async () => {
      mock.delete.mockResolvedValue(false);
      const result = await service.deleteWindow('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('isServiceInMaintenanceWindow', () => {
    it('should throw if serviceName is empty', async () => {
      await expect(service.isServiceInMaintenanceWindow('')).rejects.toThrow('Service name is required');
    });

    it('should return true when service is in an active window', async () => {
      const now = new Date();
      mock.findActive.mockResolvedValue([
        {
          id: '1',
          tenantId: 'tenant-1',
          name: 'Active Window',
          startTime: new Date(now.getTime() - 3600000),
          endTime: new Date(now.getTime() + 3600000),
          timezone: 'UTC',
          description: null,
          affectedServices: ['api-gateway', 'user-service'],
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.isServiceInMaintenanceWindow('api-gateway');
      expect(result).toBe(true);
    });

    it('should return false when service is not in any active window', async () => {
      const now = new Date();
      mock.findActive.mockResolvedValue([
        {
          id: '1',
          tenantId: 'tenant-1',
          name: 'Active Window',
          startTime: new Date(now.getTime() - 3600000),
          endTime: new Date(now.getTime() + 3600000),
          timezone: 'UTC',
          description: null,
          affectedServices: ['other-service'],
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.isServiceInMaintenanceWindow('api-gateway');
      expect(result).toBe(false);
    });

    it('should return false when no active windows exist', async () => {
      mock.findActive.mockResolvedValue([]);
      const result = await service.isServiceInMaintenanceWindow('api-gateway');
      expect(result).toBe(false);
    });
  });
});
