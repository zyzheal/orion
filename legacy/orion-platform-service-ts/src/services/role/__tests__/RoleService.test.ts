/**
 * RoleService Tests - Test RBAC permission checks, role assignment
 */

import { RoleService, RoleServiceError } from '../RoleService';
import { RoleRepository, Role } from '../RoleRepository';

describe('RoleService', () => {
  let mockRepository: jest.Mocked<RoleRepository>;
  let service: RoleService;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      findByName: jest.fn(),
      findRolePermission: jest.fn(),
      addRolePermission: jest.fn(),
      findPermissionsByRoleNames: jest.fn(),
      findUserRoles: jest.fn(),
    } as unknown as jest.Mocked<RoleRepository>;

    service = new RoleService(mockRepository);

    // Default: DB fallback returns empty (most tests use in-memory ROLE_PERMISSIONS)
    mockRepository.findPermissionsByRoleNames.mockResolvedValue([]);
    mockRepository.findUserRoles.mockResolvedValue([]);
  });

  describe('createRole', () => {
    it('should create a new role with permissions', async () => {
      const mockRole: Role = {
        id: 'role-1',
        tenant_id: 'tenant-1',
        name: 'admin',
        description: null,
        permissions: ['read', 'write', 'delete'],
      };
      mockRepository.create.mockResolvedValue(mockRole);

      const result = await service.createRole('tenant-1', 'admin', ['read', 'write', 'delete']);

      expect(result).toEqual(mockRole);
      expect(mockRepository.create).toHaveBeenCalledWith('tenant-1', 'admin');
    });

    it('should throw when tenantId is missing', async () => {
      await expect(service.createRole('', 'admin', ['read']))
        .rejects
        .toThrow(RoleServiceError);

      await expect(service.createRole('', 'admin', ['read']))
        .rejects
        .toThrow('Tenant ID and name required');
    });

    it('should throw when role name is missing', async () => {
      await expect(service.createRole('tenant-1', '', ['read']))
        .rejects
        .toThrow('Tenant ID and name required');
    });
  });

  describe('listRoles', () => {
    it('should return all roles for a tenant', async () => {
      const mockRoles: Role[] = [
        { id: 'role-1', tenant_id: 'tenant-1', name: 'admin', description: null, permissions: ['read', 'write'] },
        { id: 'role-2', tenant_id: 'tenant-1', name: 'viewer', description: null, permissions: ['read'] },
      ];
      mockRepository.findAll.mockResolvedValue(mockRoles);

      const result = await service.listRoles('tenant-1');

      expect(result).toEqual(mockRoles);
      expect(mockRepository.findAll).toHaveBeenCalledWith('tenant-1');
    });

    it('should return empty array when no roles exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.listRoles('tenant-1');

      expect(result).toEqual([]);
    });
  });

  describe('getRole', () => {
    it('should return role by id', async () => {
      const mockRole: Role = {
        id: 'role-1',
        tenant_id: 'tenant-1',
        name: 'editor',
        description: 'Can edit resources',
        permissions: ['read', 'write'],
      };
      mockRepository.findById.mockResolvedValue(mockRole);

      const result = await service.getRole('role-1');

      expect(result).toEqual(mockRole);
      expect(mockRepository.findById).toHaveBeenCalledWith('role-1');
    });

    it('should throw when role not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getRole('non-existent'))
        .rejects
        .toThrow(RoleServiceError);

      await expect(service.getRole('non-existent'))
        .rejects
        .toThrow('Role not found: non-existent');
    });
  });

  describe('deleteRole', () => {
    it('should delete an existing role', async () => {
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.deleteRole('role-1');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('role-1');
    });

    it('should return false when role does not exist', async () => {
      mockRepository.delete.mockResolvedValue(false);

      const result = await service.deleteRole('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('updateRole', () => {
    it('should update role name', async () => {
      const existing: Role = {
        id: 'role-1',
        tenant_id: 'tenant-1',
        name: 'old-name',
        description: null,
        permissions: ['read'],
      };
      const updated: Role = {
        ...existing,
        name: 'new-name',
      };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateRole('role-1', { name: 'new-name' });

      expect(result.name).toBe('new-name');
      expect(mockRepository.update).toHaveBeenCalledWith('role-1', { name: 'new-name' });
    });

    it('should update role permissions', async () => {
      const existing: Role = {
        id: 'role-1',
        tenant_id: 'tenant-1',
        name: 'admin',
        description: null,
        permissions: ['read'],
      };
      const updated: Role = {
        ...existing,
        permissions: ['read', 'write', 'delete', 'admin'],
      };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateRole('role-1', { permissions: ['read', 'write', 'delete', 'admin'] });

      expect(result.permissions).toEqual(['read', 'write', 'delete', 'admin']);
    });

    it('should update role description', async () => {
      const existing: Role = {
        id: 'role-1',
        tenant_id: 'tenant-1',
        name: 'viewer',
        description: null,
        permissions: ['read'],
      };
      const updated: Role = {
        ...existing,
        description: 'Read-only access',
      };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateRole('role-1', { description: 'Read-only access' });

      expect(result.description).toBe('Read-only access');
    });

    it('should throw when role not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updateRole('non-existent', { name: 'new' }))
        .rejects
        .toThrow('Role not found: non-existent');
    });

    it('should throw when update fails', async () => {
      const existing: Role = {
        id: 'role-1',
        tenant_id: 'tenant-1',
        name: 'admin',
        description: null,
        permissions: ['read'],
      };
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(null);

      await expect(service.updateRole('role-1', { name: 'new' }))
        .rejects
        .toThrow('Failed to update role: role-1');
    });
  });

  describe('checkPermissions', () => {
    it('should allow when role grants the permission', async () => {
      const devRole: Role = {
        id: 'role-dev',
        tenant_id: 't1',
        name: 'developer',
        description: null,
        permissions: ['pipeline:read', 'pipeline:create', 'deployment:read'],
      };
      mockRepository.findByName.mockResolvedValue(devRole);

      const result = await service.checkPermissions(['developer'], 'pipeline', 'read');

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('developer');
    });

    it('should allow with wildcard resource permission', async () => {
      // Use 'sre' which is in BUSINESS_ROLE_PERMISSIONS with '*:read'
      const result = await service.checkPermissions(['sre'], 'cmdb', 'read');

      expect(result.allowed).toBe(true);
    });

    it('should allow with wildcard action permission', async () => {
      // Use 'project_admin' which is in PROJECT_ROLE_PERMISSIONS with 'pipeline:*'
      const result = await service.checkPermissions(['project_admin'], 'pipeline', 'delete');

      expect(result.allowed).toBe(true);
    });

    it('should deny when no role grants the permission', async () => {
      // 'viewer' is in BUSINESS_ROLE_PERMISSIONS but doesn't have pipeline:delete
      const result = await service.checkPermissions(['viewer'], 'pipeline', 'delete');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No role grants');
    });

    it('should deny when no roles provided', async () => {
      const result = await service.checkPermissions([], 'pipeline', 'read');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No roles assigned');
    });

    it('should deny when role not found in repository', async () => {
      mockRepository.findByName.mockResolvedValue(null);
      mockRepository.findPermissionsByRoleNames.mockResolvedValue([]);

      const result = await service.checkPermissions(['unknown-role'], 'pipeline', 'read');

      expect(result.allowed).toBe(false);
    });

    it('should check multiple roles and allow if any matches', async () => {
      mockRepository.findByName
        .mockResolvedValueOnce(null) // viewer doesn't have delete
        .mockResolvedValueOnce({
          id: 'role-admin',
          tenant_id: 't1',
          name: 'admin',
          description: null,
          permissions: ['*:delete'],
        });
      mockRepository.findPermissionsByRoleNames.mockResolvedValue([
        { resource: '*', action: 'delete' },
      ]);

      const result = await service.checkPermissions(['viewer', 'admin'], 'pipeline', 'delete');

      expect(result.allowed).toBe(true);
    });
  });
});

describe('RoleRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: RoleRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new RoleRepository(mockDb as any);
  });

  describe('findById', () => {
    it('should return role when found', async () => {
      const mockRow = { id: 'role-1', tenant_id: 't1', name: 'admin', permissions: ['read', 'write'] };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findById('role-1');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM roles WHERE id = $1', ['role-1']);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all roles for a tenant', async () => {
      const mockRows = [
        { id: 'r1', tenant_id: 't1', name: 'admin', permissions: ['read', 'write'] },
        { id: 'r2', tenant_id: 't1', name: 'viewer', permissions: ['read'] },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.findAll('t1');

      expect(result).toEqual(mockRows);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM roles WHERE tenant_id = $1', ['t1']);
    });
  });

  describe('create', () => {
    it('should insert a new role and return it', async () => {
      const mockRow = { id: 'role-new', tenant_id: 't1', name: 'editor', permissions: ['read', 'write'] };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.create('t1', 'editor', ['read', 'write']);

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO roles');
      expect(sql).toContain('RETURNING *');
    });
  });

  describe('delete', () => {
    it('should return true when role deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('role-1');

      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('missing');

      expect(result).toBe(false);
    });
  });

  describe('findByName', () => {
    it('should return role when found by name', async () => {
      const mockRow = { id: 'role-1', tenant_id: 't1', name: 'admin', permissions: ['read', 'write'] };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findByName('admin');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM roles WHERE name = $1', ['admin']);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByName('missing');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update role name', async () => {
      const mockRow = { id: 'role-1', name: 'updated', description: 'desc' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.update('role-1', { name: 'updated' });

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('UPDATE roles SET');
      expect(sql).toContain('name = $');
    });

    it('should return existing when no updates provided', async () => {
      const mockRow = { id: 'role-1', name: 'unchanged', permissions: ['read'] };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const findSpy = jest.spyOn(repository, 'findById');
      findSpy.mockResolvedValue(mockRow);

      const result = await repository.update('role-1', {});

      expect(result).toEqual(mockRow);
      expect(findSpy).toHaveBeenCalledWith('role-1');
    });

    it('should return null when update fails', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.update('missing', { name: 'new' });

      expect(result).toBeNull();
    });
  });
});
