/**
 * ITSM Self-Service Portal — configuration constants
 *
 * Extracted from index.tsx: category icon map, priority / ticket status /
 * service status mappings, priority form options and request form defaults.
 */
import React from 'react';
import {
  InboxOutlined,
  AppstoreOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SendOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

/** 状态/优先级 → 标签或徽标配置 */
export type StatusTagConfig = { color: string; label: string };

/** 服务分类 → 图标映射 */
export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  infrastructure: <InboxOutlined />,
  application: <AppstoreOutlined />,
  database: <SyncOutlined />,
  network: <ExclamationCircleOutlined />,
  security: <CheckCircleOutlined />,
  deployment: <SendOutlined />,
  pipeline: <FileTextOutlined />,
  performance: <ClockCircleOutlined />,
  cost: <CloseCircleOutlined />,
};

/** 优先级 → 颜色 + 中文标签映射 */
export const PRIORITY_CONFIG: Record<string, StatusTagConfig> = {
  critical: { color: colors.error[400], label: '紧急' },
  high: { color: colors.warning[500], label: '高' },
  medium: { color: colors.primary[500], label: '中' },
  low: { color: colors.neutral[500], label: '低' },
};

/** 工单状态 → 徽标颜色 + 中文标签映射 */
export const TICKET_STATUS_CONFIG: Record<string, StatusTagConfig> = {
  pending: { color: 'blue', label: '待审批' },
  approved: { color: 'cyan', label: '已批准' },
  in_progress: { color: 'orange', label: '处理中' },
  fulfilled: { color: 'success', label: '已完成' },
  rejected: { color: 'error', label: '已拒绝' },
  cancelled: { color: 'default', label: '已取消' },
};

/** 服务状态 → 标签颜色 + 中文标签映射 */
export const SERVICE_STATUS_CONFIG: Record<string, StatusTagConfig> = {
  active: { color: 'success', label: '可用' },
  inactive: { color: 'default', label: '不可用' },
};

/** 请求表单优先级选项（用于请求弹窗的优先级下拉） */
export const PRIORITY_OPTIONS = [
  { value: 'critical', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
] as const;

/** 请求表单默认值 */
export const DEFAULT_REQUEST_VALUES = { priority: 'medium' };

/** 未匹配到配置项时的回退标签配置 */
export const DEFAULT_TAG_CONFIG: StatusTagConfig = {
  color: 'default',
  label: '',
};

/** 状态/优先级值 → 标签配置（未匹配时回退为 default 颜色 + 原值文案） */
export function tagConfig(config: Record<string, StatusTagConfig>, value: string) {
  return config[value] || { color: DEFAULT_TAG_CONFIG.color, label: value };
}
