/**
 * NotificationCenter - constants
 * 通知中心静态配置
 *
 * 从 index.tsx 抽出的类型定义与静态映射，便于复用与单测。
 */
import React from 'react';
import {
  UserAddOutlined,
  ArrowUpOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  SwapOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

// ============================================================================
// Local type for notification data (matches API response shape)
// ============================================================================

export interface NotificationItem {
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
  relatedId?: string;
  sender: string;
  actions?: Array<{ label: string; type: string }>;
}

// ============================================================================
// Static config maps
// ============================================================================

// Icon mapping for notification types
export const typeIconMap: Record<string, React.ReactElement> = {
  ticket_assigned: <UserAddOutlined style={{ color: colors.primary[500], fontSize: spacing[5] }} />,
  ticket_escalated: (
    <ArrowUpOutlined style={{ color: colors.warning[500], fontSize: spacing[5] }} />
  ),
  sla_warning: <WarningOutlined style={{ color: colors.warning[500], fontSize: spacing[5] }} />,
  sla_breached: (
    <ExclamationCircleOutlined style={{ color: colors.error[500], fontSize: spacing[5] }} />
  ),
  pipeline_completed: (
    <CheckCircleOutlined style={{ color: colors.success[500], fontSize: spacing[5] }} />
  ),
  comment_mention: <MessageOutlined style={{ color: colors.purple[500], fontSize: spacing[5] }} />,
  transfer_request: <SwapOutlined style={{ color: colors.info[500], fontSize: spacing[5] }} />,
  system_alert: <AlertOutlined style={{ color: colors.error[500], fontSize: spacing[5] }} />,
};

// Type label mapping
export const typeLabelMap: Record<string, string> = {
  ticket_assigned: '工单分配',
  ticket_escalated: '工单升级',
  sla_warning: 'SLA 警告',
  sla_breached: 'SLA 违约',
  pipeline_completed: 'Pipeline 完成',
  system_alert: '系统告警',
  comment_mention: '评论提及',
  transfer_request: '转派请求',
};

// Priority config
export const priorityConfig: Record<string, { color: string; label: string; bg: string }> = {
  critical: { color: colors.error[500], label: '紧急', bg: 'rgba(245, 34, 45, 0.04)' },
  high: { color: colors.warning[500], label: '高', bg: 'rgba(250, 140, 22, 0.04)' },
  medium: { color: colors.warning[500], label: '中', bg: 'transparent' },
  low: { color: colors.neutral[300], label: '低', bg: 'transparent' },
};

// Tab definitions
export const tabDefinitions = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'tickets', label: '工单' },
  { key: 'system', label: '系统' },
  { key: 'read', label: '已读' },
];
