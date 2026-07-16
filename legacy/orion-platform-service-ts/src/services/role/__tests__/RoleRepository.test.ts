/**
 * RoleRepository - Comprehensive Tests
 *
 * Tests for CRUD operations, permission management,
 * role-permission mapping, and user role queries.
 */

import { RoleRepository, Role } from '../RoleRepository';

// ─── Mock DB ────────────────────────────────────────────────────────────────

function createMockDb() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('RoleRepository', () => {
  let repo: RoleRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new RoleRepository(mockDb as any);
  });

  // ─── findById ────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return role when found', async () => {
      const mockRole: Role = { id: 'role-1', tenant_id: 't1', name: 'admin', description: 'Admin role' };
      mockDb.query.mockResolvedValue({ rows: [mockRole] });

      const result = await repo.findById('role-1');
      expect(result).toEqual(mockRole);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM roles WHERE id = $1', ['role-1']);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repo.findById('non-existent');
      expect(result).toBeNull();
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all roles for a tenant', async () => {
      const roles: Role[] = [
        { id: 'r1', tenant_id: 't1', name: 'admin', description: null },
        { id: 'r2', tenant_id: 't1', name: 'viewer', description: null },
      ];
      mockDb.query.mockResolvedValue({ rows: roles });

      const result = await repo.findAll('t1');
      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM roles WHERE tenant_id = $1', ['t1']);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a role with description', async () => {
      const mockRole: Role = { id: 'r-new', tenant_id: 't1', name: 'editor', description: 'Can edit' };
      mockDb.query.mockResolvedValue({ rows: [mockRole] });

      const result = await repo.create('t1', 'editor', 'Can edit');
      expect(result).toEqual(mockRole);

      const params = mockDb.query.mock.calls[0][1];
      expect(params).toEqual(['t1', 'editor', 'Can edit']);
    });

    it('should default description to null', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'r1' }] });

      await repo.create('t1', 'viewer');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[2]).toBeNull();
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should return true when role deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });
      const result = await repo.delete('role-1');
      expect(result).toBe(true);
    });

    it('should return false when role not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });
      const result = await repo.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  // ─── findByName ──────────────────────────────────────────────────────────

  describe('findByName', () => {
    it('should return role by name', async () => {
      const mockRole: Role = { id: 'r1', tenant_id: 't1', name: 'admin', description: null };
      mockDb.query.mockResolvedValue({ rows: [mockRole] });

      const result = await repo.findByName('admin');
      expect(result?.name).toBe('admin');
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM roles WHERE name = $1', ['admin']);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repo.findByName('non-existent');
      expect(result).toBeNull();
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update role name', async () => {
      const updated: Role = { id: 'r1', tenant_id: 't1', name: 'super-admin', description: null };
      mockDb.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.update('r1', { name: 'super-admin' });
      expect(result?.name).toBe('super-admin');

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('UPDATE roles SET');
      expect(sql).toContain('name = $');
    });

    it('should update role description', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'r1', description: 'New desc' }] });

      await repo.update('r1', { description: 'New desc' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('description = $');
    });

    it('should update both name and description', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'r1' }] });

      await repo.update('r1', { name: 'new-name', description: 'new-desc' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('name = $');
      expect(sql).toContain('description = $');
    });

    it('should return existing when no updates provided', async () => {
      const existing: Role = { id: 'r1', tenant_id: 't1', name: 'admin', description: null };
      mockDb.query.mockResolvedValue({ rows: [existing] });

      const result = await repo.update('r1', {});
      expect(result).toEqual(existing);
    });

    it('should return null when update fails', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repo.update('non-existent', { name: 'new' });
      expect(result).toBeNull();
    });
  });

  // ─── findRolePermission ──────────────────────────────────────────────────

  describe('findRolePermission', () => {
    it('should find role-permission mapping', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'rp-1' }] });

      const result = await repo.findRolePermission('role-1', 'pipelines', 'read');
      expect(result).toEqual({ id: 'rp-1' });

      const params = mockDb.query.mock.calls[0][1];
      expect(params).toEqual(['role-1', 'pipelines', 'read']);
    });

    it('should return null when mapping not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repo.findRolePermission('role-1', 'pipelines', 'write');
      expect(result).toBeNull();
    });
  });

  // ─── addRolePermission ───────────────────────────────────────────────────

  describe('addRolePermission', () => {
    it('should add role-permission mapping', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.addRolePermission('role-1', 'pipelines', 'read');

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO role_permissions');
      expect(sql).toContain('ON CONFLICT DO NOTHING');

      const params = mockDb.query.mock.calls[0][1];
      expect(params).toEqual(['role-1', 'pipelines', 'read']);
    });
  });

  // ─── findPermissionsByRoleNames ──────────────────────────────────────────

  describe('findPermissionsByRoleNames', () => {
    it('should return permissions for role names', async () => {
      const perms = [
        { resource: 'pipelines', action: 'read' },
        { resource: 'pipelines', action: 'write' },
      ];
      mockDb.query.mockResolvedValue({ rows: perms });

      const result = await repo.findPermissionsByRoleNames(['admin', 'developer']);
      expect(result).toHaveLength(2);

      const params = mockDb.query.mock.calls[0][1];
      expect(params).toEqual([['admin', 'developer']]);
    });

    it('should return empty for empty role names', async () => {
      const result = await repo.findPermissionsByRoleNames([]);
      expect(result).toEqual([]);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // ─── findUserRoles ───────────────────────────────────────────────────────

  describe('findUserRoles', () => {
    it('should return user roles', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ name: 'admin' }, { name: 'developer' }],
      });

      const result = await repo.findUserRoles('user-1', 'tenant-1');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('admin');

      const params = mockDb.query.mock.calls[0][1];
      expect(params).toEqual(['user-1', 'tenant-1']);
    });

    it('should return empty when user has no roles', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repo.findUserRoles('user-1', 'tenant-1');
      expect(result).toEqual([]);
    });
  });
});
