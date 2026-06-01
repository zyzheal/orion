/**
 * PermissionService 单元测试
 *
 * 测试双层权限校验：命令级权限、资源级权限、串联校验、角色管理 CRUD。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

// Mock uuid
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `uuid-${++uuidCounter}`),
}));

import { PermissionService } from '../PermissionService';

describe('PermissionService', () => {
  let service: PermissionService;
  let mockPool: any;

  beforeEach(() => {
    uuidCounter = 0;
    mockPool = {
      query: jest.fn(),
    };
    service = new PermissionService(mockPool);
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== getRolePermissions ====================

  describe('getRolePermissions', () => {
    it('should query permissions from database', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { resource: 'chatops', action: 'deploy' },
          { resource: 'chatops', action: 'read' },
        ],
      });

      const perms = await service.getRolePermissions('deployer');

      expect(perms).toEqual(['chatops:deploy', 'chatops:read']);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT p.resource, p.action'),
        ['deployer']
      );
    });

    it('should return cached result on second call within TTL', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'deploy' }],
      });

      await service.getRolePermissions('deployer');
      await service.getRolePermissions('deployer');

      // Should only query DB once (second call uses cache)
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should return empty array on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB connection failed'));

      const perms = await service.getRolePermissions('deployer');

      expect(perms).toEqual([]);
    });

    it('should return empty array for role with no permissions', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const perms = await service.getRolePermissions('viewer');

      expect(perms).toEqual([]);
    });
  });

  // ==================== checkCommandLevel ====================

  describe('checkCommandLevel', () => {
    it('should allow deploy command when role has chatops:deploy permission', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'deploy' }],
      });

      const result = await service.checkCommandLevel('user-1', 'deployer', 'deploy');

      expect(result.allowed).toBe(true);
    });

    it('should deny deploy command when role lacks chatops:deploy', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'read' }],
      });

      const result = await service.checkCommandLevel('user-1', 'viewer', 'deploy');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('缺少权限');
      expect(result.deniedAt).toBe('command_level');
    });

    it('should deny unknown command', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkCommandLevel('user-1', 'admin', 'unknown-cmd');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('命令不存在');
      expect(result.deniedAt).toBe('command_level');
    });

    it('should map rollback to chatops:deploy permission', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'deploy' }],
      });

      const result = await service.checkCommandLevel('user-1', 'deployer', 'rollback');

      expect(result.allowed).toBe(true);
    });

    it('should map restart to chatops:restart permission', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'restart' }],
      });

      const result = await service.checkCommandLevel('user-1', 'operator', 'restart');

      expect(result.allowed).toBe(true);
    });

    it('should map logs and status to chatops:read permission', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'read' }],
      });

      const logsResult = await service.checkCommandLevel('user-1', 'viewer', 'logs');
      expect(logsResult.allowed).toBe(true);

      // Clear cache for next check
      service.invalidateCache('viewer');
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'read' }],
      });

      const statusResult = await service.checkCommandLevel('user-1', 'viewer', 'status');
      expect(statusResult.allowed).toBe(true);
    });

    it('should map diagnose to chatops:diagnose permission', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'diagnose' }],
      });

      const result = await service.checkCommandLevel('user-1', 'diagnoser', 'diagnose');

      expect(result.allowed).toBe(true);
    });
  });

  // ==================== checkResourceLevel ====================

  describe('checkResourceLevel', () => {
    it('should allow when user has resource access', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.checkResourceLevel('user-1', 'pipeline', 'p-1');

      expect(result.allowed).toBe(true);
    });

    it('should deny when user has no resource access', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.checkResourceLevel('user-1', 'pipeline', 'p-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('无权访问资源');
      expect(result.deniedAt).toBe('resource_level');
    });

    it('should include action in query when provided', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      await service.checkResourceLevel('user-1', 'pipeline', 'p-1', 'deploy');

      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('action = $4');
      expect(queryCall[1]).toEqual(['user-1', 'pipeline', 'p-1', 'deploy']);
    });

    it('should return denied on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const result = await service.checkResourceLevel('user-1', 'pipeline', 'p-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('资源权限校验失败');
      expect(result.deniedAt).toBe('resource_level');
    });
  });

  // ==================== check (串联校验) ====================

  describe('check', () => {
    it('should pass command-level check when role has permission', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'read' }],
      });

      const result = await service.check('user-1', 'viewer', 'status');

      expect(result.allowed).toBe(true);
    });

    it('should fail and write audit log when command-level check fails', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'read' }],
      });

      const result = await service.check('user-1', 'viewer', 'deploy');

      expect(result.allowed).toBe(false);
      // Should have written audit log (INSERT INTO chatops_audit_logs)
      const auditCall = mockPool.query.mock.calls.find((c: any[]) =>
        c[0].includes('chatops_audit_logs')
      );
      expect(auditCall).toBeDefined();
    });

    it('should check resource-level when resourceType and resourceId provided', async () => {
      // First call: getRolePermissions
      mockPool.query.mockResolvedValueOnce({
        rows: [{ resource: 'chatops', action: 'deploy' }],
      });
      // Second call: checkResourceLevel query
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      // Third call: audit log
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.check('user-1', 'deployer', 'deploy', 'pipeline', 'p-1');

      expect(result.allowed).toBe(true);
    });

    it('should deny when resource-level check fails', async () => {
      // First call: getRolePermissions
      mockPool.query.mockResolvedValueOnce({
        rows: [{ resource: 'chatops', action: 'deploy' }],
      });
      // Second call: checkResourceLevel query (denied)
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      // Third call: audit log
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.check('user-1', 'deployer', 'deploy', 'pipeline', 'p-1');

      expect(result.allowed).toBe(false);
      expect(result.deniedAt).toBe('resource_level');
    });
  });

  // ==================== invalidateCache ====================

  describe('invalidateCache', () => {
    it('should clear specific role cache', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'deploy' }],
      });

      // Populate cache
      await service.getRolePermissions('deployer');
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      // Invalidate
      service.invalidateCache('deployer');

      // Should query again
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'read' }],
      });
      await service.getRolePermissions('deployer');
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should clear all caches when no role specified', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ resource: 'chatops', action: 'deploy' }],
      });

      await service.getRolePermissions('role1');
      await service.getRolePermissions('role2');

      service.invalidateCache();

      // Both should need re-querying
      mockPool.query.mockResolvedValue({ rows: [] });
      await service.getRolePermissions('role1');
      await service.getRolePermissions('role2');

      expect(mockPool.query).toHaveBeenCalledTimes(4); // 2 initial + 2 after clear
    });
  });

  // ==================== Role CRUD ====================

  describe('getAllRoles', () => {
    it('should return roles with permissions', async () => {
      // First query: roles
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'r1', name: 'admin', description: 'Admin role', command_count: 5, user_count: 2 },
        ],
      });
      // Second query: permissions for role
      mockPool.query.mockResolvedValueOnce({
        rows: [{ permission: 'chatops:deploy' }, { permission: 'chatops:read' }],
      });

      const roles = await service.getAllRoles();

      expect(roles).toHaveLength(1);
      expect(roles[0].name).toBe('admin');
      expect(roles[0].permissions).toEqual(['chatops:deploy', 'chatops:read']);
    });

    it('should return empty array when no roles exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const roles = await service.getAllRoles();

      expect(roles).toHaveLength(0);
    });
  });

  describe('getRoleById', () => {
    it('should return role with permissions', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'r1', name: 'admin' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ permission: 'chatops:deploy' }],
      });

      const role = await service.getRoleById('r1');

      expect(role).not.toBeNull();
      expect(role!.name).toBe('admin');
      expect(role!.permissions).toEqual(['chatops:deploy']);
    });

    it('should return null when role not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const role = await service.getRoleById('nonexistent');

      expect(role).toBeNull();
    });
  });

  describe('createRole', () => {
    it('should create role and return it', async () => {
      // INSERT role
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      // INSERT permissions (2 calls)
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      // getRoleById -> SELECT role
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', name: 'deployer' }],
      });
      // getRoleById -> SELECT permissions
      mockPool.query.mockResolvedValueOnce({
        rows: [{ permission: 'chatops:deploy' }, { permission: 'chatops:restart' }],
      });

      const role = await service.createRole({
        name: 'deployer',
        description: 'Deploy role',
        permissions: ['chatops:deploy', 'chatops:restart'],
      });

      expect(role).not.toBeNull();
      expect(role.name).toBe('deployer');
    });

    it('should create role without permissions', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'uuid-1', name: 'empty-role' }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const role = await service.createRole({ name: 'empty-role' });

      expect(role).not.toBeNull();
    });
  });

  describe('deleteRole', () => {
    it('should delete role and return true', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteRole('r1');

      expect(result).toBe(true);
    });

    it('should return false when role not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.deleteRole('nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== Command Permission CRUD ====================

  describe('getAllCommandPermissions', () => {
    it('should return command permissions with assigned roles', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'cp1', command: 'deploy', capability: 'chatops:deploy', assigned_roles: ['r1'] },
        ],
      });

      const result = await service.getAllCommandPermissions();

      expect(result).toHaveLength(1);
      expect(result[0].command).toBe('deploy');
    });
  });

  describe('getCommandPermission', () => {
    it('should return command permission by id', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'cp1', command: 'deploy', assigned_roles: ['r1'] }],
      });

      const result = await service.getCommandPermission('cp1');

      expect(result).not.toBeNull();
      expect(result.command).toBe('deploy');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getCommandPermission('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteCommandPermission', () => {
    it('should delete and return true', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteCommandPermission('cp1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.deleteCommandPermission('nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== Environment Permission CRUD ====================

  describe('getAllEnvironmentPermissions', () => {
    it('should return environment permissions with roles and commands', async () => {
      // Query environments
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'env1', environment: 'production' }],
      });
      // Query roles for env
      mockPool.query.mockResolvedValueOnce({
        rows: [{ role_id: 'r1' }],
      });
      // Query commands for env
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { command: 'deploy', is_denied: false },
          { command: 'restart', is_denied: true },
        ],
      });

      const result = await service.getAllEnvironmentPermissions();

      expect(result).toHaveLength(1);
      expect(result[0].environment).toBe('production');
      expect(result[0].assigned_roles).toEqual(['r1']);
      expect(result[0].allowed_commands).toEqual(['deploy']);
      expect(result[0].denied_commands).toEqual(['restart']);
    });
  });

  describe('deleteEnvironmentPermission', () => {
    it('should delete and return true', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteEnvironmentPermission('env1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.deleteEnvironmentPermission('nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== checkCommandPermission (Capability) ====================

  describe('checkCommandPermission', () => {
    it('should return allowed when user has capability permission', async () => {
      // 1. capability mapping
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          capability_id: 'chatops:deploy',
          risk_level: 3,
          requires_approval: false,
          enabled: true,
        }],
      });
      // 2. user roles
      mockPool.query.mockResolvedValueOnce({
        rows: [{ name: 'deployer' }],
      });
      // 3. role capability check
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.checkCommandPermission('user-1', 'deploy');

      expect(result.allowed).toBe(true);
      expect(result.capability).toBe('chatops:deploy');
    });

    it('should deny when no capability mapping exists', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkCommandPermission('user-1', 'unknown');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('命令未配置能力映射');
    });

    it('should deny when user has no roles', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ capability_id: 'chatops:deploy', risk_level: 3, requires_approval: false }],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.checkCommandPermission('user-1', 'deploy');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('用户无角色');
    });

    it('should allow admin role even without explicit capability assignment', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ capability_id: 'chatops:deploy', risk_level: 3, requires_approval: true }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ name: 'admin' }],
      });
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 }); // No explicit assignment

      const result = await service.checkCommandPermission('user-1', 'deploy');

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });

    it('should deny on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const result = await service.checkCommandPermission('user-1', 'deploy');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Capability 权限检查失败');
    });
  });

  // ==================== getUserAllowedCommands ====================

  describe('getUserAllowedCommands', () => {
    it('should return commands for user roles', async () => {
      // User roles
      mockPool.query.mockResolvedValueOnce({
        rows: [{ name: 'deployer' }],
      });
      // Commands for role
      mockPool.query.mockResolvedValueOnce({
        rows: [{ command: 'deploy' }, { command: 'rollback' }],
      });

      const commands = await service.getUserAllowedCommands('user-1');

      expect(commands).toEqual(['deploy', 'rollback']);
    });

    it('should return all commands for admin role', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ name: 'admin' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ command_id: 'deploy' }, { command_id: 'restart' }],
      });

      const commands = await service.getUserAllowedCommands('user-1');

      expect(commands).toEqual(['deploy', 'restart']);
    });

    it('should return empty array when user has no roles', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const commands = await service.getUserAllowedCommands('user-1');

      expect(commands).toEqual([]);
    });

    it('should return empty array on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const commands = await service.getUserAllowedCommands('user-1');

      expect(commands).toEqual([]);
    });
  });
});
