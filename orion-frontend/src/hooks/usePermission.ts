import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

// 角色权限映射（与后端同步，来源于 docs/architecture/rbac-abac-unified-implementation.md §4）
const ROLE_PERMISSIONS: Record<string, string[]> = {
  'super_admin': ['*:*'],
  'platform_admin': ['*:manage', '*:read', '*:write', '*:execute', '*:delete', '*:approve'],
  'tenant_admin': ['*:manage', '*:read', '*:write', 'audit_log:read'],
  'org_admin': ['*:read', '*:write', '*:execute', '*:manage', '*:approve'],
  'security_admin': ['audit_log:read', 'config:read', 'secrets:read', 'user:read', 'role:read',
                      'project:read', 'pipeline:read', 'deployment:read', 'alert:read',
                      'security:manage', 'ticket:read', 'approval:approve'],
  'finops_admin': ['finops:*', 'project:read', 'deployment:read', 'pipeline:read'],
  'tech_lead': ['project:read', 'project:write', 'pipeline:read', 'pipeline:write',
                 'pipeline:execute', 'pipeline:approve', 'deployment:read',
                 'deployment:execute', 'alert:read', 'alert:acknowledge',
                 'config:read', 'ticket:read', 'ticket:write',
                 'artifact:read', 'knowledge:read', 'knowledge:write'],
  'developer': ['project:read', 'pipeline:read', 'pipeline:write', 'pipeline:execute',
                 'deployment:read', 'alert:read', 'config:read',
                 'ticket:read', 'ticket:write', 'artifact:read',
                 'knowledge:read'],
  'sre': ['*:read', 'deployment:execute', 'deployment:approve',
           'environment:*', 'alert:*', 'config:write',
           'pipeline:read', 'pipeline:execute', 'iac:*',
           'ticket:read', 'ticket:write', 'oncall:*'],
  'dba': ['project:read', 'pipeline:read', 'deployment:read',
           'config:read', 'alert:read', 'cmdb:read',
           'environment:read', 'secrets:read'],
  'viewer': ['project:read', 'pipeline:read', 'deployment:read',
              'alert:read', 'artifact:read', 'knowledge:read',
              'ticket:read', 'finops:read'],
  'auditor': ['audit_log:*', '*:read', 'ticket:read', 'approval:read'],
  // 项目级角色
  'project_admin': ['project:*', 'pipeline:*', 'deployment:*',
                     'environment:read', 'artifact:*', 'alert:*',
                     'ticket:*', 'approval:*', 'secrets:*', 'oncall:*'],
  'project_lead': ['project:read', 'project:write', 'pipeline:*',
                    'pipeline:approve', 'deployment:read',
                    'deployment:execute', 'artifact:read', 'artifact:write',
                    'alert:read', 'alert:acknowledge', 'ticket:*',
                    'approval:approve', 'secrets:read', 'oncall:*'],
  'project_developer': ['project:read', 'pipeline:read', 'pipeline:write',
                         'pipeline:execute', 'deployment:read',
                         'artifact:read', 'alert:read', 'ticket:read',
                         'ticket:write', 'secrets:read'],
  'project_viewer': ['project:read', 'pipeline:read', 'deployment:read',
                      'artifact:read', 'alert:read', 'ticket:read',
                      'knowledge:read'],
};

// 通配符匹配逻辑
function matchPermission(perms: string[], resource: string, action: string): boolean {
  for (const perm of perms) {
    if (perm === '*:*') return true;
    if (perm === `${resource}:${action}`) return true;
    if (perm === `${resource}:*`) return true;
    if (perm === `*:${action}`) return true;
  }
  return false;
}

export function usePermission() {
  const user = useAuthStore(state => state.user);

  // 支持多角色（从 authStore 读取 roles 数组或单角色）
  const userRoles = useMemo(() => {
    if (user && 'roles' in user && Array.isArray((user as any).roles) && (user as any).roles.length > 0) {
      return (user as any).roles;
    }
    if (user && 'role' in user && (user as any).role) {
      return [(user as any).role];
    }
    return [];
  }, [user]);

  const hasPermission = useMemo(() => {
    return (resource: string, action: string): boolean => {
      for (const role of userRoles) {
        const perms = ROLE_PERMISSIONS[role] || [];
        if (matchPermission(perms, resource, action)) return true;
      }
      return false;
    };
  }, [userRoles]);

  const canView = useMemo(() => (resource: string) => hasPermission(resource, 'read'), [hasPermission]);
  const canEdit = useMemo(() => (resource: string) => hasPermission(resource, 'write'), [hasPermission]);
  const canDelete = useMemo(() => (resource: string) => hasPermission(resource, 'delete'), [hasPermission]);
  const canExecute = useMemo(() => (resource: string) => hasPermission(resource, 'execute'), [hasPermission]);
  const canApprove = useMemo(() => (resource: string) => hasPermission(resource, 'approve'), [hasPermission]);
  const canManage = useMemo(() => (resource: string) => hasPermission(resource, 'manage'), [hasPermission]);
  const canAcknowledge = useMemo(() => (resource: string) => hasPermission(resource, 'acknowledge'), [hasPermission]);

  return { hasPermission, canView, canEdit, canDelete, canExecute, canApprove, canManage, canAcknowledge };
}

export { ROLE_PERMISSIONS };