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
  // 公共路由
  {
    path: '/login',
    element: React.lazy(() => import('@/pages/Login')),
    protected: false,
  },
  // 受保护的路由
  {
    path: '/dashboard',
    element: React.lazy(() => import('@/pages/Dashboard')),
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
  // 404 页面
  {
    path: '*',
    element: React.lazy(() => import('@/pages/NotFound')),
    protected: false,
  },
];

// 公开路由路径
export const publicPaths = ['/login'];
