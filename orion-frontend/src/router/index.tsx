import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { routes } from './routes';
import { Layout } from '@/components/Layout';
import { Loading } from '@/components/Loading';
import { useAuthStore } from '@/stores/authStore';

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

// 路由守卫组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated: storeAuthenticated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const checkAuth = useCallback(() => {
    const auth = checkIsAuthenticated();
    if (!auth) {
      navigate('/login', { state: { from: location }, replace: true });
    } else {
      setAuthorized(true);
    }
    setIsChecking(false);
  }, [navigate, location]);

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
    return null; // 会跳转到登录页
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
              <ProtectedRoute>
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
