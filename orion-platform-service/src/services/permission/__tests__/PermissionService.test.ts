/**
 * PermissionService 单元测试
 *
 * 测试权限管理：CRUD、批量创建、种子数据、错误处理。
 */

import { PermissionService, PermissionServiceError } from '../PermissionService';

describe('PermissionService', () => {
  let service: PermissionService;
  let mockRepo: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      createBatch: jest.fn(),
      delete: jest.fn(),
    };
    service = new PermissionService(mockRepo);
  });

  describe('listPermissions', () => {
    it('should return all permissions', async () => {
      const perms = [
        { id: 'p1', resource: 'pipeline', action: 'read' },
        { id: 'p2', resource: 'pipeline', action: 'write' },
      ];
      mockRepo.findAll.mockResolvedValue({ entities: perms, total: 2 });

      const result = await service.listPermissions();
      expect(result).toHaveLength(2);
      expect(mockRepo.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no permissions', async () => {
      mockRepo.findAll.mockResolvedValue({ entities: [], total: 0 });
      const result = await service.listPermissions();
      expect(result).toHaveLength(0);
    });
  });

  describe('getPermission', () => {
    it('should return permission by id', async () => {
      const perm = { id: 'p1', resource: 'pipeline', action: 'read' };
      mockRepo.findById.mockResolvedValue(perm);

      const result = await service.getPermission('p1');
      expect(result).toEqual(perm);
    });

    it('should throw NOT_FOUND when permission does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getPermission('missing'))
        .rejects.toThrow(PermissionServiceError);
      await expect(service.getPermission('missing'))
        .rejects.toThrow('Permission not found: missing');
    });
  });

  describe('createPermission', () => {
    it('should create permission with valid inputs', async () => {
      const perm = { id: 'p1', resource: 'pipeline', action: 'read' };
      mockRepo.create.mockResolvedValue(perm);

      const result = await service.createPermission('pipeline', 'read', 'View pipelines');
      expect(result).toEqual(perm);
      expect(mockRepo.create).toHaveBeenCalledWith({ resource: 'pipeline', action: 'read', description: 'View pipelines' });
    });

    it('should create permission without description', async () => {
      mockRepo.create.mockResolvedValue({ id: 'p1' });
      await service.createPermission('pipeline', 'read');
      expect(mockRepo.create).toHaveBeenCalledWith({ resource: 'pipeline', action: 'read', description: null });
    });

    it('should throw INVALID_INPUT when resource is empty', async () => {
      await expect(service.createPermission('', 'read'))
        .rejects.toThrow(PermissionServiceError);
    });

    it('should throw INVALID_INPUT when action is empty', async () => {
      await expect(service.createPermission('pipeline', ''))
        .rejects.toThrow(PermissionServiceError);
    });

    it('should throw INVALID_ACTION for unknown action', async () => {
      await expect(service.createPermission('pipeline', 'unknown'))
        .rejects.toThrow(PermissionServiceError);
      await expect(service.createPermission('pipeline', 'unknown'))
        .rejects.toThrow('Invalid action');
    });

    it('should accept all valid actions', async () => {
      const validActions = ['read', 'write', 'execute', 'delete', 'manage', 'acknowledge', 'approve', 'use'];
      mockRepo.create.mockResolvedValue({ id: 'p1' });

      for (const action of validActions) {
        await expect(service.createPermission('resource', action)).resolves.toBeDefined();
      }
    });

    it('should throw DUPLICATE_PERMISSION on unique violation', async () => {
      const err = Object.assign(new Error('duplicate'), { code: '23505' });
      mockRepo.create.mockRejectedValue(err);

      await expect(service.createPermission('pipeline', 'read'))
        .rejects.toThrow('Permission already exists: pipeline:read');
    });

    it('should throw CREATE_ERROR on other errors', async () => {
      mockRepo.create.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.createPermission('pipeline', 'read'))
        .rejects.toThrow('Failed to create permission: DB connection failed');
    });
  });

  describe('batchCreatePermissions', () => {
    it('should batch create permissions', async () => {
      const perms = [
        { id: 'p1', resource: 'pipeline', action: 'read' },
        { id: 'p2', resource: 'pipeline', action: 'write' },
      ];
      mockRepo.createBatch.mockResolvedValue(perms);

      const result = await service.batchCreatePermissions([
        { resource: 'pipeline', action: 'read' },
        { resource: 'pipeline', action: 'write' },
      ]);

      expect(result).toHaveLength(2);
      expect(mockRepo.createBatch).toHaveBeenCalled();
    });
  });

  describe('deletePermission', () => {
    it('should return true when deleted', async () => {
      mockRepo.delete.mockResolvedValue(true);
      expect(await service.deletePermission('p1')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockRepo.delete.mockResolvedValue(false);
      expect(await service.deletePermission('missing')).toBe(false);
    });
  });

  describe('seedCommonPermissions', () => {
    it('should create missing permissions', async () => {
      mockRepo.findAll.mockResolvedValue({ entities: [], total: 0 });
      mockRepo.createBatch.mockResolvedValue(new Array(37).fill(null).map((_, i) => ({ id: `p${i}` })));

      const result = await service.seedCommonPermissions();
      expect(result.created).toBe(37);
      expect(result.skipped).toBe(0);
    });

    it('should skip existing permissions', async () => {
      // All 37 permissions already exist
      const existing = [
        { id: 'p1', resource: 'pipeline', action: 'read' },
        { id: 'p2', resource: 'pipeline', action: 'write' },
        { id: 'p3', resource: 'pipeline', action: 'execute' },
        { id: 'p4', resource: 'pipeline', action: 'delete' },
        { id: 'p5', resource: 'deployment', action: 'read' },
        { id: 'p6', resource: 'deployment', action: 'write' },
        { id: 'p7', resource: 'deployment', action: 'execute' },
        { id: 'p8', resource: 'deployment', action: 'delete' },
        { id: 'p9', resource: 'monitoring', action: 'read' },
        { id: 'p10', resource: 'monitoring', action: 'write' },
        { id: 'p11', resource: 'alert', action: 'read' },
        { id: 'p12', resource: 'alert', action: 'write' },
        { id: 'p13', resource: 'alert', action: 'acknowledge' },
        { id: 'p14', resource: 'config', action: 'read' },
        { id: 'p15', resource: 'config', action: 'write' },
        { id: 'p16', resource: 'tenant', action: 'read' },
        { id: 'p17', resource: 'tenant', action: 'write' },
        { id: 'p18', resource: 'user', action: 'read' },
        { id: 'p19', resource: 'user', action: 'write' },
        { id: 'p20', resource: 'user', action: 'delete' },
        { id: 'p21', resource: 'role', action: 'read' },
        { id: 'p22', resource: 'role', action: 'write' },
        { id: 'p23', resource: 'role', action: 'delete' },
        { id: 'p24', resource: 'finops', action: 'read' },
        { id: 'p25', resource: 'finops', action: 'write' },
        { id: 'p26', resource: 'artifact', action: 'read' },
        { id: 'p27', resource: 'artifact', action: 'write' },
        { id: 'p28', resource: 'artifact', action: 'delete' },
        { id: 'p29', resource: 'cmdb', action: 'read' },
        { id: 'p30', resource: 'cmdb', action: 'write' },
        { id: 'p31', resource: 'audit', action: 'read' },
        { id: 'p32', resource: 'ai', action: 'use' },
        { id: 'p33', resource: 'ai', action: 'manage' },
        { id: 'p34', resource: 'api_key', action: 'read' },
        { id: 'p35', resource: 'api_key', action: 'write' },
        { id: 'p36', resource: 'api_key', action: 'delete' },
      ];
      mockRepo.findAll.mockResolvedValue({ entities: existing, total: existing.length });

      const result = await service.seedCommonPermissions();
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(36);
      expect(mockRepo.createBatch).not.toHaveBeenCalled();
    });

    it('should create only missing permissions when some exist', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'p1', resource: 'pipeline', action: 'read' },
          { id: 'p2', resource: 'pipeline', action: 'write' },
        ],
        total: 2,
      });
      mockRepo.createBatch.mockResolvedValue(new Array(35).fill(null).map((_, i) => ({ id: `new${i}` })));

      const result = await service.seedCommonPermissions();
      expect(result.created).toBe(35);
      expect(result.skipped).toBe(2);
    });
  });
});
