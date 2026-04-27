import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { routes, type AppRoute } from './routes';
import { Layout } from '@/components/Layout';
import { Loading } from '@/components/Loading';
import { useAuthStore } from '@/stores/authStore';
import { message } from 'antd';

// 检查用户是否已登录
const checkIsAuthenticated = (): boolean => {
  const token = localStorage.getItem('access_token');
  if (!token) return false;

  // 检查 token 是否过期
  const expiresAt = localStorage.getItem('token_expires_at');
  if (expiresAt) {
    const now = new Date().getTime();
    if (now > parseInt(expiresAt, 10)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_expires_at');
      return false;
    }
  }

  return true;
};

// 检查用户角色是否满足路由要求
const checkRoleAccess = (userRole: string | undefined, requiredRole: string | string[] | undefined): boolean => {
  if (!requiredRole) return true; // 无角色限制
  if (!userRole) return false;

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(userRole);
};

// 路由守卫组件
const ProtectedRoute: React.FC<{ children: React.ReactNode; route: AppRoute }> = ({ children, route }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = useAuthStore(state => state.user?.role);
  const [isChecking, setIsChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const checkAuth = useCallback(() => {
    const auth = checkIsAuthenticated();
    if (!auth) {
      navigate('/login', { state: { from: location }, replace: true });
      return;
    }

    // 检查角色权限
    if (!checkRoleAccess(userRole, route.requiredRole)) {
      message.error('您没有权限访问此页面');
      navigate('/dashboard', { replace: true });
      return;
    }

    setAuthorized(true);
    setIsChecking(false);
  }, [navigate, location.pathname, userRole, route.requiredRole]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 监听认证状态变化
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe(
      (state) => state.isAuthenticated,
      (isAuth) => {
        if (isAuth && !authorized) {
          setAuthorized(true);
          setIsChecking(false);
        }
      }
    );
    return unsubscribe;
  }, [authorized]);

  if (isChecking) {
    return <Loading fullscreen />;
  }

  if (!authorized) {
    return null; // 会跳转到登录页或仪表盘
  }

  return <>{children}</>;
};

// 已登录用户访问登录页时重定向
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const auth = checkIsAuthenticated();
    if (auth) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } else {
      setIsChecking(false);
    }
  }, [navigate, location]);

  if (isChecking) {
    return <Loading fullscreen />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {routes.map((route) => {
        const element = (
          <React.Suspense fallback={<Loading fullscreen />}>
            <route.element />
          </React.Suspense>
        );

        if (route.protected === false) {
          // 公开路由
          if (route.path === '/login') {
            return (
              <Route
                key={route.path}
                path={route.path}
                element={<PublicRoute>{element}</PublicRoute>}
              />
            );
          }
          return <Route key={route.path} path={route.path} element={element} />;
        }

        // 受保护的路由
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

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};

export default AppRouter;
