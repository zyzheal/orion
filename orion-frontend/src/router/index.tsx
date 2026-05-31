import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { routes, type AppRoute } from './routes';
import { Layout } from '@/components/Layout';
import { Loading } from '@/components/Loading';
import { useAuthStore } from '@/stores/authStore';
import { usePermission } from '@/hooks/usePermission';
import { getCurrentUser } from '@/api/auth';
import { message } from 'antd';

const AUTH_VERIFY_TIMEOUT = 6000;

const checkRoleAccess = (
  userRole: string | undefined,
  _requiredRole: string | string[] | undefined
): boolean => {
  // 已废弃：所有路由已迁移到 requiredPermission
  if (!userRole) return false;
  return ['admin', 'platform_admin', 'super_admin'].includes(userRole);
};

async function verifyTokenWithTimeout() {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('认证请求超时')), AUTH_VERIFY_TIMEOUT);
  });
  return Promise.race([getCurrentUser(), timeout]);
}

const ProtectedRoute: React.FC<{ children: React.ReactNode; route: AppRoute }> = ({
  children,
  route,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { hasPermission } = usePermission();
  const [status, setStatus] = useState<'checking' | 'authorized' | 'done'>('checking');

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (isAuthenticated && user) {
        if (!cancelled) {
          // 检查角色权限（向后兼容）
          if ((route as any).requiredRole && !checkRoleAccess(user.role, (route as any).requiredRole)) {
            message.error('您没有权限访问此页面');
            navigate('/dashboard', { replace: true });
            return;
          }
          // 检查细粒度权限
          if (route.requiredPermission && !hasPermission(route.requiredPermission.resource, route.requiredPermission.action)) {
            message.error('您没有权限访问此页面');
            navigate('/dashboard', { replace: true });
            return;
          }
          setStatus('authorized');
        }
        return;
      }

      const token = localStorage.getItem('access_token');
      if (!token) {
        if (!cancelled) {
          navigate('/login', { state: { from: location }, replace: true });
          setStatus('done');
        }
        return;
      }

      try {
        const response = await verifyTokenWithTimeout();
        if (!cancelled) {
          useAuthStore.getState().setUser({
            id: response.id,
            username: response.username,
            email: response.email,
            role: response.role,
            roles: (response as { roles?: unknown })?.roles as string[] | undefined,  // 多角色支持
            avatar: response.avatar,
          });
          useAuthStore.getState().setAuthenticated(true);

          // 检查角色权限（向后兼容）
          if ((route as any).requiredRole && !checkRoleAccess(response.role, (route as any).requiredRole)) {
            message.error('您没有权限访问此页面');
            navigate('/dashboard', { replace: true });
            return;
          }
          // 检查细粒度权限
          if (route.requiredPermission && !hasPermission(route.requiredPermission.resource, route.requiredPermission.action)) {
            message.error('您没有权限访问此页面');
            navigate('/dashboard', { replace: true });
            return;
          }
          setStatus('authorized');
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('token_expires_at');
          useAuthStore.getState().logout();
          navigate('/login', { state: { from: location }, replace: true });
          setStatus('done');
        }
      }
    }

    verify();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'checking') {
    return <Loading fullscreen />;
  }

  if (status === 'authorized') {
    return <>{children}</>;
  }

  return null;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (isAuthenticated) {
        if (!cancelled) {
          const from = location.state?.from?.pathname || '/dashboard';
          navigate(from, { replace: true });
        }
        return;
      }

      const token = localStorage.getItem('access_token');
      if (!token) {
        return; // 无 token，直接显示登录页
      }

      try {
        const response = await verifyTokenWithTimeout();
        if (!cancelled) {
          useAuthStore.getState().setUser({
            id: response.id,
            username: response.username,
            email: response.email,
            role: response.role,
            roles: (response as { roles?: unknown })?.roles as string[] | undefined,  // 多角色支持
            avatar: response.avatar,
          });
          useAuthStore.getState().setAuthenticated(true);
          const from = location.state?.from?.pathname || '/dashboard';
          navigate(from, { replace: true });
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('token_expires_at');
          useAuthStore.getState().logout();
        }
      }
    }

    check();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
};

const renderElement = (el: any) => {
  if (React.isValidElement(el)) {
    return el;
  }
  if (typeof el === 'function' || (el && typeof el === 'object' && '$$typeof' in el)) {
    const Component = el;
    return <Component />;
  }
  return el;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {routes.map((route) => {
        // 支持 React.lazy 组件和普通 ReactNode
        const element = (
          <React.Suspense fallback={<Loading fullscreen />}>
            {renderElement(route.element)}
          </React.Suspense>
        );

        // 处理有 children 的路由（嵌套路由）
        if (route.children && route.children.length > 0) {
          const childRoutes = route.children.map((child) => {
            // 处理 index 路由
            if (child.index) {
              const childElement = (
                <React.Suspense fallback={<Loading />}>
                  {renderElement(child.element)}
                </React.Suspense>
              );
              return <Route key="index" index element={childElement} />;
            }

            const childElement = (
              <React.Suspense fallback={<Loading />}>
                {renderElement(child.element)}
              </React.Suspense>
            );

            if (child.protected === false) {
              return <Route key={child.path} path={child.path} element={childElement} />;
            }

            return (
              <Route
                key={child.path}
                path={child.path}
                element={
                  <ProtectedRoute route={child}>
                    {childElement}
                  </ProtectedRoute>
                }
              />
            );
          });

          if (route.protected === false) {
            return (
              <Route key={route.path} path={route.path} element={element}>
                {childRoutes}
              </Route>
            );
          }

          return (
            <Route
              key={route.path}
              path={route.path}
              element={
                <ProtectedRoute route={route}>
                  <Layout>{element}</Layout>
                </ProtectedRoute>
              }
            >
              {childRoutes}
            </Route>
          );
        }

        // 处理没有 children 的路由
        if (route.protected === false) {
          if (route.path === '/login') {
            return (
              <Route key={route.path} path={route.path} element={<PublicRoute>{element}</PublicRoute>} />
            );
          }
          return <Route key={route.path} path={route.path} element={element} />;
        }

        // hideLayout: true 的路由（如子应用）不使用主 Layout，直接渲染
        if (route.hideLayout) {
          return (
            <Route
              key={route.path}
              path={route.path}
              element={
                <ProtectedRoute route={route}>
                  {element}
                </ProtectedRoute>
              }
            />
          );
        }

        return (
          <Route
            key={route.path}
            path={route.path}
            element={
              <ProtectedRoute route={route}>
                <Layout>{element}</Layout>
              </ProtectedRoute>
            }
          />
        );
      })}
    </Routes>
  );
};

export default function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}
