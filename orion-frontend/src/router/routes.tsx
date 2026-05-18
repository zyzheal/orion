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
  /** Required user role(s) to access this route. If string, must match exactly. If array, any match grants access. */
  requiredRole?: string | string[];
  /** Required permission to access this route. Format: { resource: 'project', action: 'read' } */
  requiredPermission?: { resource: string; action: string };
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
    requiredRole: ['admin', 'platform_admin'],
  },
  {
    path: '/console/plugins',
    element: React.lazy(() => import('@/pages/PluginManagement')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
  },
  {
    path: '/console/plugins/:id',
    element: React.lazy(() => import('@/pages/PluginManagement')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
  },
  {
    path: '/console/settings',
    element: React.lazy(() => import('@/pages/Console')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
  },
  {
    path: '/console/users',
    element: React.lazy(() => import('@/pages/UserManagement')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
  },
  {
    path: '/projects',
    element: React.lazy(() => import('@/pages/Projects')),
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
    requiredRole: ['admin', 'platform_admin'],
  },
  // Tenant Management
  {
    path: '/tenant-management',
    element: React.lazy(() => import('@/pages/TenantManagement')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
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
    requiredRole: ['admin', 'platform_admin'],
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
    ],
  },
  // IaC Management (M20)
  {
    path: '/console/iac',
    element: React.lazy(() => import('@/pages/IacManagement')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/iac/workspaces',
        element: React.lazy(() => import('@/pages/IacManagement/WorkspaceList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/iac/plans',
        element: React.lazy(() => import('@/pages/IacManagement/PlanViewer')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/iac/state',
        element: React.lazy(() => import('@/pages/IacManagement/StateBrowser')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/iac/modules',
        element: React.lazy(() => import('@/pages/IacManagement/ModuleRegistry')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },
  // Manual Confirmation (M34)
  {
    path: '/console/confirmations',
    element: React.lazy(() => import('@/pages/ConfirmationWorkbench')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/confirmations/pending',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/PendingList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/confirmations/:id',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/ConfirmationDetail')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/confirmations/batch',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/BatchConfirmation')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/confirmations/notifications',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/NotificationSettings')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/confirmations/audit',
        element: React.lazy(() => import('@/pages/ConfirmationWorkbench/PendingList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },
  // ChatOps (M35)
  {
    path: '/console/chatops',
    element: React.lazy(() => import('@/pages/ChatOps')),
    protected: true,
    // requiredRole: ['admin', 'platform_admin'], // TODO: 临时移除权限检查
    children: [
      {
        path: '/console/chatops/recommend',
        element: React.lazy(() => import('@/pages/ChatOps/SmartRecommend')),
        protected: true,
        // requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/chatops/commands',
        element: React.lazy(() => import('@/pages/ChatOps/CommandBrowser')),
        protected: true,
        // requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/chatops/executions',
        element: React.lazy(() => import('@/pages/ChatOps/ExecutionDashboard')),
        protected: true,
        // requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/chatops/audit',
        element: React.lazy(() => import('@/pages/ChatOps/AuditLogViewer')),
        protected: true,
        // requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/chatops/settings',
        element: React.lazy(() => import('@/pages/ChatOps/ChatOpsSettings')),
        protected: true,
        // requiredRole: ['admin', 'platform_admin'], // TODO: 临时移除权限检查以便测试
      },
    ],
  },
  // AI Cost Dashboard (M36)
  {
    path: '/console/ai-cost',
    element: React.lazy(() => import('@/pages/AICostDashboard')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/ai-cost/overview',
        element: React.lazy(() => import('@/pages/AICostDashboard/CostOverview')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-cost/budgets',
        element: React.lazy(() => import('@/pages/AICostDashboard/BudgetManagement')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-cost/details',
        element: React.lazy(() => import('@/pages/AICostDashboard/CostDetail')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-cost/roi',
        element: React.lazy(() => import('@/pages/AICostDashboard/ROIReport')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-cost/alerts',
        element: React.lazy(() => import('@/pages/AICostDashboard/AlertConfig')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },
  // LLM Trace Dashboard (P1)
  {
    path: '/console/llm-trace',
    element: React.lazy(() => import('@/pages/LLMTraceDashboard')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/llm-trace/overview',
        element: React.lazy(() => import('@/pages/LLMTraceDashboard/TraceOverview')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/llm-trace/traces',
        element: React.lazy(() => import('@/pages/LLMTraceDashboard/TraceList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/llm-trace/cost',
        element: React.lazy(() => import('@/pages/LLMTraceDashboard/CostAnalysis')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/llm-trace/accuracy',
        element: React.lazy(() => import('@/pages/LLMTraceDashboard/TrackingAccuracy')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },
  // AI Doc Management (M37)
  {
    path: '/console/ai-docs',
    element: React.lazy(() => import('@/pages/AIDocManagement')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/ai-docs/spaces',
        element: React.lazy(() => import('@/pages/AIDocManagement/SpaceList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-docs/documents',
        element: React.lazy(() => import('@/pages/AIDocManagement/DocumentList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-docs/editor/:id?',
        element: React.lazy(() => import('@/pages/AIDocManagement/DocumentEditor')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-docs/rag',
        element: React.lazy(() => import('@/pages/AIDocManagement/RAGQuery')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-docs/graph',
        element: React.lazy(() => import('@/pages/AIDocManagement/SpaceList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },

  // Build Environment Management
  {
    path: '/console/build-env',
    element: React.lazy(() => import('@/pages/BuildEnv')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/build-env/images',
        element: React.lazy(() => import('@/pages/BuildEnv/BuilderImageList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/build-env/cache',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildCachePage')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/build-env/pods',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildPodList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/build-env/pods/:id',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildPodDetail')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/build-env/logs',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildLogList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/build-env/logs/:id',
        element: React.lazy(() => import('@/pages/BuildEnv/BuildLogViewer')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/build-env/artifacts',
        element: React.lazy(() => import('@/pages/BuildEnv/ArtifactList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },
  // Code Management
  {
    path: '/console/code-mgmt',
    element: React.lazy(() => import('@/pages/CodeMgmt')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/code-mgmt/repos',
        element: React.lazy(() => import('@/pages/CodeMgmt/RepoList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/code-mgmt/repos/:adapterId/:repoId',
        element: React.lazy(() => import('@/pages/CodeMgmt/RepoDetail')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/code-mgmt/policies',
        element: React.lazy(() => import('@/pages/CodeMgmt/BranchPolicyList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/code-mgmt/ownership',
        element: React.lazy(() => import('@/pages/CodeMgmt/CodeOwnersPage')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/code-mgmt/webhooks',
        element: React.lazy(() => import('@/pages/CodeMgmt/WebhookLog')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },
  // AI Review
  {
    path: '/console/ai-review',
    element: lazyImport('@/pages/AIReview'),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
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
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-review/history',
        element: lazyImport('@/pages/AIReview/History'),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-review/history/:id',
        element: lazyImport('@/pages/AIReview/ReviewDetail'),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-review/rules',
        element: lazyImport('@/pages/AIReview/Rules'),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/ai-review/config',
        element: lazyImport('@/pages/AIReview/Config'),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },
  // Self-Healing
  {
    path: '/console/self-healing',
    element: React.lazy(() => import('@/pages/SelfHealing')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/self-healing/incidents',
        element: React.lazy(() => import('@/pages/SelfHealing/IncidentList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/self-healing/incidents/:id',
        element: React.lazy(() => import('@/pages/SelfHealing/IncidentDetail')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/self-healing/history',
        element: React.lazy(() => import('@/pages/SelfHealing/History')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/self-healing/strategies',
        element: React.lazy(() => import('@/pages/SelfHealing/StrategyList')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/self-healing/approvals',
        element: React.lazy(() => import('@/pages/SelfHealing/ApprovalQueue')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/self-healing/effectiveness',
        element: React.lazy(() => import('@/pages/SelfHealing/EffectivenessDashboard')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },
  // Monitoring
  {
    path: '/console/monitoring',
    element: React.lazy(() => import('@/pages/Monitoring')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/monitoring/dashboard',
        element: React.lazy(() => import('@/pages/Monitoring/Dashboard')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/monitoring/metrics',
        element: React.lazy(() => import('@/pages/Monitoring/Metrics')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/monitoring/alerts',
        element: React.lazy(() => import('@/pages/Monitoring/Alerts')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/monitoring/rules',
        element: React.lazy(() => import('@/pages/Monitoring/Rules')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/monitoring/channels',
        element: React.lazy(() => import('@/pages/Monitoring/Channels')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
    ],
  },
  // Diagnostic
  {
    path: '/console/diagnostic',
    element: React.lazy(() => import('@/pages/Diagnostic')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
    children: [
      {
        path: '/console/diagnostic/sessions',
        element: React.lazy(() => import('@/pages/Diagnostic/Sessions')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/diagnostic/sessions/:id',
        element: React.lazy(() => import('@/pages/Diagnostic/SessionDetail')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/diagnostic/reports',
        element: React.lazy(() => import('@/pages/Diagnostic/Reports')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/diagnostic/knowledge',
        element: React.lazy(() => import('@/pages/Diagnostic/KnowledgeBase')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
      {
        path: '/console/diagnostic/trigger',
        element: React.lazy(() => import('@/pages/Diagnostic/Trigger')),
        protected: true,
        requiredRole: ['admin', 'platform_admin'],
      },
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
    requiredRole: ['admin', 'platform_admin'],
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
    element: React.lazy(() => import('@/pages/CronManagement')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
  },
  // Webhook Management
  {
    path: '/console/webhooks',
    element: React.lazy(() => import('@/pages/WebhookManagement')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
  },
  // Notification Rules (Webhooks + IM Notifications)
  {
    path: '/console/notification-rules',
    element: React.lazy(() => import('@/pages/NotificationRules')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
  },
  // API Key Management
  {
    path: '/console/api-keys',
    element: React.lazy(() => import('@/pages/ApiKeyManagement')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
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
    requiredRole: ['admin', 'platform_admin'],
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
    requiredRole: ['admin', 'platform_admin'],
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
    requiredRole: ['admin', 'platform_admin'],
  },
  // Circuit Breaker (Workflow 6)
  {
    path: '/console/circuit-breaker',
    element: React.lazy(() => import('@/pages/circuit-breaker/CircuitBreakerPage')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
  },
  // Feature Flags (Workflow 10)
  {
    path: '/console/feature-flags',
    element: React.lazy(() => import('@/pages/feature-flags/FeatureFlagsPage')),
    protected: true,
    requiredRole: ['admin', 'platform_admin'],
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
    requiredRole: ['admin', 'platform_admin'],
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
    element: React.lazy(() => import('@/pages/AIDashboard')),
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
    element: React.lazy(() => import('@/pages/AIDocManagement')),
    protected: true,
    requiredPermission: { resource: 'ai-doc', action: 'read' },
  },
  {
    path: '/ai/knowledge',
    element: React.lazy(() => import('@/pages/KnowledgeBase')),
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

  // ==================== 旧路由 301 重定向（向后兼容） ====================
  {
    path: '/ai-gateway',
    element: <RedirectTo to="/ai/gateway" />,
    protected: false,
  },
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
  {
    path: '/ai-security',
    element: <RedirectTo to="/ai/security" />,
    protected: false,
  },
  {
    path: '/console/chatops',
    element: <RedirectTo to="/ai/chatops" />,
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

  // 404 页面
  {
    path: '*',
    element: React.lazy(() => import('@/pages/NotFound')),
    protected: false,
  },
];

// 公开路由路径
export const publicPaths = ['/login'];
