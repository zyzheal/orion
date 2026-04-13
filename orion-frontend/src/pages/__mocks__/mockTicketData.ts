/**
 * Mock Data for Ticketing Pages
 * - Tickets with various statuses and priorities
 * - Engineers with availability and expertise
 * - Queue status and SLA alerts
 */

// ============================================================================
// Ticket Mock Data
// ============================================================================

export interface MockTicket {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'assigned' | 'in-progress' | 'resolved' | 'closed';
  assignee: string | null;
  reporter: string;
  source: 'manual' | 'alert' | 'incident' | 'api';
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  escalationLevel: number;
  tags: Record<string, string>;
}

export const mockTickets: MockTicket[] = [
  {
    id: 'TKT-001',
    title: '生产数据库 CPU 使用率过高 (95%)',
    description: '监控显示 prod-db-01 的 CPU 使用率持续超过 95%，导致响应时间延长。需要紧急排查。',
    category: 'database',
    priority: 'critical',
    status: 'in-progress',
    assignee: '张伟',
    reporter: 'system',
    source: 'alert',
    createdAt: '2026-04-13T08:30:00Z',
    updatedAt: '2026-04-13T09:15:00Z',
    dueDate: '2026-04-13T12:30:00Z',
    escalationLevel: 1,
    tags: { host: 'prod-db-01', metric: 'cpu_usage', alert_id: 'ALT-123' },
  },
  {
    id: 'TKT-002',
    title: 'API 网关 502 错误率上升',
    description: 'api-gateway 返回 502 错误的比例从 0.1% 上升到 2.3%，影响部分用户请求。',
    category: 'network',
    priority: 'high',
    status: 'assigned',
    assignee: '李娜',
    reporter: '监控',
    source: 'alert',
    createdAt: '2026-04-13T09:00:00Z',
    updatedAt: '2026-04-13T09:00:00Z',
    dueDate: '2026-04-13T17:00:00Z',
    escalationLevel: 0,
    tags: { service: 'api-gateway', error_code: '502' },
  },
  {
    id: 'TKT-003',
    title: '服务器磁盘空间不足 - /var/log 已满',
    description: 'prod-app-03 的 /var/log 分区使用率已达 98%，需要及时清理日志。',
    category: 'infrastructure',
    priority: 'medium',
    status: 'open',
    assignee: null,
    reporter: '运维',
    source: 'manual',
    createdAt: '2026-04-13T07:00:00Z',
    updatedAt: '2026-04-13T07:00:00Z',
    dueDate: '2026-04-14T07:00:00Z',
    escalationLevel: 0,
    tags: { host: 'prod-app-03', partition: '/var/log' },
  },
  {
    id: 'TKT-004',
    title: '部署 pipeline 失败 - frontend-deploy 超时',
    description: 'Pipeline #456 在 frontend-deploy 阶段超时，持续 30 分钟未完成。',
    category: 'pipeline',
    priority: 'high',
    status: 'open',
    assignee: null,
    reporter: 'CI Bot',
    source: 'incident',
    createdAt: '2026-04-13T06:30:00Z',
    updatedAt: '2026-04-13T07:00:00Z',
    dueDate: '2026-04-13T14:30:00Z',
    escalationLevel: 0,
    tags: { pipeline: 'frontend-deploy', run_id: '456' },
  },
  {
    id: 'TKT-005',
    title: '安全漏洞扫描发现高危漏洞',
    description: '月度安全扫描发现 libcurl CVE-2025-1234 高危漏洞，需要紧急升级。',
    category: 'security',
    priority: 'critical',
    status: 'open',
    assignee: null,
    reporter: '安全团队',
    source: 'manual',
    createdAt: '2026-04-12T15:00:00Z',
    updatedAt: '2026-04-12T15:00:00Z',
    dueDate: '2026-04-13T15:00:00Z',
    escalationLevel: 2,
    tags: { cve: 'CVE-2025-1234', library: 'libcurl', severity: 'high' },
  },
  {
    id: 'TKT-006',
    title: '成本优化：闲置 ECS 实例回收',
    description: '发现 5 台 ECS 实例超过 30 天未使用，建议回收以节省成本。',
    category: 'cost',
    priority: 'low',
    status: 'open',
    assignee: null,
    reporter: 'FinOps',
    source: 'api',
    createdAt: '2026-04-12T10:00:00Z',
    updatedAt: '2026-04-12T10:00:00Z',
    dueDate: '2026-04-19T10:00:00Z',
    escalationLevel: 0,
    tags: { resource_type: 'ecs', count: '5', days_idle: '30' },
  },
  {
    id: 'TKT-007',
    title: '应用响应延迟 P99 > 2s',
    description: 'order-service 的 P99 响应时间从 800ms 上升到 2.3s，疑似数据库慢查询。',
    category: 'performance',
    priority: 'high',
    status: 'in-progress',
    assignee: '王强',
    reporter: '监控',
    source: 'alert',
    createdAt: '2026-04-13T08:00:00Z',
    updatedAt: '2026-04-13T09:30:00Z',
    dueDate: '2026-04-13T16:00:00Z',
    escalationLevel: 0,
    tags: { service: 'order-service', metric: 'p99_latency' },
  },
  {
    id: 'TKT-008',
    title: 'Redis 集群节点故障',
    description: 'Redis 集群 node-03 失去响应，导致分片数据不可用。',
    category: 'database',
    priority: 'critical',
    status: 'resolved',
    assignee: '张伟',
    reporter: '监控',
    source: 'alert',
    createdAt: '2026-04-12T22:00:00Z',
    updatedAt: '2026-04-13T02:00:00Z',
    dueDate: '2026-04-13T02:00:00Z',
    escalationLevel: 1,
    tags: { host: 'redis-node-03', cluster: 'main' },
  },
];

// ============================================================================
// Engineer Mock Data
// ============================================================================

export interface MockEngineer {
  id: string;
  name: string;
  expertise: string[];
  availability: 'available' | 'busy' | 'away';
  currentLoad: number;
  maxCapacity: number;
}

export const mockEngineers: MockEngineer[] = [
  { id: 'E001', name: '张伟', expertise: ['database', 'infrastructure', 'network'], availability: 'available', currentLoad: 3, maxCapacity: 8 },
  { id: 'E002', name: '李娜', expertise: ['application', 'deployment', 'pipeline'], availability: 'available', currentLoad: 2, maxCapacity: 6 },
  { id: 'E003', name: '王强', expertise: ['infrastructure', 'network', 'security'], availability: 'busy', currentLoad: 5, maxCapacity: 6 },
  { id: 'E004', name: '赵敏', expertise: ['application', 'performance', 'database'], availability: 'available', currentLoad: 1, maxCapacity: 7 },
  { id: 'E005', name: '陈浩', expertise: ['deployment', 'pipeline', 'infrastructure'], availability: 'away', currentLoad: 4, maxCapacity: 5 },
];

// ============================================================================
// Queue Status Mock Data
// ============================================================================

export interface MockQueueStatus {
  totalInQueue: number;
  byPriority: Record<string, number>;
  slaAtRisk: number;
  slaBreached: number;
  avgWaitTimeMs: number;
  oldestWaitTimeMs: number;
}

export const mockQueueStatus: MockQueueStatus = {
  totalInQueue: 4,
  byPriority: { critical: 1, high: 2, medium: 1, low: 0 },
  slaAtRisk: 1,
  slaBreached: 0,
  avgWaitTimeMs: 3600000,
  oldestWaitTimeMs: 7200000,
};

// ============================================================================
// SLA Alerts Mock Data
// ============================================================================

export interface MockSLAAlert {
  id: string;
  ticketId: string;
  alertType: 'sla-warning' | 'sla-critical' | 'sla-breach';
  timeRemainingMs: number;
  message: string;
  generatedAt: string;
}

export const mockSLAAlerts: MockSLAAlert[] = [
  { id: 'SA-001', ticketId: 'TKT-005', alertType: 'sla-warning', timeRemainingMs: 3600000, message: 'TKT-005 即将超过 SLA 时限', generatedAt: '2026-04-13T09:00:00Z' },
];

// ============================================================================
// Ticket History Mock Data
// ============================================================================

export interface MockTicketHistoryEntry {
  id: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  performedBy: string;
  reason?: string;
  timestamp: string;
}

export const mockTicketHistory: Record<string, MockTicketHistoryEntry[]> = {
  'TKT-001': [
    { id: 'h1', action: 'created', toStatus: 'open', performedBy: 'system', timestamp: '2026-04-13T08:30:00Z' },
    { id: 'h2', action: 'assigned', toStatus: 'assigned', performedBy: '调度系统', reason: '自动分配给数据库专家', timestamp: '2026-04-13T08:31:00Z' },
    { id: 'h3', action: 'transitioned', fromStatus: 'assigned', toStatus: 'in-progress', performedBy: '张伟', timestamp: '2026-04-13T08:45:00Z' },
    { id: 'h4', action: 'escalated', performedBy: '张伟', reason: '需要 DBA 团队协助', timestamp: '2026-04-13T09:15:00Z' },
  ],
  'TKT-008': [
    { id: 'h5', action: 'created', toStatus: 'open', performedBy: '监控', timestamp: '2026-04-12T22:00:00Z' },
    { id: 'h6', action: 'assigned', toStatus: 'assigned', performedBy: '调度系统', timestamp: '2026-04-12T22:01:00Z' },
    { id: 'h7', action: 'transitioned', fromStatus: 'assigned', toStatus: 'in-progress', performedBy: '张伟', timestamp: '2026-04-12T22:10:00Z' },
    { id: 'h8', action: 'resolved', toStatus: 'resolved', performedBy: '张伟', reason: '重启节点后恢复正常', timestamp: '2026-04-13T02:00:00Z' },
  ],
};

// ============================================================================
// Ticket Relations Mock Data
// ============================================================================

export interface MockTicketRelation {
  relationId: string;
  ticketId: string;
  relatedTicketId: string;
  relatedTicketTitle: string;
  relationType: 'duplicate' | 'caused-by' | 'related' | 'blocks';
}

export const mockTicketRelations: MockTicketRelation[] = [
  { relationId: 'r1', ticketId: 'TKT-001', relatedTicketId: 'TKT-007', relatedTicketTitle: '应用响应延迟 P99 > 2s', relationType: 'related' },
];

// ============================================================================
// Transfer History Mock Data
// ============================================================================

export interface MockTransferEntry {
  id: string;
  ticketId: string;
  fromEngineer: string;
  toEngineer: string;
  reason: string;
  initiatedBy: string;
  timestamp: string;
}

export const mockTransferHistory: MockTransferEntry[] = [
  { id: 'tr1', ticketId: 'TKT-001', fromEngineer: '李娜', toEngineer: '张伟', reason: '需要数据库专业知识', initiatedBy: '李娜', timestamp: '2026-04-13T08:35:00Z' },
];

// ============================================================================
// Ticket Comments Mock Data
// ============================================================================

export const mockTicketComments: Record<string, Array<{
  id: string;
  ticketId: string;
  author: string;
  content: string;
  type: 'comment' | 'internal-note';
  createdAt: string;
  mentions: string[];
  attachments?: string[];
}>> = {
  'TKT-001': [
    {
      id: 'C001',
      ticketId: 'TKT-001',
      author: '张伟',
      content: '正在排查，初步判断是慢查询导致 CPU 飙升，正在优化索引。',
      type: 'comment',
      createdAt: '2026-04-13T09:00:00Z',
      mentions: ['李娜'],
    },
    {
      id: 'C002',
      ticketId: 'TKT-001',
      author: '李娜',
      content: '建议先加索引到 orders 表的 created_at 字段，同时排查一下最近的慢查询日志。',
      type: 'internal-note',
      createdAt: '2026-04-13T09:30:00Z',
      mentions: [],
    },
    {
      id: 'C003',
      ticketId: 'TKT-001',
      author: '张伟',
      content: '索引已添加，CPU 使用率下降到 40%，继续观察。@王磊 帮忙确认一下监控是否正常。',
      type: 'comment',
      createdAt: '2026-04-13T10:00:00Z',
      mentions: ['王磊'],
    },
  ],
  'TKT-002': [
    {
      id: 'C004',
      ticketId: 'TKT-002',
      author: '王磊',
      content: '上游服务 health-check 超时，疑似网络问题，正在排查网关配置。',
      type: 'comment',
      createdAt: '2026-04-13T09:15:00Z',
      mentions: [],
    },
  ],
};

// ============================================================================
// Ticket Attachments Mock Data
// ============================================================================

export const mockTicketAttachments: Record<string, Array<{
  id: string;
  ticketId: string;
  name: string;
  size: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}>> = {
  'TKT-001': [
    { id: 'A001', ticketId: 'TKT-001', name: 'cpu-graph.png', size: '2.3 MB', type: 'image/png', uploadedBy: '张伟', uploadedAt: '2026-04-13T09:05:00Z', url: '#' },
    { id: 'A002', ticketId: 'TKT-001', name: 'slow-query.log', size: '156 KB', type: 'text/plain', uploadedBy: '张伟', uploadedAt: '2026-04-13T09:10:00Z', url: '#' },
  ],
  'TKT-002': [
    { id: 'A003', ticketId: 'TKT-002', name: 'error-trace.log', size: '89 KB', type: 'text/plain', uploadedBy: '王磊', uploadedAt: '2026-04-13T09:20:00Z', url: '#' },
  ],
};
