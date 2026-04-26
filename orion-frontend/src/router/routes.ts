import React from 'react';
import type { FC } from 'react';

export interface AppRoute {
  path: string;
  element: React.LazyExoticComponent<FC<any>>;
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
    element: React.lazy(() => import('@/pages/UserManagement')),
    protected: true,
  },
  {
    path: '/projects',
    element: React.lazy(() => import('@/pages/Projects')),
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
  // Knowledge Base (M28)
  {
    path: '/knowledge',
    element: React.lazy(() => import('@/pages/KnowledgeBase')),
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
      { path: '/skills/marketplace', element: React.lazy(() => import('@/pages/SkillManagement/Marketplace')), protected: true },
      { path: '/skills/my', element: React.lazy(() => import('@/pages/SkillManagement/MySkills')), protected: true },
      { path: '/skills/submit', element: React.lazy(() => import('@/pages/SkillManagement/SkillSubmission')), protected: true },
    ],
  },
  // IaC Management (M20)
  {
    path: '/console/iac',
    element: React.lazy(() => import('@/pages/IacManagement')),
    protected: true,
    children: [
      { path: '/console/iac/workspaces', element: React.lazy(() => import('@/pages/IacManagement/WorkspaceList')), protected: true },
      { path: '/console/iac/plans', element: React.lazy(() => import('@/pages/IacManagement/PlanViewer')), protected: true },
      { path: '/console/iac/state', element: React.lazy(() => import('@/pages/IacManagement/StateBrowser')), protected: true },
      { path: '/console/iac/modules', element: React.lazy(() => import('@/pages/IacManagement/ModuleRegistry')), protected: true },
    ],
  },
  // Manual Confirmation (M34)
  {
    path: '/console/confirmations',
    element: React.lazy(() => import('@/pages/ConfirmationWorkbench')),
    protected: true,
    children: [
      { path: '/console/confirmations/pending', element: React.lazy(() => import('@/pages/ConfirmationWorkbench/PendingList')), protected: true },
      { path: '/console/confirmations/:id', element: React.lazy(() => import('@/pages/ConfirmationWorkbench/ConfirmationDetail')), protected: true },
      { path: '/console/confirmations/batch', element: React.lazy(() => import('@/pages/ConfirmationWorkbench/BatchConfirmation')), protected: true },
      { path: '/console/confirmations/notifications', element: React.lazy(() => import('@/pages/ConfirmationWorkbench/NotificationSettings')), protected: true },
      { path: '/console/confirmations/audit', element: React.lazy(() => import('@/pages/ConfirmationWorkbench/PendingList')), protected: true },
    ],
  },
  // ChatOps (M35)
  {
    path: '/console/chatops',
    element: React.lazy(() => import('@/pages/ChatOps')),
    protected: true,
    children: [
      { path: '/console/chatops/commands', element: React.lazy(() => import('@/pages/ChatOps/CommandBrowser')), protected: true },
      { path: '/console/chatops/executions', element: React.lazy(() => import('@/pages/ChatOps/ExecutionDashboard')), protected: true },
      { path: '/console/chatops/audit', element: React.lazy(() => import('@/pages/ChatOps/AuditLogViewer')), protected: true },
      { path: '/console/chatops/settings', element: React.lazy(() => import('@/pages/ChatOps/ChatOpsSettings')), protected: true },
    ],
  },
  // AI Cost Dashboard (M36)
  {
    path: '/console/ai-cost',
    element: React.lazy(() => import('@/pages/AICostDashboard')),
    protected: true,
    children: [
      { path: '/console/ai-cost/overview', element: React.lazy(() => import('@/pages/AICostDashboard/CostOverview')), protected: true },
      { path: '/console/ai-cost/budgets', element: React.lazy(() => import('@/pages/AICostDashboard/BudgetManagement')), protected: true },
      { path: '/console/ai-cost/details', element: React.lazy(() => import('@/pages/AICostDashboard/CostDetail')), protected: true },
      { path: '/console/ai-cost/roi', element: React.lazy(() => import('@/pages/AICostDashboard/ROIReport')), protected: true },
      { path: '/console/ai-cost/alerts', element: React.lazy(() => import('@/pages/AICostDashboard/AlertConfig')), protected: true },
    ],
  },
  // AI Doc Management (M37)
  {
    path: '/console/ai-docs',
    element: React.lazy(() => import('@/pages/AIDocManagement')),
    protected: true,
    children: [
      { path: '/console/ai-docs/spaces', element: React.lazy(() => import('@/pages/AIDocManagement/SpaceList')), protected: true },
      { path: '/console/ai-docs/documents', element: React.lazy(() => import('@/pages/AIDocManagement/DocumentList')), protected: true },
      { path: '/console/ai-docs/editor/:id?', element: React.lazy(() => import('@/pages/AIDocManagement/DocumentEditor')), protected: true },
      { path: '/console/ai-docs/rag', element: React.lazy(() => import('@/pages/AIDocManagement/RAGQuery')), protected: true },
      { path: '/console/ai-docs/graph', element: React.lazy(() => import('@/pages/AIDocManagement/SpaceList')), protected: true },
    ],
  },

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
  // Artifact Management (M29)
  {
    path: '/artifacts',
    element: React.lazy(() => import('@/pages/Artifacts')),
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
  // Queue Management
  {
    path: '/queue',
    element: React.lazy(() => import('@/pages/Queue')),
    protected: true,
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
  // 404 页面
  {
    path: '*',
    element: React.lazy(() => import('@/pages/NotFound')),
    protected: false,
  },
];

// 公开路由路径
export const publicPaths = ['/login'];
