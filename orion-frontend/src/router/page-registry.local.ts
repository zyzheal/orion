/**
 * Page Registry - Pilot Configuration (Phase 4)
 *
 * Pilot scope: Core navigation routes only.
 * This file serves as the initialization source for the page_registry database table.
 * Routes defined here will be loaded into the database on first boot via migration 458.
 *
 * Pattern: Follows subapp local config pattern.
 * This file is NOT used at runtime — it documents the canonical configuration.
 * Runtime routing is handled by route-generator.tsx reading from the database.
 */

import type { PageEntry } from '../router/page-registry-types';

/**
 * Pilot page registry configuration
 *
 * Phase 4 pilot includes:
 * - Public pages (Root Redirect, Login)
 * - Main application routes (SubApps, Dashboard, Console)
 * - Sub-application routes (DBA, Knowledge, Visor) — microApp=true
 * - Delivery module (Pipeline List) — representative of CRUD module
 * - AI module (AI Dashboard) — representative of module with permissions
 *
 * Excluded from pilot (to be added in later phases):
 * - Canary module (/canary/*)
 * - Compliance module (/compliance/*)
 * - Report Designer module (/reports/*)
 * - Observability module (/monitor/*)
 * - Detail/child pages (pipelines/:id, etc.)
 */

export const pageRegistryLocal: PageEntry[] = [
  // ========== Public Pages ==========
  {
    path: '/',
    element: '@/pages/RootRedirect',
    protected: false,
    hideLayout: true,
    sortOrder: 0,
    status: 'enabled',
    title: 'Root Redirect',
  },
  {
    path: '/login',
    element: '@/pages/Login',
    protected: false,
    hideLayout: true,
    sortOrder: 1,
    status: 'enabled',
    title: 'Login',
  },

  // ========== Main Application Routes ==========
  {
    path: '/subapps',
    element: '@/pages/SubApps',
    protected: true,
    hideLayout: false,
    menuKey: 'subapp',
    menuLabel: '子应用管理',
    menuIcon: 'AppstoreOutlined',
    sortOrder: 2,
    status: 'enabled',
    title: 'Sub Apps',
  },
  {
    path: '/dashboard',
    element: '@/pages/DashboardNew',
    protected: true,
    hideLayout: false,
    menuKey: 'dashboard',
    menuLabel: '总览看板',
    menuIcon: 'DashboardOutlined',
    sortOrder: 3,
    status: 'enabled',
    title: 'Dashboard',
  },
  {
    path: '/console',
    element: '@/pages/Console',
    protected: true,
    permission: { resource: '*', action: 'manage' },
    hideLayout: false,
    menuKey: 'console',
    menuLabel: '控制台',
    menuIcon: 'SettingOutlined',
    sortOrder: 4,
    status: 'enabled',
    title: 'Console',
  },

  // ========== Sub-Application Routes (Micro-Frontend) ==========
  {
    path: '/dba',
    element: '@/components/SubAppRouteDynamic',
    protected: true,
    hideLayout: true,
    microApp: true,
    subAppKey: 'dba',
    menuKey: 'dba',
    menuLabel: '数据库管理',
    menuIcon: 'DatabaseOutlined',
    sortOrder: 5,
    status: 'enabled',
    title: 'DBA',
  },
  {
    path: '/knowledge',
    element: '@/components/SubAppRouteDynamic',
    protected: true,
    hideLayout: true,
    microApp: true,
    subAppKey: 'knowledge',
    menuKey: 'knowledge',
    menuLabel: '知识库',
    menuIcon: 'ReadOutlined',
    sortOrder: 6,
    status: 'enabled',
    title: 'Knowledge',
  },
  {
    path: '/visor',
    element: '@/components/SubAppRouteDynamic',
    protected: true,
    hideLayout: true,
    microApp: true,
    subAppKey: 'visor',
    menuKey: 'visor',
    menuLabel: '监控中心',
    menuIcon: 'RadarChartOutlined',
    sortOrder: 7,
    status: 'enabled',
    title: 'Visor',
  },

  // ========== Delivery Module (Pilot) ==========
  {
    path: '/pipelines',
    element: '@/pages/pipeline-svc/PipelineList',
    protected: true,
    permission: { resource: 'pipeline', action: 'read' },
    hideLayout: false,
    menuKey: 'delivery',
    menuLabel: '流水线',
    menuIcon: 'CloudUploadOutlined',
    sortOrder: 10,
    status: 'enabled',
    title: 'Pipelines',
  },

  // ========== AI Module (Pilot) ==========
  {
    path: '/ai',
    element: '@/pages/ai-svc/AIDashboard',
    protected: true,
    hideLayout: false,
    menuKey: 'ai',
    menuLabel: 'AI 平台',
    menuIcon: 'RobotOutlined',
    sortOrder: 60,
    status: 'enabled',
    title: 'AI Platform',
  },

  // ========== 404 ==========
  {
    path: '*',
    element: '@/pages/NotFound',
    protected: false,
    hideLayout: true,
    sortOrder: 999,
    status: 'enabled',
    title: 'Not Found',
  },
];

export default pageRegistryLocal;
