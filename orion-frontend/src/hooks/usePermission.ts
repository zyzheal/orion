import { useMemo, useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { API_BASE_URL } from '@/api/client';
import type { User } from '@/types/api';

// 硬编码 fallback（与后端 permission.go / RoleService.ts 保持一致）
const ROLE_PERMISSIONS_FALLBACK: Record<string, string[]> = {
  admin: ['*:*'],
  super_admin: ['*:*'],
  // ':admin' is granted to both admins — 67 backend guard sites (chatops:admin,
  // knowledge:admin, tracing:update, sprint:update, ...) resolve only through it.
  platform_admin: ['*:manage', '*:read', '*:write', '*:execute', '*:delete', '*:approve', '*:admin'],
  tenant_admin: ['*:read', '*:write', '*:manage', '*:admin', 'audit_log:read'],
  org_admin: ['*:read', '*:write', '*:execute', '*:manage', '*:approve'],
  security_admin: [
    'audit_log:read',
    'config:read',
    'secrets:read',
    'user:read',
    'role:read',
    'project:read',
    'pipeline:read',
    'deployment:read',
    'alert:read',
    'security:manage',
    'ticket:read',
    'ticket:write',
    'approval:approve',
  ],
  finops_admin: ['finops:*', 'project:read', 'deployment:read', 'pipeline:read'],
  tech_lead: [
    'project:read',
    'project:write',
    'pipeline:read',
    'pipeline:write',
    'pipeline:execute',
    'pipeline:approve',
    'deployment:read',
    'deployment:execute',
    'alert:read',
    'alert:acknowledge',
    'config:read',
    'ticket:read',
    'ticket:write',
    'artifact:read',
    'knowledge:read',
    'knowledge:write',
  ],
  developer: [
    'project:read',
    'pipeline:read',
    'pipeline:write',
    'pipeline:execute',
    'deployment:read',
    'alert:read',
    'config:read',
    'ticket:read',
    'ticket:write',
    'artifact:read',
    'knowledge:read',
  ],
  sre: [
    '*:read',
    'deployment:execute',
    'deployment:approve',
    'environment:*',
    'alert:*',
    'config:write',
    'pipeline:read',
    'pipeline:execute',
    'iac:*',
    'ticket:read',
    'ticket:write',
    'oncall:*',
  ],
  dba: [
    'project:read',
    'pipeline:read',
    'deployment:read',
    'config:read',
    'alert:read',
    'cmdb:read',
    'environment:read',
    'secrets:read',
    // PERM-3 mirror: the backend dba role gained dba:* / datasource:* /
    // database-devops:* in permission.go. Without them every DBA menu entry
    // guarded by those resources renders as locked out.
    'dba:*',
    'datasource:*',
    'database-devops:*',
  ],
  viewer: [
    'project:read',
    'pipeline:read',
    'deployment:read',
    'alert:read',
    'artifact:read',
    'knowledge:read',
    'ticket:read',
    'finops:read',
  ],
  auditor: ['audit_log:*', '*:read', 'ticket:read', 'approval:read'],
  oncall: [
    'chatops:use',
    'chatops:read',
    'ai:gateway:read',
    'ai:trace:read',
    'ai:agent:read',
    'ai:agent:execute',
    'ai:security:read',
    'alert:*',
    'pipeline:read',
    'deployment:read',
    'ticket:read',
    'ticket:write',
  ],
  project_admin: [
    'project:*',
    'pipeline:*',
    'deployment:*',
    'environment:read',
    'artifact:*',
    'alert:*',
    'ticket:*',
    'approval:*',
    'secrets:*',
    'oncall:*',
  ],
  project_lead: [
    'project:read',
    'project:write',
    'pipeline:*',
    'pipeline:approve',
    'deployment:read',
    'deployment:execute',
    'artifact:read',
    'artifact:write',
    'alert:read',
    'alert:acknowledge',
    'ticket:*',
    'approval:approve',
    'secrets:read',
    'oncall:*',
  ],
  project_developer: [
    'project:read',
    'pipeline:read',
    'pipeline:write',
    'pipeline:execute',
    'deployment:read',
    'artifact:read',
    'alert:read',
    'ticket:read',
    'ticket:write',
    'secrets:read',
  ],
  project_viewer: [
    'project:read',
    'pipeline:read',
    'deployment:read',
    'artifact:read',
    'alert:read',
    'ticket:read',
    'knowledge:read',
  ],
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
      const resp = await fetch(`${API_BASE_URL}/roles/permissions-map`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'x-tenant-id': localStorage.getItem('tenant_id') || '',
        },
      });
      if (resp.ok) {
        const body = await resp.json();
        if (
          body.success &&
          body.data &&
          typeof body.data === 'object' &&
          !Array.isArray(body.data)
        ) {
          // Merge, never replace: the fallback also carries roles the backend map
          // does not define (e.g. "oncall", which the backend expresses as the
          // oncall:* resource granted to sre). Replacing would lock those users
          // out of every menu entry the moment the API call succeeds.
          _permissionsCache = {
            ...ROLE_PERMISSIONS_FALLBACK,
            ...body.data,
          } as Record<string, string[]>;
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

// 同一模块在两套代码里各有两种写法（middleware_ops/middleware-ops、
// audit_log/audit-log、oci_registry/oci-registry、report_designer/report-designer）。
// 后端 permission.go 在权限比较时把 `_` 归一成 `-`，前端必须做同样的事，
// 否则 routes.tsx 里写 "middleware-ops" 的页面会对着 "middleware_ops" 的守卫锁死。
const normResource = (resource: string): string => resource.replace(/_/g, '-');

// 通配符匹配逻辑
function matchPermission(perms: string[], resource: string, action: string): boolean {
  const r = normResource(resource);
  const a = normResource(action);
  for (const raw of perms) {
    const perm = raw.replace(/_/g, '-');
    if (perm === '*:*') return true;
    if (perm === `${r}:${a}`) return true;
    if (perm === `${r}:*`) return true;
    if (perm === `*:${a}`) return true;
  }
  return false;
}

/**
 * Pure permission check function (no React hooks).
 * Checks if any of the given roles grant the specified resource:action permission.
 * Used by non-component contexts (zustand stores, utils) that cannot call usePermission().
 */
export function checkPermission(roles: string[], resource: string, action: string): boolean {
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS_FALLBACK[role] || [];
    if (matchPermission(perms, resource, action)) return true;
  }
  return false;
}

// 默认防抖时长 (ms)
const DEFAULT_DEBOUNCE_MS = 250;

/**
 * 防抖版本的 hasPermission 缓存检查
 * 短时间内重复调用相同参数时，直接返回缓存结果而非重新计算
 */
function createDebouncedPermissionChecker(
  hasPermissionBase: (resource: string, action: string) => boolean
) {
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  const cache = new Map<string, boolean>();

  return {
    hasPermissionDebounced: (resource: string, action: string): boolean => {
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
    },

    clear: () => {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      cache.clear();
    },

    invalidate: (resource: string, action: string) => {
      cache.delete(`${resource}:${action}`);
      // 同时清除同资源的通配缓存
      cache.delete(`${resource}:*`);
    },
  };
}

export function usePermission() {
  const user = useAuthStore((state) => state.user);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(
    _permissionsCache || ROLE_PERMISSIONS_FALLBACK
  );

  // 启动时异步加载后端权限映射
  useEffect(() => {
    fetchPermissionsMap().then((map) => {
      setRolePermissions(map);
    });
  }, []);

  // 当用户角色或用户 ID 变化时，清除模块级缓存，触发重新获取。
  // 这是 SEC-02 修复：之前的实现只在组件卸载时清除缓存，角色变更后所有 usePermission 调用者
  // 会继续使用过期数据直到下次页面刷新。
  const prevUserRef = useRef<string>('');
  useEffect(() => {
    const key = `${user?.roles || user?.role || 'anonymous'}|${user?.id || 'none'}`;
    if (key !== prevUserRef.current) {
      prevUserRef.current = key;
      clearPermissionsCache();
      // 角色变更时立即重新拉取后端权限映射
      fetchPermissionsMap().then((map) => {
        setRolePermissions(map);
      });
    }
  }, [user?.roles, user?.role, user?.id]);

  // 支持多角色（从 authStore 读取 roles 数组或单角色）
  const userRoles = useMemo(() => {
    const userWithRoles = user as unknown as User;
    if (
      user &&
      'roles' in userWithRoles &&
      Array.isArray(userWithRoles.roles) &&
      userWithRoles.roles.length > 0
    ) {
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

  const canView = useMemo(
    () => (resource: string) => hasPermission(resource, 'read'),
    [hasPermission]
  );
  const canEdit = useMemo(
    () => (resource: string) => hasPermission(resource, 'write'),
    [hasPermission]
  );
  const canDelete = useMemo(
    () => (resource: string) => hasPermission(resource, 'delete'),
    [hasPermission]
  );
  const canExecute = useMemo(
    () => (resource: string) => hasPermission(resource, 'execute'),
    [hasPermission]
  );
  const canApprove = useMemo(
    () => (resource: string) => hasPermission(resource, 'approve'),
    [hasPermission]
  );
  const canManage = useMemo(
    () => (resource: string) => hasPermission(resource, 'manage'),
    [hasPermission]
  );
  const canAcknowledge = useMemo(
    () => (resource: string) => hasPermission(resource, 'acknowledge'),
    [hasPermission]
  );
  const canRead = useMemo(
    () => (resource: string) => hasPermission(resource, 'read'),
    [hasPermission]
  );

  // 权限信息
  const currentRoles = userRoles;
  const hasAnyPermission = useMemo(() => currentRoles.length > 0, [currentRoles]);

  // 检查用户是否拥有管理员权限
  const isAdmin = useMemo(() => {
    return currentRoles.some((r) =>
      ['admin', 'super_admin', 'platform_admin', 'tenant_admin', 'org_admin'].includes(r)
    );
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
