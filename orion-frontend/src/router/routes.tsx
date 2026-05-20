/* @refresh reload */
import React, { lazy, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

// 使用 lazy 替代 React.lazy
const lazyImport = (path: string) => lazy(() => import(/* @vite-ignore */ path));

// 重定向组件（使用 react-router-dom Navigate）
const RedirectTo: React.FC<{ to: string }> = ({ to }) => <Navigate to={to} replace />;

export interface AppRoute {
  path?: string;
  index?: boolean;
  element: ReactNode | ReturnType<typeof lazy>;
  protected?: boolean;
  /** Required permission to access this route. Format: { resource: 'project', action: 'read' } */
  requiredPermission?: { resource: string; action: string };
  /** Hide main layout (sidebar + header) for standalone pages like sub-apps */
  hideLayout?: boolean;
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
    requiredPermission: { resource: '*', action: 'manage' },
  },
  {
    path: '/console/plugins',
    element: React.lazy(() => import('@/pages/PluginManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  {
    path: '/console/plugins/:id',
    element: React.lazy(() => import('@/pages/PluginManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  {
    path: '/console/settings',
    element: React.lazy(() => import('@/pages/feature-flags/FeatureFlagsPage')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  {
    path: '/console/users',
    element: React.lazy(() => import('@/pages/UserManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Workflow Trigger 管理
  {
    path: '/console/triggers',
    element: React.lazy(() => import('@/pages/WorkflowTriggers')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // SubApp 管理（子应用配置页面）
  {
    path: '/console/subapps',
    element: React.lazy(() => import('@/pages/SubAppManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Capability 管理
  {
    path: '/console/capabilities',
    element: React.lazy(() => import('@/pages/Capability')),
    protected: true,
    requiredPermission: { resource: 'capability', action: 'view' },
  },
  {
    path: '/projects',
    element: React.lazy(() => import('@/pages/Projects')),
    protected: true,
  },
  // 微前端子应用路由 - hideLayout 隐藏主布局，全屏展示
  {
    path: '/dba/*',
    element: React.lazy(() => import('@/components/SubAppRoute')),
    protected: true,
    hideLayout: true,
  },
  // Knowledge Base (M28) - 统一指向PandaWiki知识空间
  {
    path: '/knowledge',
    element: <RedirectTo to="/knowledge/spaces" />,
    protected: true,
  },
  {
    path: '/knowledge/*',
    element: React.lazy(() => import('@/components/SubAppRoute')),
    protected: true,
    hideLayout: true,
  },
  {
    path: '/visor/*',
    element: React.lazy(() => import('@/components/SubAppRoute')),
    protected: true,
    hideLayout: true,
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
    path: '/pipelines/:pipelineId/versions',
    element: React.lazy(() => import('@/pages/PipelineVersionHistory')),
    protected: true,
  },
  {
    path: '/pipeline-runs',
    element: React.lazy(() => import('@/pages/PipelineRunList')),
    protected: true,
  },
  {
    path: '/pipelines/:pipelineId/runs',
    element: React.lazy(() => import('@/pages/PipelineRunList')),
    protected: true,
  },
  {
    path: '/pipelines/:id/runs/:runId',
    element: React.lazy(() => import('@/pages/PipelineRunLive')),
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
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Tenant Management
  {
    path: '/tenant-management',
    element: React.lazy(() => import('@/pages/TenantManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
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
  // Personal Workbench (统一工作台)
  // BI Dashboard Routes (统一入口)
  {
    path: '/bi',
    element: <RedirectTo to="/dashboard/executive" />,
    protected: true,
  },
  {
    path: '/bi/*',
    element: <RedirectTo to="/dashboard/executive" />,
    protected: true,
  },
  {
    path: '/workbench',
    element: React.lazy(() => import('@/pages/Workbench')),
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
  // Pipeline Budget
  {
    path: '/console/pipeline-budget',
    element: React.lazy(() => import('@/pages/PipelineBudget')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // SBOM Attestation
  {
    path: '/sbom',
    element: React.lazy(() => import('@/pages/SbomDashboard')),
    protected: true,
  },
  {
    path: '/sbom/:id',
    element: React.lazy(() => import('@/pages/SbomDetail')),
    protected: true,
  },
  // Quality Gates
  {
    path: '/console/quality-gates',
    element: React.lazy(() => import('@/pages/quality-gate/QualityGatePage')),
    protected: true,
  },
  // Policy Management
  {
    path: '/policies',
    element: React.lazy(() => import('@/pages/PolicyManagement')),
    protected: true,
  },
  // Change Intelligence
  {
    path: '/change-intelligence',
    element: React.lazy(() => import('@/pages/ChangeIntelligence')),
    protected: true,
  },
  // Canary Analysis
  {
    path: '/canary-analysis',
    element: React.lazy(() => import('@/pages/CanaryAnalysis')),
    protected: true,
  },
  // ==================== New Modules (Frontend Gap Implementation) ====================

  // Skill Management (M12)
  {
    path: '/skills',
    element: React.lazy(() => import('@/pages/SkillManagement')),
    protected: true,
    children: [
      // 默认重定向到 marketplace
      {
        index: true,
        element: React.createElement(Navigate, { to: '/skills/marketplace', replace: true }),
      },
      {
        path: '/skills/marketplace',
        element: React.lazy(() => import('@/pages/SkillManagement/Marketplace')),
        protected: true,
      },
      {
        path: '/skills/my',
        element: React.lazy(() => import('@/pages/SkillManagement/MySkills')),
        protected: true,
      },
      {
        path: '/skills/submit',
        element: React.lazy(() => import('@/pages/SkillManagement/SkillSubmission')),
        protected: true,
      },
      // Instance & Execution management
      {
        path: '/skills/:id/instances',
        element: React.lazy(() => import('@/pages/SkillManagement/SkillInstances')),
        protected: true,
      },
      {
        path: '/skills/:id/executions',
        element: React.lazy(() => import('@/pages/SkillManagement/SkillExecutions')),
        protected: true,
      },
      // Skill Admin (review & audit)
      {
        path: '/skills/admin/pending',
        element: React.lazy(() => import('@/pages/SkillManagement/PendingReviews')),
        protected: true,
      },
      {
        path: '/skills/admin/history',
        element: React.lazy(() => import('@/pages/SkillManagement/AuditHistory')),
        protected: true,
      },
    ],
  },
  // IaC Management (M20)
  {
    path: '/console/iac',
    element: React.lazy(() => import('@/pages/IacManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
    children: [
      // 默认重定向到 workspaces
      {
        index: true,
        element: React.createElement(Navigate, { to: '/console/iac/workspaces', replace: true }),
      },
      {
        path: '/console/iac/workspaces',
        element: React.lazy(() => import('@/pages/IacManagement/WorkspaceList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/iac/plans',
        element: React.lazy(() => import('@/pages/IacManagement/PlanViewer')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/iac/state',
        element: React.lazy(() => import('@/pages/IacManagement/StateBrowser')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/iac/modules',
        element: React.lazy(() => import('@/pages/IacManagement/ModuleRegistry')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
    ],
  },
  // Manual Confirmation (M34)
  {
    path: '/console/confirmations',
    element: React.lazy(() => import('@/pages/ConfirmationWorkbench')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
    children: [
      // 默认重定向到 pending
      {
        index: true,
        element: React.createElement(Navigate, { to: '/console/confirmations/pending', replace: true }),
      },
      {
        path: '/console/confirmations/pending',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/PendingList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/confirmations/:id',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/ConfirmationDetail')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/confirmations/batch',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/BatchConfirmation')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/confirmations/notifications',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/NotificationSettings')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/confirmations/audit',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/PendingList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
    ],
  },
  // ChatOps (M35) - redirect to new /ai/chatops location
  {
    path: '/console/chatops',
    element: <RedirectTo to="/ai/chatops" />,
    protected: false,
  },
  {
    path: '/console/chatops/recommend',
    element: <RedirectTo to="/ai/chatops" />,
    protected: false,
  },
  {
    path: '/console/chatops/commands',
    element: <RedirectTo to="/ai/chatops" />,
    protected: false,
  },
  {
    path: '/console/chatops/executions',
    element: <RedirectTo to="/ai/chatops" />,
    protected: false,
  },
  {
    path: '/console/chatops/audit',
    element: <RedirectTo to="/ai/chatops" />,
    protected: false,
  },
  {
    path: '/console/chatops/settings',
    element: <RedirectTo to="/ai/chatops" />,
    protected: false,
  },
  // AI Cost Dashboard (M36)
  {
    path: '/console/ai-cost',
    element: React.lazy(() => import('@/pages/AICostDashboard')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
    children: [
      // 默认重定向到 overview
      {
        index: true,
        element: React.createElement(Navigate, { to: '/console/ai-cost/overview', replace: true }),
      },
      {
        path: '/console/ai-cost/overview',
        element: React.lazy(() => import('@/pages/AICostDashboard/CostOverview')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/ai-cost/budgets',
        element: React.lazy(() => import('@/pages/AICostDashboard/BudgetManagement')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/ai-cost/details',
        element: React.lazy(() => import('@/pages/AICostDashboard/CostDetail')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/ai-cost/roi',
        element: React.lazy(() => import('@/pages/AICostDashboard/ROIReport')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/ai-cost/alerts',
        element: React.lazy(() => import('@/pages/AICostDashboard/AlertConfig')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
    ],
  },
  // LLM Trace Dashboard (P1)
  {
    path: '/console/llm-trace',
    element: React.lazy(() => import('@/pages/LLMTraceDashboard')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
    children: [
      // 默认重定向到 overview
      {
        index: true,
        element: React.createElement(Navigate, { to: '/console/llm-trace/overview', replace: true }),
      },
      {
        path: '/console/llm-trace/overview',
        element: React.lazy(() => import('@/pages/LLMTraceDashboard/TraceOverview')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/llm-trace/traces',
        element: React.lazy(() => import('@/pages/LLMTraceDashboard/TraceList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/llm-trace/cost',
        element: React.lazy(() => import('@/pages/LLMTraceDashboard/CostAnalysis')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/llm-trace/accuracy',
        element: React.lazy(() => import('@/pages/LLMTraceDashboard/TrackingAccuracy')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
    ],
  },
  // AI Doc Management (M37)
  {
    path: '/console/ai-docs',
    element: React.lazy(() => import('@/pages/AIDocManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
    children: [
      // 默认重定向到 spaces
      {
        index: true,
        element: React.createElement(Navigate, { to: '/console/ai-docs/spaces', replace: true }),
      },
      {
        path: '/console/ai-docs/spaces',
        element: React.lazy(() => import('@/pages/AIDocManagement/SpaceList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/ai-docs/documents',
        element: React.lazy(() => import('@/pages/AIDocManagement/DocumentList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/ai-docs/editor/:id?',
        element: React.lazy(() => import('@/pages/AIDocManagement/DocumentEditor')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/ai-docs/rag',
        element: React.lazy(() => import('@/pages/AIDocManagement/RAGQuery')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/ai-docs/graph',
        element: React.lazy(() => import('@/pages/AIDocManagement/DocumentList')), // TODO: 替换为知识图谱组件
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
    ],
  },

  // Build Environment Management
  {
    path: '/console/build-env',
    element: React.lazy(() => import('@/pages/BuildEnv')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
    children: [
      // 默认重定向到 images
      {
        index: true,
        element: React.createElement(Navigate, { to: '/console/build-env/images', replace: true }),
      },
      {
        path: '/console/build-env/images',
        element: React.lazy(() => import('@/pages/BuildEnv/BuilderImageList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/build-env/cache',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildCachePage')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/build-env/pods',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildPodList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/build-env/pods/:id',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildPodDetail')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/build-env/logs',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildLogList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/build-env/logs/:id',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildLogViewer')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/build-env/artifacts',
        element: React.lazy(() => import('@/pages/BuildEnv/ArtifactList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
    ],
  },
  // Code Management
  {
    path: '/console/code-mgmt',
    element: React.lazy(() => import('@/pages/CodeMgmt')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
    children: [
      // 默认重定向到 repos
      {
        index: true,
        element: React.createElement(Navigate, { to: '/console/code-mgmt/repos', replace: true }),
      },
      {
        path: '/console/code-mgmt/repos',
        element: React.lazy(() => import('@/pages/CodeMgmt/RepoList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/code-mgmt/repos/:adapterId/:repoId',
        element: React.lazy(() => import('@/pages/CodeMgmt/RepoDetail')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/code-mgmt/policies',
        element: React.lazy(() => import('@/pages/CodeMgmt/BranchPolicyList')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/code-mgmt/ownership',
        element: React.lazy(() => import('@/pages/CodeMgmt/CodeOwnersPage')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
      {
        path: '/console/code-mgmt/webhooks',
        element: React.lazy(() => import('@/pages/CodeMgmt/WebhookLog')),
        protected: true,
        requiredPermission: { resource: '*', action: 'manage' },
      },
    ],
  },
  // AI Review
  {
    path: '/console/ai-review',
    element: lazyImport('@/pages/AIReview'),
    protected: true,
    requiredPermission: { resource: 'ai-review', action: 'read' },
    children: [
      // 默认重定向到 dashboard
      {
        index: true,
        element: React.createElement(Navigate, { to: '/console/ai-review/dashboard', replace: true }),
      },
      {
        path: '/console/ai-review/dashboard',
        element: lazyImport('@/pages/AIReview/Dashboard'),
        protected: true,
        requiredPermission: { resource: 'ai-review', action: 'read' },
      },
      {
        path: '/console/ai-review/history',
        element: lazyImport('@/pages/AIReview/History'),
        protected: true,
        requiredPermission: { resource: 'ai-review', action: 'read' },
      },
      {
        path: '/console/ai-review/history/:id',
        element: lazyImport('@/pages/AIReview/ReviewDetail'),
        protected: true,
        requiredPermission: { resource: 'ai-review', action: 'read' },
      },
      {
        path: '/console/ai-review/rules',
        element: lazyImport('@/pages/AIReview/Rules'),
        protected: true,
        requiredPermission: { resource: 'ai-review', action: 'write' },
      },
      {
        path: '/console/ai-review/config',
        element: lazyImport('@/pages/AIReview/Config'),
        protected: true,
        requiredPermission: { resource: 'ai-review', action: 'write' },
      },
    ],
  },
  // Self-Healing (moved from /console to /observability)
  {
    path: '/observability/self-healing',
    element: React.lazy(() => import('@/pages/SelfHealing')),
    protected: true,
    children: [
      // 默认重定向到 incidents
      {
        index: true,
        element: React.createElement(Navigate, { to: '/observability/self-healing/incidents', replace: true }),
      },
      {
        path: '/observability/self-healing/incidents',
        element: React.lazy(() => import('@/pages/SelfHealing/IncidentList')),
        protected: true,
      },
      {
        path: '/observability/self-healing/incidents/:id',
        element: React.lazy(() => import('@/pages/SelfHealing/IncidentDetail')),
        protected: true,
      },
      {
        path: '/observability/self-healing/history',
        element: React.lazy(() => import('@/pages/SelfHealing/History')),
        protected: true,
      },
      {
        path: '/observability/self-healing/strategies',
        element: React.lazy(() => import('@/pages/SelfHealing/StrategyList')),
        protected: true,
      },
      {
        path: '/observability/self-healing/approvals',
        element: React.lazy(() => import('@/pages/SelfHealing/ApprovalQueue')),
        protected: true,
      },
      {
        path: '/observability/self-healing/effectiveness',
        element: React.lazy(() => import('@/pages/SelfHealing/EffectivenessDashboard')),
        protected: true,
      },
    ],
  },
  // Monitoring (moved from /console to /observability)
  {
    path: '/observability/monitoring',
    element: React.lazy(() => import('@/pages/monitor-svc/Monitoring')),
    protected: true,
    children: [
      // 默认重定向到 dashboard
      {
        index: true,
        element: React.createElement(Navigate, { to: '/observability/monitoring/dashboard', replace: true }),
      },
      {
        path: '/observability/monitoring/dashboard',
        element: React.lazy(() => import('@/pages/monitor-svc/Monitoring/Dashboard')),
        protected: true,
      },
      {
        path: '/observability/monitoring/metrics',
        element: React.lazy(() => import('@/pages/monitor-svc/Monitoring/Metrics')),
        protected: true,
      },
      {
        path: '/observability/monitoring/alerts',
        element: React.lazy(() => import('@/pages/monitor-svc/Monitoring/Alerts')),
        protected: true,
      },
      {
        path: '/observability/monitoring/rules',
        element: React.lazy(() => import('@/pages/monitor-svc/Monitoring/Rules')),
        protected: true,
      },
      {
        path: '/observability/monitoring/channels',
        element: React.lazy(() => import('@/pages/monitor-svc/Monitoring/Channels')),
        protected: true,
      },
    ],
  },
  // Diagnostic (moved from /console to /observability)
  {
    path: '/observability/diagnostic',
    element: React.lazy(() => import('@/pages/security-svc/Diagnostic')),
    protected: true,
    children: [
      // 默认重定向到 sessions
      {
        index: true,
        element: React.createElement(Navigate, { to: '/observability/diagnostic/sessions', replace: true }),
      },
      {
        path: '/observability/diagnostic/sessions',
        element: React.lazy(() => import('@/pages/security-svc/Diagnostic/Sessions')),
        protected: true,
      },
      {
        path: '/observability/diagnostic/sessions/:id',
        element: React.lazy(() => import('@/pages/security-svc/Diagnostic/SessionDetail')),
        protected: true,
      },
      {
        path: '/observability/diagnostic/reports',
        element: React.lazy(() => import('@/pages/security-svc/Diagnostic/Reports')),
        protected: true,
      },
      {
        path: '/observability/diagnostic/knowledge',
        element: React.lazy(() => import('@/pages/security-svc/Diagnostic/KnowledgeBase')),
        protected: true,
      },
      {
        path: '/observability/diagnostic/trigger',
        element: React.lazy(() => import('@/pages/security-svc/Diagnostic/Trigger')),
        protected: true,
      },
      {
        path: 'permission-audit',
        element: React.lazy(() => import('@/pages/security-svc/PermissionAudit')),
        protected: true,
        requiredPermission: { resource: 'audit', action: 'read' },
      },
      {
        path: 'abac-policy',
        element: React.lazy(() => import('@/pages/security-svc/ABACPolicy')),
        protected: true,
        requiredPermission: { resource: 'abac', action: 'read' },
      },
      {
        path: 'project-member',
        element: React.lazy(() => import('@/pages/security-svc/ProjectMember')),
        protected: true,
        requiredPermission: { resource: 'project', action: 'read' },
      },
      {
        path: 'ueba',
        element: React.lazy(() => import('@/pages/security-svc/UEBA')),
        protected: true,
        requiredPermission: { resource: 'ueba', action: 'read' },
      },
    ],
  },
  // 旧路由兼容：/console/monitoring → /observability/monitoring
  {
    path: '/console/monitoring',
    element: <RedirectTo to="/observability/monitoring" />,
    protected: false,
  },
  // 旧路由兼容：/console/diagnostic → /observability/diagnostic
  {
    path: '/console/diagnostic',
    element: <RedirectTo to="/observability/diagnostic" />,
    protected: false,
  },
  // 旧路由兼容：/console/self-healing → /observability/self-healing
  {
    path: '/console/self-healing',
    element: <RedirectTo to="/observability/self-healing" />,
    protected: false,
  },
  // AI Agent Orchestration (redirect to /ai/agents)
  {
    path: '/agents',
    element: <RedirectTo to="/ai/agents" />,
    protected: false,
  },
  {
    path: '/agent-runs/:id',
    element: <RedirectTo to="/ai/agents" />,
    protected: false,
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
  // Artifact Management (M29)
  {
    path: '/artifacts',
    element: React.lazy(() => import('@/pages/Artifacts')),
    protected: true,
  },
  // Artifact Version Browser (GAP-CN-06)
  {
    path: '/artifacts/browser',
    element: React.lazy(() => import('@/pages/ArtifactBrowser')),
    protected: true,
  },
  // Product Line Management (M6)
  {
    path: '/product-lines',
    element: React.lazy(() => import('@/pages/ProductLine')),
    protected: true,
  },
  // Internal Library Management (M30)
  {
    path: '/internal-libraries',
    element: React.lazy(() => import('@/pages/InternalLibrary')),
    protected: true,
  },
  // Role Management (RBAC)
  {
    path: '/roles',
    element: React.lazy(() => import('@/pages/RoleManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // OnCall Management
  {
    path: '/oncall',
    element: React.lazy(() => import('@/pages/OnCall')),
    protected: true,
  },
  // CMDB (M32)
  {
    path: '/cmdb',
    element: React.lazy(() => import('@/pages/CMDB')),
    protected: true,
  },
  // Approval Management (M33)
  {
    path: '/approvals',
    element: React.lazy(() => import('@/pages/Approvals')),
    protected: true,
  },
  // Approval Flow Management (V2/V3)
  {
    path: '/console/approvals',
    element: React.lazy(() => import('@/pages/ApprovalManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Workflow Designer (Lowcode)
  {
    path: '/workflows',
    element: React.lazy(() => import('@/pages/WorkflowDesigner')),
    protected: true,
  },
  // Workflow Tasks
  {
    path: '/workflow-tasks',
    element: React.lazy(() => import('@/pages/WorkflowTasks')),
    protected: true,
  },
  // Event Registry
  {
    path: '/event-registry',
    element: React.lazy(() => import('@/pages/EventRegistry')),
    protected: true,
  },
  // Task Timeouts
  {
    path: '/task-timeouts',
    element: React.lazy(() => import('@/pages/TaskTimeouts')),
    protected: true,
  },
  // Workflow Dependencies
  {
    path: '/workflow-dependencies',
    element: React.lazy(() => import('@/pages/WorkflowDependencies')),
    protected: true,
  },
  // Document Center - 统一指向PandaWiki知识空间
  {
    path: '/documents',
    element: <RedirectTo to="/knowledge/spaces" />,
    protected: true,
  },
  // Queue Management
  {
    path: '/console/queue',
    element: React.lazy(() => import('@/pages/QueueTasks')),
    protected: true,
  },
  // Script Runner
  {
    path: '/console/scripts',
    element: React.lazy(() => import('@/pages/ScriptRunner')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Environment Management
  {
    path: '/environments',
    element: React.lazy(() => import('@/pages/Environments')),
    protected: true,
  },
  // Vector Store Management
  {
    path: '/vector-store',
    element: React.lazy(() => import('@/pages/VectorStore')),
    protected: true,
  },
  // EventBus Monitoring
  {
    path: '/eventbus',
    element: React.lazy(() => import('@/pages/EventBus')),
    protected: true,
  },
  // Session Management
  {
    path: '/sessions',
    element: React.lazy(() => import('@/pages/Sessions')),
    protected: true,
  },
  // Metrics Dashboard (P1 - Missing Page)
  {
    path: '/metrics-dashboard',
    element: React.lazy(() => import('@/pages/MetricsDashboard')),
    protected: true,
  },
  // Test Selector (P1 - Missing Page)
  {
    path: '/test-selector',
    element: React.lazy(() => import('@/pages/TestSelector')),
    protected: true,
  },
  // Test Report Viewer (CI Enhancement)
  {
    path: '/pipeline-runs/:runId/test-reports',
    element: React.lazy(() => import('@/pages/TestReport')),
    protected: true,
  },
  // Artifact Version Management (CI Enhancement)
  {
    path: '/artifacts/versions',
    element: React.lazy(() => import('@/pages/ArtifactVersion')),
    protected: true,
  },
  {
    path: '/artifacts/versions/:artifactName',
    element: React.lazy(() => import('@/pages/ArtifactVersion')),
    protected: true,
  },
  // Cron Management
  {
    path: '/console/cron',
    element: React.lazy(() => import('@/pages/CronJobs')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Webhook Management
  {
    path: '/console/webhooks',
    element: React.lazy(() => import('@/pages/WebhookManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Notification Rules (Webhooks + IM Notifications)
  {
    path: '/console/notification-rules',
    element: React.lazy(() => import('@/pages/NotificationRules')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // API Key Management
  {
    path: '/console/api-keys',
    element: React.lazy(() => import('@/pages/ApiKeyManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // 404 页面
  // Backup Management (P1)
  {
    path: '/backup',
    element: React.lazy(() => import('@/pages/Backup')),
    protected: true,
  },
  // Runner Pool Management (GAP-CN-07)
  {
    path: '/console/runners',
    element: React.lazy(() => import('@/pages/RunnerManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Plugin SPI - Extension Point Management (P1)
  {
    path: '/plugin-spi',
    element: React.lazy(() => import('@/pages/PluginSPI')),
    protected: true,
  },
  // AI Security (P1)
  {
    path: '/ai-security',
    element: React.lazy(() => import('@/pages/AISecurity')),
    protected: true,
  },
  // Module Manager (Workflow 5: Feature Domain Management)
  {
    path: '/console/modules',
    element: React.lazy(() => import('@/pages/ModuleManager')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Secrets Management (Pipeline secrets)
  {
    path: '/secrets',
    element: React.lazy(() => import('@/pages/SecretsManagement')),
    protected: true,
  },
  // Pipeline Template (Workflow 9: Advanced CI/CD)
  {
    path: '/pipeline-templates',
    element: React.lazy(() => import('@/pages/pipeline-template/PipelineTemplatePage')),
    protected: true,
  },
  // Rate Limiting (Workflow 6)
  {
    path: '/console/rate-limiting',
    element: React.lazy(() => import('@/pages/rate-limiting/RateLimitingPage')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Circuit Breaker (Workflow 6)
  {
    path: '/console/circuit-breaker',
    element: React.lazy(() => import('@/pages/circuit-breaker/CircuitBreakerPage')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Feature Flags (Workflow 10)
  {
    path: '/console/feature-flags',
    element: React.lazy(() => import('@/pages/feature-flags/FeatureFlagsPage')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // ==================== Phase 3-4 Pages ====================

  // Artifact Operations (Phase 3)
  {
    path: '/artifact-ops',
    element: React.lazy(() => import('@/pages/artifact-ops/ArtifactOpsPage')),
    protected: true,
  },
  // Canary Traffic Management (Phase 3)
  {
    path: '/canary-traffic',
    element: React.lazy(() => import('@/pages/canary-traffic/CanaryTrafficPage')),
    protected: true,
  },
  // Chaos Experiments (Phase 3)
  {
    path: '/chaos-experiments',
    element: React.lazy(() => import('@/pages/chaos/ChaosExperimentPage')),
    protected: true,
  },
  // Supply Chain Security (Phase 3)
  {
    path: '/supply-chain',
    element: React.lazy(() => import('@/pages/supply-chain/SupplyChainPage')),
    protected: true,
  },
  // Cross-Domain Orchestration (Phase 3)
  {
    path: '/orchestration',
    element: React.lazy(() => import('@/pages/orchestration/OrchestrationPage')),
    protected: true,
  },
  // Config Management Enhanced (Phase 3)
  {
    path: '/config-mgmt-enhanced',
    element: React.lazy(() => import('@/pages/ConfigManagement')),
    protected: true,
  },
  // Security Compliance (Phase 3)
  {
    path: '/compliance',
    element: React.lazy(() => import('@/pages/ConfigManagement')),
    protected: true,
  },
  // Multi-Modal Triggers (Phase 3)
  {
    path: '/triggers',
    element: React.lazy(() => import('@/pages/trigger/TriggerPage')),
    protected: true,
  },
  // PR/MR Trigger Management (CI Enhancement)
  {
    path: '/console/pr-triggers',
    element: React.lazy(() => import('@/pages/PRTriggerManagement')),
    protected: true,
    requiredPermission: { resource: '*', action: 'manage' },
  },
  // Community Ecosystem (Phase 3)
  {
    path: '/community',
    element: React.lazy(() => import('@/pages/community/CommunityPage')),
    protected: true,
  },
  // Disaster Recovery (Phase 4)
  {
    path: '/disaster-recovery',
    element: React.lazy(() => import('@/pages/disaster-recovery/DisasterRecoveryPage')),
    protected: true,
  },
  // Performance Engineering (Phase 4)
  {
    path: '/performance',
    element: React.lazy(() => import('@/pages/performance/PerformancePage')),
    protected: true,
  },
  // Cluster Federation (Phase 4)
  {
    path: '/federation',
    element: React.lazy(() => import('@/pages/federation/FederationPage')),
    protected: true,
  },
  // Multi-Cloud Management (Phase 4)
  {
    path: '/multi-cloud',
    element: React.lazy(() => import('@/pages/multi-cloud/MultiCloudPage')),
    protected: true,
  },
  // Data Pipeline (Phase 4)
  {
    path: '/data-pipeline',
    element: React.lazy(() => import('@/pages/data-pipeline/DataPipelinePage')),
    protected: true,
  },
  // Digital Twin (Phase 4)
  {
    path: '/digital-twin',
    element: React.lazy(() => import('@/pages/DigitalTwin/DigitalTwinPage')),
    protected: true,
  },
  // API Governance (Phase 4)
  {
    path: '/api-governance',
    element: React.lazy(() => import('@/pages/api-governance/ApiGovernancePage')),
    protected: true,
  },
  // Community Ecosystem Advanced (Phase 4)
  {
    path: '/community/advanced',
    element: React.lazy(() => import('@/pages/community/CommunityAdvancedPage')),
    protected: true,
  },
  // Cluster Federation Advanced (Phase 4)
  {
    path: '/federation/advanced',
    element: React.lazy(() => import('@/pages/federation/FederationAdvancedPage')),
    protected: true,
  },
  // Multi-Cloud Management Advanced (Phase 4)
  {
    path: '/multi-cloud/advanced',
    element: React.lazy(() => import('@/pages/multi-cloud/MultiCloudAdvancedPage')),
    protected: true,
  },

  // ==================== Phase 2: Observability Enhancement ====================

  // Observability (Alert Rules, RCA, Silence)
  {
    path: '/console/observability',
    element: React.lazy(() => import('@/pages/observability/ObservabilityPage')),
    protected: true,
  },
  {
    path: '/console/observability/alert-rules',
    element: React.lazy(() => import('@/pages/observability/AlertRulesPage')),
    protected: true,
  },
  {
    path: '/console/observability/rca',
    element: React.lazy(() => import('@/pages/observability/RootCausePage')),
    protected: true,
  },

  // ==================== Phase 2: Cost Operations Enhancement ====================

  // Budget Guard Configuration
  {
    path: '/console/cost/budget-guard',
    element: React.lazy(() => import('@/pages/cost/BudgetGuardPage')),
    protected: true,
  },

  // Developer Portal
  {
    path: '/developer-portal',
    element: React.lazy(() => import('@/pages/developer-portal/DeveloperPortalPage')),
    protected: true,
  },

  // ==================== AI 能力平台（新路由） ====================
  {
    path: '/ai/dashboard',
    element: React.lazy(() => import('@/pages/AIDashboard')),
    protected: true,
    requiredPermission: { resource: 'ai-gateway', action: 'read' },
  },
  {
    path: '/ai/gateway',
    element: React.lazy(() => import('@/pages/AIGateway')),
    protected: true,
    requiredPermission: { resource: 'ai-gateway', action: 'read' },
  },
  {
    path: '/ai/provider',
    element: React.lazy(() => import('@/pages/AIDashboard')),
    protected: true,
    requiredPermission: { resource: 'ai-provider', action: 'read' },
  },
  {
    path: '/ai/agents',
    element: React.lazy(() => import('@/pages/AIAgents')),
    protected: true,
    requiredPermission: { resource: 'ai-agent', action: 'read' },
  },
  {
    path: '/ai/security',
    element: React.lazy(() => import('@/pages/AISecurity')),
    protected: true,
    requiredPermission: { resource: 'ai-security', action: 'read' },
  },
  {
    path: '/ai/review',
    element: React.lazy(() => import('@/pages/AIReview')),
    protected: true,
    requiredPermission: { resource: 'ai-review', action: 'read' },
  },
  {
    path: '/ai/docs',
    element: <RedirectTo to="/knowledge/spaces" />,
    protected: true,
    requiredPermission: { resource: 'knowledge', action: 'read' },
  },
  {
    path: '/ai/knowledge',
    element: <RedirectTo to="/knowledge/spaces" />,
    protected: true,
    requiredPermission: { resource: 'knowledge', action: 'read' },
  },
  {
    path: '/ai/chatops',
    element: React.lazy(() => import('@/pages/ChatOps')),
    protected: true,
    requiredPermission: { resource: 'chatops', action: 'use' },
  },
  {
    path: '/ai/trace',
    element: React.lazy(() => import('@/pages/LLMTraceDashboard')),
    protected: true,
    requiredPermission: { resource: 'ai-trace', action: 'read' },
  },
  {
    path: '/ai/cost',
    element: React.lazy(() => import('@/pages/AICostDashboard')),
    protected: true,
    requiredPermission: { resource: 'ai-cost', action: 'read' },
  },

  // ==================== 模块入口重定向（7 域结构） ====================
  {
    path: '/delivery',
    element: <RedirectTo to="/pipelines" />,
    protected: true,
  },
  {
    path: '/observability',
    element: <RedirectTo to="/console/monitoring" />,
    protected: true,
  },
  {
    path: '/ai',
    element: <RedirectTo to="/ai/gateway" />,
    protected: true,
  },
  {
    path: '/infra',
    element: <RedirectTo to="/environments" />,
    protected: true,
  },
  {
    path: '/governance',
    element: <RedirectTo to="/policies" />,
    protected: true,
  },
  {
    path: '/ecosystem',
    element: <RedirectTo to="/dba" />,
    protected: true,
  },
  // 旧模块入口重定向（向后兼容）
  {
    path: '/ops',
    element: <RedirectTo to="/delivery" />,
    protected: true,
  },
  {
    path: '/dev-env',
    element: <RedirectTo to="/infra" />,
    protected: true,
  },

  // ==================== 旧路由 301 重定向（向后兼容） ====================
  {
    path: '/ai-gateway',
    element: <RedirectTo to="/ai/gateway" />,
    protected: false,
  },
  {
    path: '/ai-security',
    element: <RedirectTo to="/ai/security" />,
    protected: false,
  },
  {
    path: '/console/ai-review',
    element: <RedirectTo to="/ai/review" />,
    protected: false,
  },
  {
    path: '/console/ai-docs',
    element: <RedirectTo to="/ai/docs" />,
    protected: false,
  },
  {
    path: '/console/llm-trace',
    element: <RedirectTo to="/ai/trace" />,
    protected: false,
  },
  {
    path: '/console/ai-cost',
    element: <RedirectTo to="/ai/cost" />,
    protected: false,
  },

  // 用户个人中心与设置
  {
    path: '/profile',
    element: React.lazy(() => import('@/pages/UserProfile')),
    protected: true,
  },
  {
    path: '/settings',
    element: React.lazy(() => import('@/pages/UserSettings')),
    protected: true,
  },

  // 能力权限配置
  {
    path: '/capability-admin',
    element: React.lazy(() => import('@/pages/CapabilityAdmin')),
    protected: true,
    roles: ['super_admin', 'platform_admin'],
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
