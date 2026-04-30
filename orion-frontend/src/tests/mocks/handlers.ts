import { http, HttpResponse } from 'msw';

// Mock plugin data matching test expectations
const mockPlugins = [
  {
    id: 'plugin-1',
    name: '数据库迁移助手',
    type: 'CUSTOM_TASK',
    state: 'ACTIVE',
    version: '1.0.0',
    latestVersion: null,
    category: 'core',
    author: 'orion',
    installedAt: '2024-01-01',
    description: '数据库迁移插件',
    healthStatus: 'healthy',
  },
  {
    id: 'plugin-2',
    name: '日志分析插件',
    type: 'CUSTOM_TASK',
    state: 'DISABLED',
    version: '2.0.0',
    latestVersion: '2.1.0',
    category: 'monitoring',
    author: 'orion',
    installedAt: '2024-01-02',
    description: '日志分析',
    healthStatus: 'warning',
  },
  {
    id: 'plugin-3',
    name: '安全审计',
    type: 'CUSTOM_TASK',
    state: 'ACTIVE',
    version: '3.0.0',
    latestVersion: null,
    category: 'security',
    author: 'orion',
    installedAt: '2024-01-03',
    description: '安全审计插件',
    healthStatus: 'healthy',
  },
  {
    id: 'plugin-4',
    name: '性能监控',
    type: 'CUSTOM_TASK',
    state: 'ACTIVE',
    version: '4.0.0',
    latestVersion: null,
    category: 'monitoring',
    author: 'orion',
    installedAt: '2024-01-04',
    description: '性能监控',
    healthStatus: 'error',
  },
  {
    id: 'plugin-5',
    name: '核心',
    type: 'CUSTOM_TASK',
    state: 'ACTIVE',
    version: '5.0.0',
    latestVersion: '5.1.0',
    category: 'core',
    author: 'orion',
    installedAt: '2024-01-05',
    description: '核心插件',
    healthStatus: 'healthy',
  },
  {
    id: 'plugin-6',
    name: '新',
    type: 'CUSTOM_TASK',
    state: 'ACTIVE',
    version: '6.0.0',
    latestVersion: '6.1.0',
    category: 'extension',
    author: 'orion',
    installedAt: '2024-01-06',
    description: '新插件',
    healthStatus: 'healthy',
  },
  {
    id: 'plugin-7',
    name: 'Plugin 7',
    type: 'CUSTOM_TASK',
    state: 'DISABLED',
    version: '7.0.0',
    latestVersion: null,
    category: 'extension',
    author: 'orion',
    installedAt: '2024-01-07',
    description: 'Plugin 7',
    healthStatus: 'warning',
  },
  {
    id: 'plugin-8',
    name: 'Plugin 8',
    type: 'CUSTOM_TASK',
    state: 'ACTIVE',
    version: '8.0.0',
    latestVersion: null,
    category: 'monitoring',
    author: 'orion',
    installedAt: '2024-01-08',
    description: 'Plugin 8',
    healthStatus: 'healthy',
  },
];

// Mock alerts data
const mockAlerts = [
  {
    id: 'alert-1',
    severity: 'critical',
    metric: 'error_rate',
    value: 95,
    threshold: 80,
    status: 'active',
    message: '错误率超过阈值',
    source: 'api-gateway',
    createdAt: '2026-04-12T15:00:00Z',
  },
  {
    id: 'alert-2',
    severity: 'warning',
    metric: 'response_time_p99',
    value: 500,
    threshold: 300,
    status: 'active',
    message: '响应时间过长',
    source: 'frontend',
    createdAt: '2026-04-12T14:30:00Z',
  },
  {
    id: 'alert-3',
    severity: 'critical',
    metric: 'cpu_usage',
    value: 85,
    threshold: 70,
    status: 'acknowledged',
    message: 'CPU使用率过高',
    source: 'monitoring-service',
    createdAt: '2026-04-12T13:00:00Z',
    acknowledgedAt: '2026-04-12T14:00:00Z',
  },
  {
    id: 'alert-4',
    severity: 'info',
    metric: 'disk_usage',
    value: 60,
    threshold: 80,
    status: 'resolved',
    message: '磁盘使用率正常',
    source: 'storage-service',
    createdAt: '2026-04-12T10:00:00Z',
    resolvedAt: '2026-04-12T11:00:00Z',
  },
];

// Mock pipelines data
const mockPipelines = [
  {
    id: 'pipeline-1',
    name: 'Build Pipeline',
    status: 'running',
    lastRunAt: '2026-04-12T15:00:00Z',
    successRate: 85,
  },
  {
    id: 'pipeline-2',
    name: 'Test Pipeline',
    status: 'success',
    lastRunAt: '2026-04-12T14:00:00Z',
    successRate: 100,
  },
  {
    id: 'pipeline-3',
    name: 'Deploy Pipeline',
    status: 'failed',
    lastRunAt: '2026-04-12T13:00:00Z',
    successRate: 50,
  },
];

// Mock deployments data
const mockDeployments = [
  {
    id: 'deployment-1',
    name: 'Production Deploy',
    status: 'completed',
    environment: 'production',
    createdAt: '2026-04-12T15:00:00Z',
  },
  {
    id: 'deployment-2',
    name: 'Staging Deploy',
    status: 'running',
    environment: 'staging',
    createdAt: '2026-04-12T14:00:00Z',
  },
];

// Mock tickets data with all fields for TicketDetail tests
const mockTickets = [
  {
    id: 'TKT-001',
    title: '生产数据库 CPU 使用率过高 (95%)',
    status: 'in-progress',
    priority: 'critical',
    category: 'database',
    source: 'alert',
    reporter: '系统',
    assignee: '张伟',
    description:
      '监控显示 prod-db-01 的 CPU 使用率持续超过 95%，已持续30分钟，需要立即处理以避免服务中断。',
    createdAt: '2026-04-12T15:00:00Z',
    dueDate: '2026-04-12T18:00:00Z',
    escalationLevel: 1,
    tags: { host: 'prod-db-01', severity: 'high', region: 'cn-north' },
    workflowHistory: [
      {
        action: 'created',
        performedBy: '系统',
        timestamp: '2026-04-12T15:00:00Z',
        note: '创建工单',
      },
      {
        action: 'assigned',
        performedBy: '系统',
        timestamp: '2026-04-12T15:05:00Z',
        note: '分配工单给张伟',
      },
      {
        action: 'status_change',
        performedBy: '张伟',
        timestamp: '2026-04-12T15:10:00Z',
        note: '状态变更为处理中',
      },
      {
        action: 'escalated',
        performedBy: '系统',
        timestamp: '2026-04-12T15:30:00Z',
        note: '升级工单到 L1',
      },
    ],
    relations: ['TKT-007'],
  },
  {
    id: 'TKT-002',
    title: 'API 网关 502 错误率上升',
    status: 'in-progress',
    priority: 'high',
    category: 'network',
    source: 'alert',
    reporter: '运维',
    assignee: '张工',
    description: 'API网关502错误率从0.1%上升到5%，影响多个下游服务。',
    createdAt: '2026-04-12T14:00:00Z',
    dueDate: '2026-04-12T17:00:00Z',
    escalationLevel: 0,
    tags: { service: 'api-gateway', error: '502' },
    workflowHistory: [
      {
        action: 'created',
        performedBy: '运维',
        timestamp: '2026-04-12T14:00:00Z',
        note: '创建工单',
      },
      {
        action: 'assigned',
        performedBy: '运维主管',
        timestamp: '2026-04-12T14:05:00Z',
        note: '分配工单',
      },
    ],
  },
  {
    id: 'TKT-003',
    title: '部署流水线构建失败',
    status: 'assigned',
    priority: 'medium',
    category: 'pipeline',
    source: 'ci',
    reporter: '开发',
    assignee: '李工',
    description: 'Jenkins构建任务失败，错误信息显示依赖下载失败。',
    createdAt: '2026-04-12T13:00:00Z',
    dueDate: '2026-04-12T16:00:00Z',
    escalationLevel: 0,
    tags: { pipeline: 'main-build', branch: 'develop' },
    workflowHistory: [
      {
        action: 'created',
        performedBy: '开发',
        timestamp: '2026-04-12T13:00:00Z',
        note: '创建工单',
      },
    ],
  },
  {
    id: 'TKT-004',
    title: '前端页面加载缓慢',
    status: 'open',
    priority: 'low',
    category: 'application',
    source: 'user',
    reporter: '用户',
    assignee: null,
    description: '用户反馈首页加载时间超过5秒。',
    createdAt: '2026-04-12T12:00:00Z',
    dueDate: '2026-04-12T20:00:00Z',
    escalationLevel: 0,
    tags: { page: 'home', loadTime: '5s' },
  },
  {
    id: 'TKT-005',
    title: '安全漏洞扫描报告',
    status: 'resolved',
    priority: 'high',
    category: 'security',
    source: 'scan',
    reporter: '安全',
    assignee: '王工',
    description: '扫描发现3个高危漏洞需要修复。',
    createdAt: '2026-04-12T11:00:00Z',
    dueDate: '2026-04-12T14:00:00Z',
    escalationLevel: 0,
    tags: { scanType: 'security', severity: 'high' },
    workflowHistory: [
      {
        action: 'created',
        performedBy: '安全',
        timestamp: '2026-04-12T11:00:00Z',
        note: '创建工单',
      },
      {
        action: 'resolved',
        performedBy: '王工',
        timestamp: '2026-04-12T14:00:00Z',
        note: '漏洞已修复',
      },
    ],
  },
  {
    id: 'TKT-006',
    title: '成本优化建议',
    status: 'closed',
    priority: 'medium',
    category: 'cost',
    source: 'finops',
    reporter: '财务',
    assignee: '赵工',
    createdAt: '2026-04-12T10:00:00Z',
    dueDate: '2026-04-12T13:00:00Z',
    escalationLevel: 0,
  },
  {
    id: 'TKT-007',
    title: '服务器容量不足',
    status: 'in-progress',
    priority: 'high',
    category: 'infrastructure',
    source: 'monitoring',
    reporter: '系统',
    assignee: '陈工',
    createdAt: '2026-04-12T09:00:00Z',
    dueDate: '2026-04-12T12:00:00Z',
    escalationLevel: 1,
  },
  {
    id: 'TKT-008',
    title: '网络延迟异常',
    status: 'open',
    priority: 'critical',
    category: 'network',
    source: 'monitoring',
    reporter: '运维',
    assignee: null,
    createdAt: '2026-04-12T08:00:00Z',
    dueDate: '2026-04-12T11:00:00Z',
    escalationLevel: 2,
  },
];

// Mock FinOps data
const mockFinOpsData = {
  totalCost: 125000,
  costChange: 5.2,
  resources: [
    { name: 'EC2', cost: 45000, percentage: 36 },
    { name: 'RDS', cost: 30000, percentage: 24 },
    { name: 'S3', cost: 15000, percentage: 12 },
    { name: 'Lambda', cost: 10000, percentage: 8 },
  ],
};

export const handlers = [
  // 登录接口
  http.post('/api/auth/login', async ({ request }) => {
    const { username, password } = (await request.json()) as { username: string; password: string };

    if (username === 'admin' && password === 'admin123') {
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 3600,
          user: {
            id: '1',
            username: 'admin',
            email: 'admin@orion.com',
            role: 'admin',
            avatar: null,
          },
        },
      });
    }

    return HttpResponse.json(
      {
        code: 401,
        message: '用户名或密码错误',
        data: null,
      },
      { status: 401 }
    );
  }),

  // 获取当前用户
  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        id: '1',
        username: 'admin',
        email: 'admin@orion.com',
        role: 'admin',
        avatar: null,
      },
    });
  }),

  // 登出接口
  http.post('/api/auth/logout', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: null,
    });
  }),

  // Dashboard 统计数据
  http.get('/api/dashboard/stats', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        totalProjects: 12,
        activePipelines: 8,
        totalUsers: 156,
        systemHealth: 'healthy',
      },
    });
  }),

  // Plugins API
  http.get('/api/v1/plugins/installed', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: mockPlugins,
    });
  }),

  http.get('/api/v1/plugins/:pluginId', ({ params }) => {
    const plugin = mockPlugins.find((p) => p.id === params.pluginId);
    if (plugin) {
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: plugin,
      });
    }
    return HttpResponse.json(
      { code: 404, message: 'Plugin not found', data: null },
      { status: 404 }
    );
  }),

  http.post('/api/v1/plugins/:pluginId/toggle', ({ params }) => {
    const plugin = mockPlugins.find((p) => p.id === params.pluginId);
    if (plugin) {
      plugin.state = plugin.state === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: plugin,
      });
    }
    return HttpResponse.json(
      { code: 404, message: 'Plugin not found', data: null },
      { status: 404 }
    );
  }),

  http.delete('/api/v1/plugins/:pluginId', ({ params }) => {
    const index = mockPlugins.findIndex((p) => p.id === params.pluginId);
    if (index !== -1) {
      mockPlugins.splice(index, 1);
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: { success: true },
      });
    }
    return HttpResponse.json(
      { code: 404, message: 'Plugin not found', data: null },
      { status: 404 }
    );
  }),

  // Alerts API
  http.get('/api/v1/alert/list', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: mockAlerts,
    });
  }),

  http.post('/api/v1/alert/:alertId/acknowledge', ({ params }) => {
    const alert = mockAlerts.find((a) => a.id === params.alertId);
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date().toISOString();
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: alert,
      });
    }
    return HttpResponse.json(
      { code: 404, message: 'Alert not found', data: null },
      { status: 404 }
    );
  }),

  http.post('/api/v1/alert/:alertId/resolve', ({ params }) => {
    const alert = mockAlerts.find((a) => a.id === params.alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: alert,
      });
    }
    return HttpResponse.json(
      { code: 404, message: 'Alert not found', data: null },
      { status: 404 }
    );
  }),

  // Pipelines API
  http.get('/api/v1/pipelines', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        items: mockPipelines,
        total: mockPipelines.length,
      },
    });
  }),

  http.get('/api/v1/pipelines/:pipelineId', ({ params }) => {
    const pipeline = mockPipelines.find((p) => p.id === params.pipelineId);
    if (pipeline) {
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: pipeline,
      });
    }
    return HttpResponse.json(
      { code: 404, message: 'Pipeline not found', data: null },
      { status: 404 }
    );
  }),

  // Deployments API
  http.get('/api/v1/deployments', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        items: mockDeployments,
        total: mockDeployments.length,
      },
    });
  }),

  http.get('/api/v1/deployments/:deploymentId', ({ params }) => {
    const deployment = mockDeployments.find((d) => d.id === params.deploymentId);
    if (deployment) {
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: deployment,
      });
    }
    return HttpResponse.json(
      { code: 404, message: 'Deployment not found', data: null },
      { status: 404 }
    );
  }),

  // Tickets API
  http.get('/api/v1/tickets', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        items: mockTickets,
        total: mockTickets.length,
      },
    });
  }),

  http.get('/api/v1/tickets/:ticketId', ({ params }) => {
    const ticket = mockTickets.find((t) => t.id === params.ticketId);
    if (ticket) {
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: ticket,
      });
    }
    return HttpResponse.json(
      { code: 404, message: 'Ticket not found', data: null },
      { status: 404 }
    );
  }),

  // FinOps API
  http.get('/api/v1/finops/dashboard', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: mockFinOpsData,
    });
  }),

  // Efficiency Dashboard API
  http.get('/api/v1/efficiency/stats', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        doraMetrics: {
          deploymentFrequency: 2.5,
          leadTimeForChanges: 24,
          changeFailureRate: 5,
          mttr: 4,
        },
        buildMetrics: {
          averageBuildTime: 15,
          buildSuccessRate: 95,
          dailyBuildCount: 10,
        },
      },
    });
  }),

  // FinOps API - Cost Summary
  http.get('/api/v1/cost/summary', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        totalMonthly: 45680,
        budgetLimit: 60000,
        previousMonth: 42000,
        projectedMonthly: 48000,
        savings: 3200,
        waste: 5400,
      },
    });
  }),

  // FinOps API - Cost by Service Breakdown
  http.get('/api/v1/cost/breakdown', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: [
        { key: 'ecs', service: '云服务器 ECS', cost: 18000, percent: 39.4, trend: 'up' },
        { key: 'rds', service: '数据库 RDS', cost: 12000, percent: 26.3, trend: 'stable' },
        { key: 'oss', service: '对象存储 OSS', cost: 6000, percent: 13.2, trend: 'down' },
        { key: 'cdn', service: 'CDN', cost: 3000, percent: 6.6, trend: 'stable' },
        { key: 'slb', service: '负载均衡 SLB', cost: 2000, percent: 4.4, trend: 'stable' },
      ],
    });
  }),

  // FinOps API - Optimization Suggestions
  http.get('/api/v1/finops/optimize/suggestions', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: [
        {
          key: 'opt-1',
          title: '闲置资源清理',
          description: '发现3台未使用的ECS实例',
          savings: 2000,
          effort: 'low',
          status: 'pending',
        },
        {
          key: 'opt-2',
          title: '预留实例购买',
          description: '购买预留实例可节省成本',
          savings: 1500,
          effort: 'medium',
          status: 'pending',
        },
        {
          key: 'opt-3',
          title: '降配建议',
          description: '部分实例配置过高',
          savings: 800,
          effort: 'low',
          status: 'pending',
        },
      ],
    });
  }),

  // FinOps API - Budget Alerts
  http.get('/api/v1/finops/budget/check-alerts', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: [
        {
          key: 'alert-1',
          service: '云服务器 ECS',
          threshold: 15000,
          current: 18000,
          status: 'exceeded',
        },
        {
          key: 'alert-2',
          service: '数据库 RDS',
          threshold: 10000,
          current: 12000,
          status: 'exceeded',
        },
      ],
    });
  }),

  // Backup API
  http.get('/api/v1/backup', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        backups: [
          {
            id: 'bak-001',
            name: 'test-backup',
            type: 'full',
            status: 'completed',
            size: 1048576,
            createdAt: '2026-04-12T15:00:00Z',
            completedAt: '2026-04-12T15:05:00Z',
          },
        ],
      },
    });
  }),

  http.get('/api/v1/backup/stats', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        stats: { total: 1, successful: 1, failed: 0 },
      },
    });
  }),

  http.post('/api/v1/backup', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: { backup: { id: 'bak-new', name: 'new-backup', type: 'full', status: 'completed', size: 0, createdAt: new Date().toISOString() } },
    });
  }),

  http.post('/api/v1/backup/:id/restore', () => {
    return HttpResponse.json({ code: 0, message: 'success', data: null });
  }),

  http.delete('/api/v1/backup/:id', () => {
    return HttpResponse.json({ code: 0, message: 'success', data: null });
  }),

  http.post('/api/v1/backups/:id/download', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: { url: 'https://example.com/download/test-backup' },
    });
  }),
];
