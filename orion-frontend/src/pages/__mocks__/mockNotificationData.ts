/**
 * Mock data for Notification System
 * - Notifications with various types and priorities
 * - Notification stats summary
 */

export interface MockNotification {
  id: string;
  title: string;
  content: string;
  type:
    | 'ticket_assigned'
    | 'ticket_escalated'
    | 'sla_warning'
    | 'sla_breached'
    | 'pipeline_completed'
    | 'system_alert'
    | 'comment_mention'
    | 'transfer_request';
  priority: 'critical' | 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: string;
  relatedId?: string; // ticket ID, pipeline ID, etc.
  sender: string;
  actions?: Array<{ label: string; type: string }>;
}

export const mockNotifications: MockNotification[] = [
  {
    id: 'N001',
    title: '新工单分配',
    content: '您被分配了一个紧急工单 TKT-001: 生产数据库 CPU 使用率过高 (95%)',
    type: 'ticket_assigned',
    priority: 'critical',
    read: false,
    createdAt: '2026-05-19T08:35:00Z',
    relatedId: 'TKT-001',
    sender: '系统',
    actions: [{ label: '查看工单', type: 'primary' }],
  },
  {
    id: 'N002',
    title: '工单升级提醒',
    content: '工单 TKT-005 已超过 2 小时未处理，已自动升级到 L2',
    type: 'ticket_escalated',
    priority: 'high',
    read: false,
    createdAt: '2026-05-19T09:00:00Z',
    relatedId: 'TKT-005',
    sender: '系统',
  },
  {
    id: 'N003',
    title: 'SLA 警告',
    content: '工单 TKT-002 即将超过 SLA 时限（剩余 30 分钟）',
    type: 'sla_warning',
    priority: 'high',
    read: false,
    createdAt: '2026-05-19T09:15:00Z',
    relatedId: 'TKT-002',
    sender: '系统',
  },
  {
    id: 'N004',
    title: '被 @提及',
    content: '张伟在 TKT-001 的评论中 @了你：请帮忙确认监控数据',
    type: 'comment_mention',
    priority: 'medium',
    read: false,
    createdAt: '2026-05-19T09:30:00Z',
    relatedId: 'TKT-001',
    sender: '张伟',
  },
  {
    id: 'N005',
    title: 'Pipeline 完成',
    content: 'Pipeline api-service-build 执行成功，耗时 5m 12s',
    type: 'pipeline_completed',
    priority: 'low',
    read: true,
    createdAt: '2026-05-19T08:00:00Z',
    relatedId: 'PL-123',
    sender: 'CI Bot',
  },
  {
    id: 'N006',
    title: '工单转派请求',
    content: '李娜将工单 TKT-003 转派给您: API 网关 502 错误率上升',
    type: 'transfer_request',
    priority: 'high',
    read: true,
    createdAt: '2026-05-19T07:45:00Z',
    relatedId: 'TKT-003',
    sender: '李娜',
    actions: [
      { label: '接受', type: 'primary' },
      { label: '拒绝', type: 'default' },
    ],
  },
  {
    id: 'N007',
    title: 'SLA 已违约',
    content: '工单 TKT-008 已超过 SLA 时限 2 小时，请立即处理',
    type: 'sla_breached',
    priority: 'critical',
    read: false,
    createdAt: '2026-05-19T06:00:00Z',
    relatedId: 'TKT-008',
    sender: '系统',
  },
  {
    id: 'N008',
    title: '系统告警',
    content: 'Event Bus 服务延迟超过阈值，当前 156ms（阈值 100ms）',
    type: 'system_alert',
    priority: 'high',
    read: true,
    createdAt: '2026-05-19T05:30:00Z',
    relatedId: 'ALT-456',
    sender: '监控',
  },
  // --- 批量扩展数据用于分页测试 ---
  { id: 'N009', title: '新工单分配', content: '工单 TKT-009: 前端页面加载缓慢，LCP 超过 4s', type: 'ticket_assigned', priority: 'medium', read: false, createdAt: '2026-05-19T04:20:00Z', relatedId: 'TKT-009', sender: '系统' },
  { id: 'N010', title: 'Pipeline 完成', content: 'Pipeline frontend-build 执行成功，耗时 3m 45s', type: 'pipeline_completed', priority: 'low', read: true, createdAt: '2026-05-19T04:00:00Z', relatedId: 'PL-124', sender: 'CI Bot' },
  { id: 'N011', title: 'SLA 警告', content: '工单 TKT-010 即将超过 SLA 时限（剩余 15 分钟）', type: 'sla_warning', priority: 'high', read: false, createdAt: '2026-05-19T03:45:00Z', relatedId: 'TKT-010', sender: '系统' },
  { id: 'N012', title: '系统告警', content: 'Redis 集群内存使用率达到 85%', type: 'system_alert', priority: 'high', read: false, createdAt: '2026-05-19T03:30:00Z', relatedId: 'ALT-457', sender: '监控' },
  { id: 'N013', title: '工单升级提醒', content: '工单 TKT-011 已超过 4 小时未处理，已升级到 L3', type: 'ticket_escalated', priority: 'critical', read: false, createdAt: '2026-05-19T03:00:00Z', relatedId: 'TKT-011', sender: '系统' },
  { id: 'N014', title: '被 @提及', content: '王磊在 PR-234 的评论中 @了你：需要确认 API 兼容性', type: 'comment_mention', priority: 'low', read: true, createdAt: '2026-05-19T02:30:00Z', relatedId: 'PR-234', sender: '王磊' },
  { id: 'N015', title: 'Pipeline 完成', content: 'Pipeline payment-service-deploy 执行成功，耗时 8m 20s', type: 'pipeline_completed', priority: 'low', read: true, createdAt: '2026-05-19T02:00:00Z', relatedId: 'PL-125', sender: 'CI Bot' },
  { id: 'N016', title: '新工单分配', content: '工单 TKT-012: 订单支付接口偶尔返回 500 错误', type: 'ticket_assigned', priority: 'high', read: false, createdAt: '2026-05-19T01:30:00Z', relatedId: 'TKT-012', sender: '系统' },
  { id: 'N017', title: 'SLA 已违约', content: '工单 TKT-013 已超过 SLA 时限 4 小时', type: 'sla_breached', priority: 'critical', read: false, createdAt: '2026-05-19T01:00:00Z', relatedId: 'TKT-013', sender: '系统' },
  { id: 'N018', title: '工单转派请求', content: '赵强将工单 TKT-014 转派给您: 日志收集服务异常', type: 'transfer_request', priority: 'medium', read: true, createdAt: '2026-05-19T00:30:00Z', relatedId: 'TKT-014', sender: '赵强' },
  { id: 'N019', title: '系统告警', content: 'K8s 节点 node-03 磁盘使用率超过 90%', type: 'system_alert', priority: 'critical', read: false, createdAt: '2026-05-19T00:00:00Z', relatedId: 'ALT-458', sender: '监控' },
  { id: 'N020', title: 'Pipeline 完成', content: 'Pipeline user-service-build 执行成功，耗时 4m 10s', type: 'pipeline_completed', priority: 'low', read: true, createdAt: '2026-05-18T23:30:00Z', relatedId: 'PL-126', sender: 'CI Bot' },
  { id: 'N021', title: '新工单分配', content: '工单 TKT-015: 用户登录偶尔失败，返回 401', type: 'ticket_assigned', priority: 'high', read: false, createdAt: '2026-05-18T23:00:00Z', relatedId: 'TKT-015', sender: '系统' },
  { id: 'N022', title: 'SLA 警告', content: '工单 TKT-016 即将超过 SLA 时限（剩余 45 分钟）', type: 'sla_warning', priority: 'medium', read: false, createdAt: '2026-05-18T22:30:00Z', relatedId: 'TKT-016', sender: '系统' },
  { id: 'N023', title: '被 @提及', content: '刘洋在 TKT-012 的评论中 @了你：这个问题可能与缓存有关', type: 'comment_mention', priority: 'medium', read: false, createdAt: '2026-05-18T22:00:00Z', relatedId: 'TKT-012', sender: '刘洋' },
  { id: 'N024', title: '工单升级提醒', content: '工单 TKT-017 已超过 1 小时未处理，已升级到 L2', type: 'ticket_escalated', priority: 'high', read: true, createdAt: '2026-05-18T21:30:00Z', relatedId: 'TKT-017', sender: '系统' },
  { id: 'N025', title: '系统告警', content: 'API 网关响应时间超过 P99 阈值，当前 890ms', type: 'system_alert', priority: 'high', read: true, createdAt: '2026-05-18T21:00:00Z', relatedId: 'ALT-459', sender: '监控' },
  { id: 'N026', title: 'Pipeline 完成', content: 'Pipeline notification-service-build 执行成功，耗时 3m 55s', type: 'pipeline_completed', priority: 'low', read: true, createdAt: '2026-05-18T20:30:00Z', relatedId: 'PL-127', sender: 'CI Bot' },
  { id: 'N027', title: '新工单分配', content: '工单 TKT-018: 通知推送服务偶发延迟', type: 'ticket_assigned', priority: 'medium', read: true, createdAt: '2026-05-18T20:00:00Z', relatedId: 'TKT-018', sender: '系统' },
  { id: 'N028', title: 'SLA 已违约', content: '工单 TKT-019 已超过 SLA 时限 1 小时', type: 'sla_breached', priority: 'critical', read: false, createdAt: '2026-05-18T19:30:00Z', relatedId: 'TKT-019', sender: '系统' },
  { id: 'N029', title: '工单转派请求', content: '陈静将工单 TKT-020 转派给您: 数据库慢查询', type: 'transfer_request', priority: 'high', read: true, createdAt: '2026-05-18T19:00:00Z', relatedId: 'TKT-020', sender: '陈静' },
  { id: 'N030', title: '系统告警', content: 'Prometheus 存储空间不足，剩余 5GB', type: 'system_alert', priority: 'high', read: true, createdAt: '2026-05-18T18:30:00Z', relatedId: 'ALT-460', sender: '监控' },
  { id: 'N031', title: 'Pipeline 完成', content: 'Pipeline gateway-service-deploy 执行成功，耗时 6m 30s', type: 'pipeline_completed', priority: 'low', read: true, createdAt: '2026-05-18T18:00:00Z', relatedId: 'PL-128', sender: 'CI Bot' },
  { id: 'N032', title: '新工单分配', content: '工单 TKT-021: 灰度发布流量分配异常', type: 'ticket_assigned', priority: 'medium', read: true, createdAt: '2026-05-18T17:30:00Z', relatedId: 'TKT-021', sender: '系统' },
  { id: 'N033', title: 'SLA 警告', content: '工单 TKT-022 即将超过 SLA 时限（剩余 20 分钟）', type: 'sla_warning', priority: 'high', read: false, createdAt: '2026-05-18T17:00:00Z', relatedId: 'TKT-022', sender: '系统' },
  { id: 'N034', title: '被 @提及', content: '马超在文档《系统架构设计 v2》中 @了你：请评审', type: 'comment_mention', priority: 'low', read: true, createdAt: '2026-05-18T16:30:00Z', relatedId: 'DOC-045', sender: '马超' },
  { id: 'N035', title: '工单升级提醒', content: '工单 TKT-023 已超过 3 小时未处理，已升级到 L3', type: 'ticket_escalated', priority: 'critical', read: false, createdAt: '2026-05-18T16:00:00Z', relatedId: 'TKT-023', sender: '系统' },
  { id: 'N036', title: '系统告警', content: 'Grafana 面板加载超时，请检查数据源连接', type: 'system_alert', priority: 'medium', read: true, createdAt: '2026-05-18T15:30:00Z', relatedId: 'ALT-461', sender: '监控' },
  { id: 'N037', title: 'Pipeline 完成', content: 'Pipeline auth-service-build 执行成功，耗时 4m 45s', type: 'pipeline_completed', priority: 'low', read: true, createdAt: '2026-05-18T15:00:00Z', relatedId: 'PL-129', sender: 'CI Bot' },
  { id: 'N038', title: '新工单分配', content: '工单 TKT-024: 租户隔离策略配置错误', type: 'ticket_assigned', priority: 'high', read: true, createdAt: '2026-05-18T14:30:00Z', relatedId: 'TKT-024', sender: '系统' },
  { id: 'N039', title: 'SLA 已违约', content: '工单 TKT-025 已超过 SLA 时限 3 小时', type: 'sla_breached', priority: 'critical', read: true, createdAt: '2026-05-18T14:00:00Z', relatedId: 'TKT-025', sender: '系统' },
  { id: 'N040', title: '工单转派请求', content: '黄磊将工单 TKT-026 转派给您: CI 缓存清理', type: 'transfer_request', priority: 'low', read: true, createdAt: '2026-05-18T13:30:00Z', relatedId: 'TKT-026', sender: '黄磊' },
  { id: 'N041', title: '系统告警', content: '向量数据库查询延迟突增，P95 达到 350ms', type: 'system_alert', priority: 'high', read: false, createdAt: '2026-05-18T13:00:00Z', relatedId: 'ALT-462', sender: '监控' },
  { id: 'N042', title: 'Pipeline 完成', content: 'Pipeline pipeline-engine-build 执行成功，耗时 5m 30s', type: 'pipeline_completed', priority: 'low', read: true, createdAt: '2026-05-18T12:30:00Z', relatedId: 'PL-130', sender: 'CI Bot' },
  { id: 'N043', title: '新工单分配', content: '工单 TKT-027: AI 网关 Token 限额即将耗尽', type: 'ticket_assigned', priority: 'high', read: false, createdAt: '2026-05-18T12:00:00Z', relatedId: 'TKT-027', sender: '系统' },
  { id: 'N044', title: 'SLA 警告', content: '工单 TKT-028 即将超过 SLA 时限（剩余 10 分钟）', type: 'sla_warning', priority: 'critical', read: false, createdAt: '2026-05-18T11:30:00Z', relatedId: 'TKT-028', sender: '系统' },
  { id: 'N045', title: '被 @提及', content: '孙丽在 Sprint 回顾文档中 @了你：请补充反馈', type: 'comment_mention', priority: 'medium', read: false, createdAt: '2026-05-18T11:00:00Z', relatedId: 'DOC-046', sender: '孙丽' },
  { id: 'N046', title: '工单升级提醒', content: '工单 TKT-029 已超过 30 分钟未响应，已升级到 L2', type: 'ticket_escalated', priority: 'high', read: true, createdAt: '2026-05-18T10:30:00Z', relatedId: 'TKT-029', sender: '系统' },
  { id: 'N047', title: '系统告警', content: '混沌工程测试实例超时，请检查资源配额', type: 'system_alert', priority: 'medium', read: true, createdAt: '2026-05-18T10:00:00Z', relatedId: 'ALT-463', sender: '监控' },
  { id: 'N048', title: 'Pipeline 完成', content: 'Pipeline monitoring-service-build 执行成功，耗时 4m 15s', type: 'pipeline_completed', priority: 'low', read: true, createdAt: '2026-05-18T09:30:00Z', relatedId: 'PL-131', sender: 'CI Bot' },
  { id: 'N049', title: '新工单分配', content: '工单 TKT-030: FinOps 成本分析报告数据不准确', type: 'ticket_assigned', priority: 'medium', read: true, createdAt: '2026-05-18T09:00:00Z', relatedId: 'TKT-030', sender: '系统' },
  { id: 'N050', title: 'SLA 已违约', content: '工单 TKT-031 已超过 SLA 时限 5 小时', type: 'sla_breached', priority: 'critical', read: true, createdAt: '2026-05-18T08:30:00Z', relatedId: 'TKT-031', sender: '系统' },
  { id: 'N051', title: '工单转派请求', content: '周杰将工单 TKT-032 转派给您: 知识库搜索优化', type: 'transfer_request', priority: 'low', read: true, createdAt: '2026-05-18T08:00:00Z', relatedId: 'TKT-032', sender: '周杰' },
  { id: 'N052', title: '系统告警', content: 'IaC 模块 Terraform 状态锁未释放', type: 'system_alert', priority: 'high', read: false, createdAt: '2026-05-18T07:30:00Z', relatedId: 'ALT-464', sender: '监控' },
  { id: 'N053', title: 'Pipeline 完成', content: 'Pipeline compliance-check 执行成功，耗时 7m 40s', type: 'pipeline_completed', priority: 'low', read: true, createdAt: '2026-05-18T07:00:00Z', relatedId: 'PL-132', sender: 'CI Bot' },
  { id: 'N054', title: '新工单分配', content: '工单 TKT-033: 安全扫描发现 3 个高危漏洞', type: 'ticket_assigned', priority: 'critical', read: false, createdAt: '2026-05-18T06:30:00Z', relatedId: 'TKT-033', sender: '系统' },
  { id: 'N055', title: 'SLA 警告', content: '工单 TKT-034 即将超过 SLA 时限（剩余 25 分钟）', type: 'sla_warning', priority: 'high', read: false, createdAt: '2026-05-18T06:00:00Z', relatedId: 'TKT-034', sender: '系统' },
];

export const mockNotificationStats = {
  unread: 22,
  critical: 8,
  today: 35,
  thisWeek: 55,
};
