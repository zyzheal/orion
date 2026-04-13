/**
 * Mock data for Notification System
 * - Notifications with various types and priorities
 * - Notification stats summary
 */

export interface MockNotification {
  id: string;
  title: string;
  content: string;
  type: 'ticket_assigned' | 'ticket_escalated' | 'sla_warning' | 'sla_breached' | 'pipeline_completed' | 'system_alert' | 'comment_mention' | 'transfer_request';
  priority: 'critical' | 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: string;
  relatedId?: string;  // ticket ID, pipeline ID, etc.
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
    createdAt: '2026-04-13T08:35:00Z',
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
    createdAt: '2026-04-13T09:00:00Z',
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
    createdAt: '2026-04-13T09:15:00Z',
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
    createdAt: '2026-04-13T09:30:00Z',
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
    createdAt: '2026-04-13T08:00:00Z',
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
    createdAt: '2026-04-13T07:45:00Z',
    relatedId: 'TKT-003',
    sender: '李娜',
    actions: [{ label: '接受', type: 'primary' }, { label: '拒绝', type: 'default' }],
  },
  {
    id: 'N007',
    title: 'SLA 已违约',
    content: '工单 TKT-008 已超过 SLA 时限 2 小时，请立即处理',
    type: 'sla_breached',
    priority: 'critical',
    read: false,
    createdAt: '2026-04-13T06:00:00Z',
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
    createdAt: '2026-04-13T05:30:00Z',
    relatedId: 'ALT-456',
    sender: '监控',
  },
];

export const mockNotificationStats = {
  unread: 4,
  critical: 2,
  today: 6,
  thisWeek: 8,
};
