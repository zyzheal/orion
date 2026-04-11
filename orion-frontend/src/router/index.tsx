import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { routes } from './routes';
import { Layout } from '@/components/Layout';
import { Loading } from '@/components/Loading';

// 路由守卫组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// 已登录用户访问登录页时重定向
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('access_token');
  const location = useLocation();

  if (token) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
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
