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
import { colors } from '@/tokens';

// Icon mapping for notification types
export const typeIconMap: Record<string, React.ReactElement> = {
  ticket_assigned: <UserAddOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
  ticket_escalated: <ArrowUpOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
  sla_warning: <WarningOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
  sla_breached: <ExclamationCircleOutlined style={{ fontSize: 24, color: colors.error[500] }} />,
  pipeline_completed: <CheckCircleOutlined style={{ fontSize: 24, color: colors.success[500] }} />,
  comment_mention: <MessageOutlined style={{ fontSize: 24, color: colors.purple[500] }} />,
  transfer_request: <SwapOutlined style={{ fontSize: 24, color: colors.info[500] }} />,
  system_alert: <AlertOutlined style={{ fontSize: 24, color: colors.error[500] }} />,
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
