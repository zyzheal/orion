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

// Mock tickets data
const mockTickets = [
  {
    id: 'TKT-001',
    title: '生产数据库 CPU 使用率过高 (95%)',
    status: 'open',
    priority: 'critical',
    category: 'database',
    source: 'monitoring',
    reporter: '系统',
    assignee: null,
    createdAt: '2026-04-12T15:00:00Z',
    dueDate: '2026-04-12T18:00:00Z',
    escalationLevel: 1,
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
    createdAt: '2026-04-12T14:00:00Z',
    dueDate: '2026-04-12T17:00:00Z',
    escalationLevel: 0,
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
    createdAt: '2026-04-12T13:00:00Z',
    dueDate: '2026-04-12T16:00:00Z',
    escalationLevel: 0,
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
    createdAt: '2026-04-12T12:00:00Z',
    dueDate: '2026-04-12T20:00:00Z',
    escalationLevel: 0,
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
    createdAt: '2026-04-12T11:00:00Z',
    dueDate: '2026-04-12T14:00:00Z',
    escalationLevel: 0,
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
    return HttpResponse.json({ code: 404, message: 'Plugin not found', data: null }, { status: 404 });
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
    return HttpResponse.json({ code: 404, message: 'Plugin not found', data: null }, { status: 404 });
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
    return HttpResponse.json({ code: 404, message: 'Plugin not found', data: null }, { status: 404 });
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
    return HttpResponse.json({ code: 404, message: 'Alert not found', data: null }, { status: 404 });
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
    return HttpResponse.json({ code: 404, message: 'Alert not found', data: null }, { status: 404 });
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
    return HttpResponse.json({ code: 404, message: 'Pipeline not found', data: null }, { status: 404 });
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
    return HttpResponse.json({ code: 404, message: 'Deployment not found', data: null }, { status: 404 });
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
    return HttpResponse.json({ code: 404, message: 'Ticket not found', data: null }, { status: 404 });
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
];