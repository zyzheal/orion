/**
 * NotificationCenter - Configuration constants
 *
 * Pure data (no JSX) so this file can live as `.ts`.
 * Icons are built with `React.createElement` to keep the file JSX-free.
 * All colours/sizes come from the design token system (`@/tokens`).
 */
import { createElement } from 'react';
import { colors, spacing } from '@/tokens';
import {
  BellOutlined,
  UserAddOutlined,
  ArrowUpOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  SwapOutlined,
  AlertOutlined,
  SoundOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { NotificationPriority, NotificationType } from './types';

export { BellOutlined, SettingOutlined, SoundOutlined };

// ============================================================================
// Icon mapping for notification types
// ============================================================================

const typeIconStyle = (color: string): React.CSSProperties => ({
  color,
  fontSize: spacing[5],
});

export const typeIconMap: Record<string, React.ReactElement> = {
  ticket_assigned: createElement(UserAddOutlined, { style: typeIconStyle(colors.primary[500]) }),
  ticket_escalated: createElement(ArrowUpOutlined, { style: typeIconStyle(colors.warning[500]) }),
  sla_warning: createElement(WarningOutlined, { style: typeIconStyle(colors.warning[500]) }),
  sla_breached: createElement(ExclamationCircleOutlined, {
    style: typeIconStyle(colors.error[500]),
  }),
  pipeline_completed: createElement(CheckCircleOutlined, {
    style: typeIconStyle(colors.success[500]),
  }),
  comment_mention: createElement(MessageOutlined, { style: typeIconStyle(colors.purple[500]) }),
  transfer_request: createElement(SwapOutlined, { style: typeIconStyle(colors.info[500]) }),
  system_alert: createElement(AlertOutlined, { style: typeIconStyle(colors.error[500]) }),
};

// ============================================================================
// Type label mapping
// ============================================================================

export const typeLabelMap: Record<NotificationType, string> = {
  ticket_assigned: '工单分配',
  ticket_escalated: '工单升级',
  sla_warning: 'SLA 警告',
  sla_breached: 'SLA 违约',
  pipeline_completed: 'Pipeline 完成',
  system_alert: '系统告警',
  comment_mention: '评论提及',
  transfer_request: '转派请求',
};

// ============================================================================
// Priority config
// ============================================================================

export interface PriorityConfigEntry {
  color: string;
  label: string;
  bg: string;
}

export const priorityConfig: Record<NotificationPriority, PriorityConfigEntry> = {
  critical: { color: colors.error[500], label: '紧急', bg: 'rgba(245, 34, 45, 0.04)' },
  high: { color: colors.warning[500], label: '高', bg: 'rgba(250, 140, 22, 0.04)' },
  medium: { color: colors.warning[500], label: '中', bg: 'transparent' },
  low: { color: colors.neutral[300], label: '低', bg: 'transparent' },
};

// ============================================================================
// Tab definitions
// ============================================================================

export interface TabDefinition {
  key: string;
  label: string;
}

export const tabDefinitions: TabDefinition[] = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'tickets', label: '工单' },
  { key: 'system', label: '系统' },
  { key: 'read', label: '已读' },
];

// ============================================================================
// Pagination
// ============================================================================

export const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];
export const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Broadcast options
// ============================================================================

export const BROADCAST_AUDIENCE_OPTIONS = [
  { label: '全体用户', value: 'all' },
  { label: '指定用户', value: 'specific' },
];

export const BROADCAST_PRIORITY_OPTIONS = [
  { label: '紧急', value: 'critical' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

// Broadcast messages are always delivered as system alerts regardless of the
// selected priority label, mirroring the original inline `typeMap`.
export const broadcastPriorityToType: Record<string, string> = {
  critical: 'system_alert',
  high: 'system_alert',
  medium: 'system_alert',
  low: 'system_alert',
};

// ============================================================================
// Notification settings drawer option groups
// ============================================================================

export type SettingsKey =
  | 'emailEnabled'
  | 'soundEnabled'
  | 'desktopEnabled'
  | 'ticketAssigned'
  | 'ticketEscalated'
  | 'slaWarning'
  | 'slaBreached'
  | 'pipelineCompleted'
  | 'systemAlert'
  | 'commentMention'
  | 'transferRequest';

export interface SettingOption {
  key: SettingsKey;
  label: string;
}

export const channelSettingOptions: SettingOption[] = [
  { key: 'emailEnabled', label: '邮件通知' },
  { key: 'soundEnabled', label: '声音提醒' },
  { key: 'desktopEnabled', label: '桌面推送' },
];

export const eventSettingOptions: SettingOption[] = [
  { key: 'ticketAssigned', label: '工单分配' },
  { key: 'ticketEscalated', label: '工单升级' },
  { key: 'slaWarning', label: 'SLA 警告' },
  { key: 'slaBreached', label: 'SLA 违约' },
  { key: 'pipelineCompleted', label: 'Pipeline 完成' },
  { key: 'systemAlert', label: '系统告警' },
  { key: 'commentMention', label: '评论提及' },
  { key: 'transferRequest', label: '转派请求' },
];
