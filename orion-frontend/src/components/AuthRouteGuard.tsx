/**
 * AuthRouteGuard — 路由级权限守卫组件
 *
 * 包装路由组件，根据 `requiredPermission` 检查用户权限。
 * 无权限时显示 403 页面或重定向到 Dashboard。
 *
 * 权限码格式: `<resource>:<action>` (如 `pipeline:create`、`ticket:delete`)
 *
 * @example
 * // 在 routes.tsx 中使用（推荐 — 通过 AppRoute.requiredPermission）
 * {
 *   path: '/pipelines/new',
 *   requiredPermission: { resource: 'pipeline', action: 'write' },
 *   element: <PipelineEditor />,
 * }
 *
 * @example
 * // 直接作为组件使用
 * <AuthRouteGuard requiredPermission={{ resource: 'pipeline', action: 'delete' }}>
 *   <PipelineDeletePage />
 * </AuthRouteGuard>
 *
 * @example
 * // 无权限时跳转到 403 页面
 * <AuthRouteGuard
 *   requiredPermission={{ resource: 'admin', action: 'manage' }}
 *   fallback="/403"
 * >
 *   <AdminPanel />
 * </AuthRouteGuard>
 *
 * @example
 * // 仅管理员角色可访问
 * <AuthRouteGuard requiredRoles={["admin", "platform_admin"]}>
 *   <UserManagement />
 * </AuthRouteGuard>
 */
import React, { useMemo } from 'react';
import { Result, Button, Spin } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/stores/authStore';

/** 权限配置 — resource + action 组合 */
export interface PermissionConfig {
  resource: string;
  action: string;
}

export interface AuthRouteGuardProps {
  children: React.ReactNode;
  /** 所需权限（格式 `<resource>:<action>`，如 `pipeline:create`） */
  requiredPermission?: PermissionConfig;
  /** 权限字符串形式，如 `pipeline:create`，优先于 requiredPermission */
  permissionCode?: string;
  /** 角色守卫：仅这些角色可访问 */
  requiredRoles?: string[];
  /** 无权限时显示的内容 */
  fallback?: React.ReactNode;
  /** 无权限时跳转的路径（默认 '/dashboard'） */
  redirectTo?: string;
  /** 是否显示加载状态（权限加载未完成时） */
  loading?: boolean;
  /** 资源名称，用于 403 提示消息 */
  resourceName?: string;
}

export const AuthRouteGuard: React.FC<AuthRouteGuardProps> = ({
  children,
  requiredPermission,
  permissionCode,
  requiredRoles,
  fallback,
  redirectTo = '/dashboard',
  loading: externalLoading,
  resourceName,
}) => {
  const { hasPermission } = usePermission();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();

  // 解析权限配置
  const permission = useMemo(() => {
    if (permissionCode) {
      const parts = permissionCode.split(':');
      return { resource: parts[0], action: parts.slice(1).join(':') };
    }
    return requiredPermission ?? null;
  }, [permissionCode, requiredPermission]);

  // 获取用户角色列表
  const userRoles = useMemo(() => {
    if (!user) return [];
    const u = user as unknown as Record<string, unknown>;
    if (Array.isArray(u.roles)) return u.roles as string[];
    if (u.role) return [u.role as string];
    return [];
  }, [user]);

  // 检查权限
  const hasAccess = useMemo(() => {
    // 未认证用户一律拒绝
    if (!isAuthenticated) return false;
    // 角色守卫
    if (requiredRoles && requiredRoles.length > 0) {
      return requiredRoles.some((r) => userRoles.includes(r));
    }
    // 权限守卫
    if (permission) {
      return hasPermission(permission.resource, permission.action);
    }
    // 无守卫配置，允许通过
    return true;
  }, [isAuthenticated, requiredRoles, userRoles, permission, hasPermission]);

  // 未认证用户 → 重定向到登录页
  if (!isAuthenticated) {
    return (
      <Result
        status="403"
        title="请先登录"
        subTitle="该页面需要登录访问"
        extra={
          <Button type="primary" onClick={() => navigate('/login', { state: { from: location } })}>
            去登录
          </Button>
        }
      />
    );
  }

  // 无权限 → 重定向或显示 403
  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;
    if (redirectTo) {
      return (
        <Result
          status="403"
          title="无权限访问"
          subTitle={`您没有访问「${resourceName || permission?.resource || '该页面'}」的权限`}
          extra={
            <Button type="primary" onClick={() => navigate(redirectTo)}>
              返回首页
            </Button>
          }
        />
      );
    }
    return null;
  }

  // 外部加载状态
  if (externalLoading) {
    return <Spin size="large" />;
  }

  return <>{children}</>;
};

/**
 * 路由级权限守卫包装器（用于 Router 层）
 * 此组件在 ProtectedRoute 之后调用，专门处理权限检查逻辑
 * 返回一个包装元素，在权限不足时重定向
 */
export const AuthRouteElement: React.FC<{
  children: React.ReactNode;
  permissionCode?: string;
  requiredPermission?: PermissionConfig;
  redirectTo?: string;
}> = ({ children, permissionCode, requiredPermission, redirectTo = '/dashboard' }) => {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const permission = useMemo(() => {
    if (permissionCode) {
      const parts = permissionCode.split(':');
      return { resource: parts[0], action: parts.slice(1).join(':') };
    }
    return requiredPermission ?? null;
  }, [permissionCode, requiredPermission]);

  const hasAccess = useMemo(() => {
    if (permission) {
      return hasPermission(permission.resource, permission.action);
    }
    return true;
  }, [permission, hasPermission]);

  if (isAuthenticated && user && !hasAccess && redirectTo) {
    return (
      <Result
        status="403"
        title="无权限访问"
        subTitle={`您没有访问「${permission?.resource || '该页面'}」的权限`}
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard', { replace: true })}>
            返回首页
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};
