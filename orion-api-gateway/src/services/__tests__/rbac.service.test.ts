/**
 * RBAC Service 单元测试
 */

import {
  RbacService,
  SYSTEM_ROLES,
  SYSTEM_PERMISSIONS,
  Role,
  Permission,
} from '../rbac.service';

describe('RbacService', () => {
  let rbacService: RbacService;

  beforeEach(() => {
    rbacService = new RbacService();
  });

  describe('系统角色初始化', () => {
    it('should initialize with system roles', () => {
      const adminRole = rbacService.getRole('admin');
      expect(adminRole).toBeDefined();
      expect(adminRole?.id).toBe('admin');
      expect(adminRole?.permissions).toContain('*');
    });

    it('should have all system roles', () => {
      const roles = rbacService.getAllRoles();
      expect(roles.length).toBeGreaterThanOrEqual(5); // admin, developer, operator, tester, guest

      const roleIds = roles.map((r) => r.id);
      expect(roleIds).toContain('admin');
      expect(roleIds).toContain('developer');
      expect(roleIds).toContain('guest');
    });
  });

  describe('系统权限初始化', () => {
    it('should initialize with system permissions', () => {
      const permission = rbacService.getPermission('project:read');
      expect(permission).toBeDefined();
      expect(permission?.resource).toBe('project');
      expect(permission?.action).toBe('read');
    });

    it('should have all required permissions', () => {
      const permissions = rbacService.getAllPermissions();
      expect(permissions.length).toBeGreaterThan(10);
    });
  });

  describe('角色分配', () => {
    it('should assign a role to a user', () => {
      rbacService.assignRole('user1', 'developer');

      const userRoles = rbacService.getUserRoles('user1');
      expect(userRoles.length).toBe(1);
      expect(userRoles[0].id).toBe('developer');
    });

    it('should assign multiple roles to a user', () => {
      rbacService.assignRole('user1', 'developer');
      rbacService.assignRole('user1', 'tester');

      const userRoles = rbacService.getUserRoles('user1');
      expect(userRoles.length).toBe(2);
    });

    it('should throw error when assigning non-existent role', () => {
      expect(() => {
        rbacService.assignRole('user1', 'nonexistent-role');
      }).toThrow("Role 'nonexistent-role' not found");
    });
  });

  describe('角色撤销', () => {
    it('should revoke a role from a user', () => {
      rbacService.assignRole('user1', 'developer');
      rbacService.revokeRole('user1', 'developer');

      const userRoles = rbacService.getUserRoles('user1');
      expect(userRoles.length).toBe(0);
    });
  });

  describe('权限检查', () => {
    it('should check if user has a specific role', () => {
      rbacService.assignRole('user1', 'admin');

      expect(rbacService.hasRole('user1', 'admin')).toBe(true);
      expect(rbacService.hasRole('user1', 'developer')).toBe(false);
    });

    it('should check if user has a specific permission', () => {
      rbacService.assignRole('user1', 'admin');

      // Admin has all permissions
      expect(rbacService.hasPermission('user1', 'project:read')).toBe(true);
      expect(rbacService.hasPermission('user1', 'deployment:delete')).toBe(true);
    });

    it('should check permissions for developer role', () => {
      rbacService.assignRole('user1', 'developer');

      expect(rbacService.hasPermission('user1', 'project:read')).toBe(true);
      expect(rbacService.hasPermission('user1', 'project:write')).toBe(true);
      expect(rbacService.hasPermission('user1', 'deployment:create')).toBe(true);
    });

    it('should check if user has any of the specified permissions', () => {
      rbacService.assignRole('user1', 'developer');

      expect(
        rbacService.hasAnyPermission('user1', ['project:read', 'admin:only'])
      ).toBe(true);
    });

    it('should check if user has all of the specified permissions', () => {
      rbacService.assignRole('user1', 'developer');

      expect(
        rbacService.hasAllPermissions('user1', ['project:read', 'project:write'])
      ).toBe(true);

      expect(
        rbacService.hasAllPermissions('user1', ['project:read', 'admin:only'])
      ).toBe(false);
    });
  });

  describe('资源权限检查', () => {
    it('should check resource-level permissions', () => {
      rbacService.assignRole('user1', 'developer');

      expect(
        rbacService.checkResourcePermission('user1', 'project', 'read')
      ).toBe(true);
      expect(
        rbacService.checkResourcePermission('user1', 'project', 'delete')
      ).toBe(false);
    });
  });

  describe('角色过期', () => {
    it('should not return expired roles', () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      rbacService.assignRole('user1', 'developer', 'admin', expiredDate);

      const userRoles = rbacService.getUserRoles('user1');
      expect(userRoles.length).toBe(0); // Should be filtered out
    });

    it('should return non-expired roles', () => {
      const futureDate = new Date(Date.now() + 1000000); // Far future
      rbacService.assignRole('user1', 'developer', 'admin', futureDate);

      const userRoles = rbacService.getUserRoles('user1');
      expect(userRoles.length).toBe(1);
    });
  });

  describe('自定义角色', () => {
    it('should register a custom role', () => {
      const customRole: Role = {
        id: 'custom-role',
        name: 'Custom Role',
        description: 'A custom role for testing',
        permissions: ['project:read', 'log:read'],
      };

      rbacService.registerRole(customRole);

      const role = rbacService.getRole('custom-role');
      expect(role).toBeDefined();
      expect(role?.name).toBe('Custom Role');
    });

    it('should register a custom permission', () => {
      const customPermission: Permission = {
        id: 'custom:action',
        name: 'Custom Action',
        resource: 'custom',
        action: 'action',
      };

      rbacService.registerPermission(customPermission);

      const permission = rbacService.getPermission('custom:action');
      expect(permission).toBeDefined();
      expect(permission?.name).toBe('Custom Action');
    });
  });

  describe('Guest 角色权限', () => {
    it('should have read-only permissions', () => {
      const guestRole = rbacService.getRole('guest');
      expect(guestRole).toBeDefined();

      // Guest should only have read permissions
      const guestPermissions = guestRole?.permissions || [];
      guestPermissions.forEach((perm) => {
        expect(perm).toMatch(/:read$/);
      });
    });
  });

  // ==================== 缓存功能测试 ====================

  describe('Permission Caching', () => {
    it('should cache user permissions', () => {
      rbacService.assignRole('user1', 'developer');

      // 第一次获取（应该缓存）
      const perms1 = rbacService.getUserPermissions('user1');

      // 第二次获取（从缓存）
      const perms2 = rbacService.getUserPermissions('user1');

      expect(perms1).toEqual(perms2);

      // 检查缓存统计
      const stats = rbacService.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.entries).toContain('user1');
    });

    it('should invalidate user cache on role change', () => {
      rbacService.assignRole('user1', 'developer');
      rbacService.getUserPermissions('user1');

      // 分配新角色
      rbacService.assignRole('user1', 'tester');

      // 缓存应该被清除
      const stats = rbacService.getCacheStats();
      expect(stats.entries).not.toContain('user1');
    });

    it('should invalidate all cache on global change', () => {
      rbacService.assignRole('user1', 'developer');
      rbacService.assignRole('user2', 'admin');
      rbacService.getUserPermissions('user1');
      rbacService.getUserPermissions('user2');

      // 注册新角色
      const newRole: Role = {
        id: 'new-role',
        name: 'New Role',
        permissions: ['custom:action'],
      };
      rbacService.registerRole(newRole);

      // 缓存应该被清除
      const stats = rbacService.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should disable cache when configured', () => {
      rbacService.setCacheConfig(false);

      rbacService.assignRole('user1', 'developer');
      rbacService.getUserPermissions('user1');

      const stats = rbacService.getCacheStats();
      expect(stats.enabled).toBe(false);
      expect(stats.size).toBe(0);
    });

    it('should set custom cache TTL', () => {
      rbacService.setCacheConfig(true, 30000);

      const stats = rbacService.getCacheStats();
      expect(stats.ttl).toBe(30000);
    });
  });

  // ==================== 权限矩阵测试 ====================

  describe('Permission Matrix', () => {
    it('should build permission matrix on initialization', () => {
      const adminPerms = rbacService.getRolePermissions('admin');
      expect(adminPerms).toBeDefined();
      expect(adminPerms?.has('*')).toBe(true);
    });

    it('should check role has permission via matrix', () => {
      expect(rbacService.roleHasPermission('developer', 'pipeline:read')).toBe(true);
      expect(rbacService.roleHasPermission('developer', 'deployment:delete')).toBe(false);
    });

    it('should get roles that have a permission', () => {
      const roles = rbacService.getPermissionRoles('pipeline:read');
      expect(roles.length).toBeGreaterThan(0);
      expect(roles.some((r) => r.id === 'developer')).toBe(true);
    });

    it('should update matrix on role registration', () => {
      const customRole: Role = {
        id: 'custom',
        name: 'Custom',
        permissions: ['custom:read', 'custom:write'],
      };
      rbacService.registerRole(customRole);

      const perms = rbacService.getRolePermissions('custom');
      expect(perms?.has('custom:read')).toBe(true);
      expect(perms?.has('custom:write')).toBe(true);
    });
  });

  // ==================== 快速权限查询测试 ====================

  describe('Fast Permission Query', () => {
    it('should get user permission IDs as Set', () => {
      rbacService.assignRole('user1', 'developer');
      const permIds = rbacService.getUserPermissionIds('user1');

      expect(permIds.has('pipeline:read')).toBe(true);
      expect(permIds.has('project:read')).toBe(true);
    });

    it('should return wildcard for admin users', () => {
      rbacService.assignRole('admin1', 'admin');
      const permIds = rbacService.getUserPermissionIds('admin1');

      expect(permIds.has('*')).toBe(true);
    });
  });

  // ==================== 事件订阅测试 ====================

  describe('Event Subscription', () => {
    it('should emit roleAssigned event', () => {
      const callback = jest.fn();
      rbacService.onRoleAssigned(callback);

      rbacService.assignRole('user1', 'developer', 'admin');

      expect(callback).toHaveBeenCalledWith({
        userId: 'user1',
        roleId: 'developer',
        grantedBy: 'admin',
      });
    });

    it('should emit roleRevoked event', () => {
      rbacService.assignRole('user1', 'developer');

      const callback = jest.fn();
      rbacService.onRoleRevoked(callback);

      rbacService.revokeRole('user1', 'developer');

      expect(callback).toHaveBeenCalledWith({
        userId: 'user1',
        roleId: 'developer',
      });
    });

    it('should subscribe to all permission changes', () => {
      const callback = jest.fn();
      rbacService.onPermissionChange(callback);

      rbacService.assignRole('user1', 'developer');
      expect(callback).toHaveBeenCalledWith({ type: 'assign', userId: 'user1', roleId: 'developer' });

      rbacService.revokeRole('user1', 'developer');
      expect(callback).toHaveBeenCalledWith({ type: 'revoke', userId: 'user1', roleId: 'developer' });

      rbacService.invalidateCache();
      expect(callback).toHaveBeenCalledWith({ type: 'invalidate' });
    });
  });

  // ==================== 权限绕过风险检查测试 ====================

  describe('Permission Bypass Risk Check', () => {
    it('should warn about wildcard permission', () => {
      rbacService.assignRole('admin1', 'admin');

      const result = rbacService.checkBypassRisk('admin1', 'pipeline', 'delete');

      expect(result.warnings.some((w) => w.includes('wildcard'))).toBe(true);
    });

    it('should warn about admin role', () => {
      rbacService.assignRole('user1', 'admin');

      const result = rbacService.checkBypassRisk('user1', 'user', 'delete');

      expect(result.warnings.some((w) => w.includes('admin role'))).toBe(true);
    });

    it('should warn about missing explicit permission', () => {
      rbacService.assignRole('guest1', 'guest');

      const result = rbacService.checkBypassRisk('guest1', 'pipeline', 'delete');

      expect(result.safe).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should be safe for properly scoped permissions', () => {
      rbacService.assignRole('dev1', 'developer');

      const result = rbacService.checkBypassRisk('dev1', 'pipeline', 'read');

      // developer 有明确的 pipeline:read 权限
      expect(result.safe).toBe(true);
    });
  });

  // ==================== 权限审计测试 ====================

  describe('Permission Audit', () => {
    it('should generate audit report for user', () => {
      rbacService.assignRole('user1', 'developer');

      const audit = rbacService.getPermissionAudit('user1');

      expect(audit.userId).toBe('user1');
      expect(audit.roles.length).toBe(1);
      expect(audit.permissions.length).toBeGreaterThan(0);
      expect(audit.riskLevel).toBe('low');
    });

    it('should identify high-risk admin user', () => {
      rbacService.assignRole('admin1', 'admin');

      const audit = rbacService.getPermissionAudit('admin1');

      expect(audit.riskLevel).toBe('high');
      expect(audit.warnings.some((w) => w.includes('high-risk'))).toBe(true);
    });

    it('should identify medium-risk for sensitive permissions', () => {
      const customRole: Role = {
        id: 'sensitive-role',
        name: 'Sensitive Role',
        permissions: ['user:delete', 'role:assign'],
      };
      rbacService.registerRole(customRole);
      rbacService.assignRole('user1', 'sensitive-role');

      const audit = rbacService.getPermissionAudit('user1');

      expect(audit.riskLevel).toBe('medium');
      expect(audit.warnings.length).toBeGreaterThan(0);
    });
  });

  // ==================== 角色更新测试 ====================

  describe('Role Update', () => {
    it('should update existing role assignment', () => {
      rbacService.assignRole('user1', 'developer');

      // 再次分配同一角色（应该更新过期时间）
      const futureDate = new Date(Date.now() + 1000000);
      rbacService.assignRole('user1', 'developer', 'admin', futureDate);

      const userRoles = rbacService.getUserRoles('user1');
      expect(userRoles.length).toBe(1);
    });

    it('should handle duplicate role assignments', () => {
      rbacService.assignRole('user1', 'developer');
      rbacService.assignRole('user1', 'developer');

      const userRoles = rbacService.getUserRoles('user1');
      expect(userRoles.length).toBe(1);
    });
  });
});