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
});
