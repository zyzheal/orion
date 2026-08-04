import { useMemo, useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/api';

// 硬编码 fallback（与后端 permission.go / RoleService.ts 保持一致）
const ROLE_PERMISSIONS_FALLBACK: Record<string, string[]> = {
  'admin': ['*:*'],
  'super_admin': ['*:*'],
  'platform_admin': ['*:manage', '*:read', '*:write', '*:execute', '*:delete', '*:approve'],
  'tenant_admin': ['*:read', '*:write', '*:manage', 'audit_log:read'],
  'org_admin': ['*:read', '*:write', '*:execute', '*:manage', '*:approve'],
  'security_admin': ['audit_log:read', 'config:read', 'secrets:read', 'user:read', 'role:read',
    'project:read', 'pipeline:read', 'deployment:read', 'alert:read',
    'security:manage', 'ticket:read', 'ticket:write', 'approval:approve'],
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
  'oncall': ['chatops:use', 'chatops:read', 'ai:gateway:read', 'ai:trace:read',
    'ai:agent:read', 'ai:agent:execute', 'ai:security:read',
    'alert:*', 'pipeline:read', 'deployment:read', 'ticket:read', 'ticket:write'],
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

// 后端角色权限映射缓存（从 API 动态获取，失败时 fallback 到硬编码值）
let _permissionsCache: Record<string, string[]> | null = null;
let _fetchPromise: Promise<Record<string, string[]>> | null = null;

/**
 * 从后端获取角色权限映射，带内存缓存。
 * 获取成功后 _permissionsCache 被设置，后续调用直接返回缓存。
 */
async function fetchPermissionsMap(): Promise<Record<string, string[]>> {
  if (_permissionsCache) return _permissionsCache;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    try {
      const resp = await fetch('/api/v1/roles/permissions-map', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'x-tenant-id': localStorage.getItem('tenant_id') || '',
        },
      });
      if (resp.ok) {
        const body = await resp.json();
        if (body.success && body.data && typeof body.data === 'object') {
          _permissionsCache = body.data as Record<string, string[]>;
          return _permissionsCache!;
        }
      }
    } catch {
      // fallback to hardcoded
    } finally {
      _fetchPromise = null;
    }
    return ROLE_PERMISSIONS_FALLBACK;
  })();

  return _fetchPromise;
}

/**
 * 清除权限缓存（角色变更后调用）
 */
export function clearPermissionsCache(): void {
  _permissionsCache = null;
  _fetchPromise = null;
}

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

// 默认防抖时长 (ms)
const DEFAULT_DEBOUNCE_MS = 250;

/**
 * 防抖版本的 hasPermission 缓存检查
 * 短时间内重复调用相同参数时，直接返回缓存结果而非重新计算
 */
function createDebouncedPermissionChecker(hasPermissionBase: (resource: string, action: string) => boolean) {
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  const cache = new Map<string, boolean>();

  return {
    hasPermissionDebounced: useCallback((resource: string, action: string): boolean => {
      const key = `${resource}:${action}`;

      // 清除未完成的防抖计时器
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }

      // 返回缓存结果（即使可能是旧的，也先返回，避免闪烁）
      if (cache.has(key)) {
        return cache.get(key)!;
      }

      // 触发异步刷新缓存
      pendingTimer = setTimeout(() => {
        const result = hasPermissionBase(resource, action);
        cache.set(key, result);
        pendingTimer = null;
      }, DEFAULT_DEBOUNCE_MS);

      // 无缓存时，直接同步计算
      return hasPermissionBase(resource, action);
    }, [hasPermissionBase]),

    clear: useCallback(() => {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      cache.clear();
    }, []),

    invalidate: useCallback((resource: string, action: string) => {
      cache.delete(`${resource}:${action}`);
      // 同时清除同资源的通配缓存
      cache.delete(`${resource}:*`);
    }, []),
  };
}

export function usePermission() {
  const user = useAuthStore(state => state.user);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(_permissionsCache || ROLE_PERMISSIONS_FALLBACK);

  // 启动时异步加载后端权限映射
  useEffect(() => {
    fetchPermissionsMap().then(map => {
      setRolePermissions(map);
    });
  }, []);

  // 支持多角色（从 authStore 读取 roles 数组或单角色）
  const userRoles = useMemo(() => {
    const userWithRoles = user as unknown as User;
    if (user && 'roles' in userWithRoles && Array.isArray(userWithRoles.roles) && userWithRoles.roles.length > 0) {
      return userWithRoles.roles as string[];
    }
    if (user && 'role' in userWithRoles && userWithRoles.role) {
      return [userWithRoles.role as string];
    }
    return [];
  }, [user]);

  const hasPermissionBase = useMemo(() => {
    return (resource: string, action: string): boolean => {
      for (const role of userRoles) {
        const perms = rolePermissions[role] || [];
        if (matchPermission(perms, resource, action)) return true;
      }
      return false;
    };
  }, [userRoles, rolePermissions]);

  // 防抖版本的 hasPermission（减少频繁渲染导致的重复计算）
  const { hasPermissionDebounced } = createDebouncedPermissionChecker(hasPermissionBase);

  const hasPermission = useMemo(() => {
    return (resource: string, action: string): boolean => {
      return hasPermissionBase(resource, action);
    };
  }, [hasPermissionBase]);

  const canView = useMemo(() => (resource: string) => hasPermission(resource, 'read'), [hasPermission]);
  const canEdit = useMemo(() => (resource: string) => hasPermission(resource, 'write'), [hasPermission]);
  const canDelete = useMemo(() => (resource: string) => hasPermission(resource, 'delete'), [hasPermission]);
  const canExecute = useMemo(() => (resource: string) => hasPermission(resource, 'execute'), [hasPermission]);
  const canApprove = useMemo(() => (resource: string) => hasPermission(resource, 'approve'), [hasPermission]);
  const canManage = useMemo(() => (resource: string) => hasPermission(resource, 'manage'), [hasPermission]);
  const canAcknowledge = useMemo(() => (resource: string) => hasPermission(resource, 'acknowledge'), [hasPermission]);
  const canRead = useMemo(() => (resource: string) => hasPermission(resource, 'read'), [hasPermission]);

  // 权限信息
  const currentRoles = userRoles;
  const hasAnyPermission = useMemo(() => currentRoles.length > 0, [currentRoles]);

  // 检查用户是否拥有管理员权限
  const isAdmin = useMemo(() => {
    return currentRoles.some((r) => ['admin', 'super_admin', 'platform_admin', 'tenant_admin', 'org_admin'].includes(r));
  }, [currentRoles]);

  return {
    hasPermission,
    hasPermissionDebounced,
    canView,
    canEdit,
    canDelete,
    canExecute,
    canApprove,
    canManage,
    canAcknowledge,
    canRead,
    currentRoles,
    hasAnyPermission,
    isAdmin,
  };
}

// 向后兼容导出
const ROLE_PERMISSIONS = ROLE_PERMISSIONS_FALLBACK;
export { ROLE_PERMISSIONS };
