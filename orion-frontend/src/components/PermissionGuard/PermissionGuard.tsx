/**
 * PermissionGuard — renders children only when the user has the required permission.
 *
 * Usage:
 *   <PermissionGuard resource="secrets" action="read">
 *     <SecretsManagement />
 *   </PermissionGuard>
 *
 *   // Or with requiredRoles for role-based access:
 *   <PermissionGuard requiredRoles={["admin", "platform_admin"]}>
 *     <UserManagement />
 *   </PermissionGuard>
 *
 *   // Or using canEdit shorthand:
 *   <PermissionGuard resource="pipeline" action="write">
 *     <Button onClick={handleDelete}>Delete</Button>
 *   </PermissionGuard>
 *
 * When the user lacks permission, it shows a 403-style fallback instead of crashing.
 */
import React, { useMemo } from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  children: React.ReactNode;
  /** RBAC resource key, e.g. "secrets", "pipeline", "user" */
  resource?: string;
  /** RBAC action, e.g. "read", "write", "delete", "admin" */
  action?: string;
  /** Role-based fallback: only these roles can see children */
  requiredRoles?: string[];
  /** Page-level guard: renders a full-page 403, not inline */
  pageLevel?: boolean;
  /** Custom fallback when permission denied (replaces default Result) */
  fallback?: React.ReactNode;
  /** Resource name used in fallback message */
  resourceName?: string;
}

export const PermissionGuard: React.FC<Props> = ({
  children,
  resource,
  action,
  requiredRoles,
  pageLevel = false,
  fallback,
  resourceName,
}) => {
  const { hasPermission } = usePermission();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const userRoles = useMemo(() => {
    if (!user) return [];
    const u = user as unknown as Record<string, unknown>;
    if (Array.isArray(u.roles)) return u.roles;
    if (u.role) return [u.role];
    return [];
  }, [user]);

  const hasAccess = useMemo(() => {
    // Resource-based check
    if (resource && action) {
      return hasPermission(resource, action);
    }
    // Role-based check
    if (requiredRoles && requiredRoles.length > 0) {
      return requiredRoles.some((role) => userRoles.includes(role));
    }
    // No guard specified — allow access
    return true;
  }, [hasPermission, resource, action, requiredRoles, userRoles]);

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;
    if (pageLevel) {
      return (
        <div
          style={{
            padding: 48,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
          }}
        >
          <Result
            status="403"
            title="无权限访问"
            subTitle={`您没有访问「${resourceName || resource || '该页面'}」的权限`}
            extra={
              <Button type="primary" onClick={() => navigate(-1)}>
                返回
              </Button>
            }
          />
        </div>
      );
    }
    // Inline guard: render nothing
    return null;
  }

  return <>{children}</>;
};
