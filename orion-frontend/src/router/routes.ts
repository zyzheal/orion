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
    element: React.lazy(() => import('@/pages/PluginManagement')),
    protected: true,
  },
  {
    path: '/console/plugins/:id',
    element: React.lazy(() => import('@/pages/PluginManagement')),
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
  // Core Pages (TASK-905)
  {
    path: '/dashboard-core',
    element: React.lazy(() => import('@/pages/DashboardCore')),
    protected: true,
  },
  {
    path: '/pipelines',
    element: React.lazy(() => import('@/pages/PipelineList')),
    protected: true,
  },
  {
    path: '/pipelines/:id',
    element: React.lazy(() => import('@/pages/PipelineDetail')),
    protected: true,
  },
  {
    path: '/pipelines/new',
    element: React.lazy(() => import('@/pages/PipelineEditor')),
    protected: true,
  },
  {
    path: '/pipelines/edit/:id',
    element: React.lazy(() => import('@/pages/PipelineEditor')),
    protected: true,
  },
  {
    path: '/deployments',
    element: React.lazy(() => import('@/pages/DeploymentList')),
    protected: true,
  },
  {
    path: '/deployments/:id',
    element: React.lazy(() => import('@/pages/DeploymentDetail')),
    protected: true,
  },
  {
    path: '/alerts',
    element: React.lazy(() => import('@/pages/AlertList')),
    protected: true,
  },
  // AI Gateway
  {
    path: '/ai-gateway',
    element: React.lazy(() => import('@/pages/AIGateway')),
    protected: true,
  },
  // Audit Log
  {
    path: '/audit-log',
    element: React.lazy(() => import('@/pages/AuditLog')),
    protected: true,
  },
  // Tenant Management
  {
    path: '/tenant-management',
    element: React.lazy(() => import('@/pages/TenantManagement')),
    protected: true,
  },
  // Config Management
  {
    path: '/config-management',
    element: React.lazy(() => import('@/pages/ConfigManagement')),
    protected: true,
  },
  // Risk Dashboard
  {
    path: '/risk-dashboard',
    element: React.lazy(() => import('@/pages/RiskDashboard')),
    protected: true,
  },
  // Efficiency Dashboard
  {
    path: '/efficiency-dashboard',
    element: React.lazy(() => import('@/pages/EfficiencyDashboard')),
    protected: true,
  },
  // Notification Center
  {
    path: '/notifications',
    element: React.lazy(() => import('@/pages/NotificationCenter')),
    protected: true,
  },
  // Ticketing Routes
  {
    path: '/tickets',
    element: React.lazy(() => import('@/pages/TicketList')),
    protected: true,
  },
  {
    path: '/tickets/:id',
    element: React.lazy(() => import('@/pages/TicketDetail')),
    protected: true,
  },
  // BI Dashboard Routes
  {
    path: '/dashboard/executive',
    element: React.lazy(() => import('@/pages/ExecutiveDashboard')),
    protected: true,
  },
  {
    path: '/dashboard/manager',
    element: React.lazy(() => import('@/pages/ManagerDashboard')),
    protected: true,
  },
  {
    path: '/dashboard/engineer/:engineerId?',
    element: React.lazy(() => import('@/pages/EngineerDashboard')),
    protected: true,
  },
  // FinOps
  {
    path: '/finops',
    element: React.lazy(() => import('@/pages/FinOpsDashboard')),
    protected: true,
  },
  // ==================== New Modules (Frontend Gap Implementation) ====================

  // Build Environment Management
  {
    path: '/console/build-env',
    element: React.lazy(() => import('@/pages/BuildEnv')),
    protected: true,
    children: [
      { path: '/console/build-env/images', element: React.lazy(() => import('@/pages/BuildEnv/BuilderImageList')), protected: true },
      { path: '/console/build-env/cache', element: React.lazy(() => import('@/pages/BuildEnv/BuildCachePage')), protected: true },
      { path: '/console/build-env/pods', element: React.lazy(() => import('@/pages/BuildEnv/BuildPodList')), protected: true },
      { path: '/console/build-env/pods/:id', element: React.lazy(() => import('@/pages/BuildEnv/BuildPodDetail')), protected: true },
      { path: '/console/build-env/logs', element: React.lazy(() => import('@/pages/BuildEnv/BuildLogList')), protected: true },
      { path: '/console/build-env/logs/:id', element: React.lazy(() => import('@/pages/BuildEnv/BuildLogViewer')), protected: true },
      { path: '/console/build-env/artifacts', element: React.lazy(() => import('@/pages/BuildEnv/ArtifactList')), protected: true },
    ],
  },
  // Code Management
  {
    path: '/console/code-mgmt',
    element: React.lazy(() => import('@/pages/CodeMgmt')),
    protected: true,
    children: [
      { path: '/console/code-mgmt/repos', element: React.lazy(() => import('@/pages/CodeMgmt/RepoList')), protected: true },
      { path: '/console/code-mgmt/repos/:adapterId/:repoId', element: React.lazy(() => import('@/pages/CodeMgmt/RepoDetail')), protected: true },
      { path: '/console/code-mgmt/policies', element: React.lazy(() => import('@/pages/CodeMgmt/BranchPolicyList')), protected: true },
      { path: '/console/code-mgmt/ownership', element: React.lazy(() => import('@/pages/CodeMgmt/CodeOwnersPage')), protected: true },
      { path: '/console/code-mgmt/webhooks', element: React.lazy(() => import('@/pages/CodeMgmt/WebhookLog')), protected: true },
    ],
  },
  // AI Review
  {
    path: '/console/ai-review',
    element: React.lazy(() => import('@/pages/AIReview')),
    protected: true,
    children: [
      { path: '/console/ai-review/dashboard', element: React.lazy(() => import('@/pages/AIReview/Dashboard')), protected: true },
      { path: '/console/ai-review/history', element: React.lazy(() => import('@/pages/AIReview/History')), protected: true },
      { path: '/console/ai-review/history/:id', element: React.lazy(() => import('@/pages/AIReview/ReviewDetail')), protected: true },
      { path: '/console/ai-review/rules', element: React.lazy(() => import('@/pages/AIReview/Rules')), protected: true },
      { path: '/console/ai-review/config', element: React.lazy(() => import('@/pages/AIReview/Config')), protected: true },
    ],
  },
  // Self-Healing
  {
    path: '/console/self-healing',
    element: React.lazy(() => import('@/pages/SelfHealing')),
    protected: true,
    children: [
      { path: '/console/self-healing/incidents', element: React.lazy(() => import('@/pages/SelfHealing/IncidentList')), protected: true },
      { path: '/console/self-healing/incidents/:id', element: React.lazy(() => import('@/pages/SelfHealing/IncidentDetail')), protected: true },
      { path: '/console/self-healing/history', element: React.lazy(() => import('@/pages/SelfHealing/History')), protected: true },
      { path: '/console/self-healing/strategies', element: React.lazy(() => import('@/pages/SelfHealing/StrategyList')), protected: true },
      { path: '/console/self-healing/approvals', element: React.lazy(() => import('@/pages/SelfHealing/ApprovalQueue')), protected: true },
      { path: '/console/self-healing/effectiveness', element: React.lazy(() => import('@/pages/SelfHealing/EffectivenessDashboard')), protected: true },
    ],
  },
  // Monitoring
  {
    path: '/console/monitoring',
    element: React.lazy(() => import('@/pages/Monitoring')),
    protected: true,
    children: [
      { path: '/console/monitoring/dashboard', element: React.lazy(() => import('@/pages/Monitoring/Dashboard')), protected: true },
      { path: '/console/monitoring/metrics', element: React.lazy(() => import('@/pages/Monitoring/Metrics')), protected: true },
      { path: '/console/monitoring/alerts', element: React.lazy(() => import('@/pages/Monitoring/Alerts')), protected: true },
      { path: '/console/monitoring/rules', element: React.lazy(() => import('@/pages/Monitoring/Rules')), protected: true },
      { path: '/console/monitoring/channels', element: React.lazy(() => import('@/pages/Monitoring/Channels')), protected: true },
    ],
  },
  // Diagnostic
  {
    path: '/console/diagnostic',
    element: React.lazy(() => import('@/pages/Diagnostic')),
    protected: true,
    children: [
      { path: '/console/diagnostic/sessions', element: React.lazy(() => import('@/pages/Diagnostic/Sessions')), protected: true },
      { path: '/console/diagnostic/sessions/:id', element: React.lazy(() => import('@/pages/Diagnostic/SessionDetail')), protected: true },
      { path: '/console/diagnostic/reports', element: React.lazy(() => import('@/pages/Diagnostic/Reports')), protected: true },
      { path: '/console/diagnostic/knowledge', element: React.lazy(() => import('@/pages/Diagnostic/KnowledgeBase')), protected: true },
      { path: '/console/diagnostic/trigger', element: React.lazy(() => import('@/pages/Diagnostic/Trigger')), protected: true },
    ],
  },
  // AI Agent Orchestration
  {
    path: '/agents',
    element: React.lazy(() => import('@/pages/AgentDashboard')),
    protected: true,
  },
  {
    path: '/agent-runs/:id',
    element: React.lazy(() => import('@/pages/AgentRunDetail')),
    protected: true,
  },
  // Ephemeral Dev Environments
  {
    path: '/ephemeral-envs',
    element: React.lazy(() => import('@/pages/EphemeralEnvList')),
    protected: true,
  },
  {
    path: '/ephemeral-envs/:id',
    element: React.lazy(() => import('@/pages/EphemeralEnvDetail')),
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
