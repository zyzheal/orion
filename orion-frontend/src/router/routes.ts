import React from 'react';
import type { FC, ReactNode } from 'react';

interface PageComponentProps {
  children?: ReactNode;
}

type PageComponent = FC<PageComponentProps>;

export interface AppRoute {
  path: string;
  element: React.LazyExoticComponent<PageComponent>;
  protected?: boolean;
  children?: AppRoute[];
}

// 路由配置
export const routes: AppRoute[] = [
  // 根路径重定向
  {
    path: '/',
    element: React.lazy(() => import('@/pages/RootRedirect')),
    protected: false,
  },
  // 公开路由
  {
    path: '/login',
    element: React.lazy(() => import('@/pages/Login')),
    protected: false,
  },
  // 子系统导航页
  {
    path: '/subapps',
    element: React.lazy(() => import('@/pages/SubApps')),
    protected: true,
  },
  // 受保护的路由
  {
    path: '/dashboard',
    element: React.lazy(() => import('@/pages/DashboardNew')),
    protected: true,
  },
  {
    path: '/console',
    element: React.lazy(() => import('@/pages/Console')),
    protected: true,
  },
  {
    path: '/console/plugins',
    element: React.lazy(() => import('@/pages/Console')),
    protected: true,
  },
  {
    path: '/console/settings',
    element: React.lazy(() => import('@/pages/Console')),
    protected: true,
  },
  {
    path: '/console/users',
    element: React.lazy(() => import('@/pages/Console')),
    protected: true,
  },
  {
    path: '/projects',
    element: React.lazy(() => import('@/pages/Dashboard')),
    protected: true,
  },
  {
    path: '/settings',
    element: React.lazy(() => import('@/pages/Dashboard')),
    protected: true,
  },
  // 微前端子应用路由
  {
    path: '/dba/*',
    element: React.lazy(() => import('@/components/SubAppRoute')),
    protected: true,
  },
  {
    path: '/knowledge/*',
    element: React.lazy(() => import('@/components/SubAppRoute')),
    protected: true,
  },
  {
    path: '/visor/*',
    element: React.lazy(() => import('@/components/SubAppRoute')),
    protected: true,
  },
  // 404 页面
  {
    path: '*',
    element: React.lazy(() => import('@/pages/NotFound')),
    protected: false,
  },
];

// 公开路由路径
export const publicPaths = ['/login'];
