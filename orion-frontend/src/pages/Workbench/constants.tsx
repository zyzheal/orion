/**
 * constants.tsx - Workbench 常量与工具函数
 * 抽取自 Workbench/WorkbenchPage.tsx (P2-9 Phase 65)
 */
import React from 'react';
import { Badge } from 'antd';
import { colors } from '@/tokens';

export const COLORS = {
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.primary[500],
  purple: colors.purple[500],
  cyan: colors.info[500],
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusMap: Record<string, { color: string; text: string }> = {
    success: { color: 'success', text: '成功' },
    failed: { color: 'error', text: '失败' },
    running: { color: 'processing', text: '运行中' },
    pending: { color: 'default', text: '等待中' },
    cancelled: { color: 'default', text: '已取消' },
    deploying: { color: 'processing', text: '部署中' },
    rolled_back: { color: 'error', text: '已回滚' },
  };
  const { color, text } = statusMap[status] || { color: 'default', text: status };
  return (
    <Badge
      status={color as 'success' | 'error' | 'processing' | 'warning' | 'default'}
      text={text}
    />
  );
};

export const severityColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
      return COLORS.error;
    case 'warning':
      return COLORS.warning;
    case 'info':
      return COLORS.info;
    default:
      return colors.neutral[400];
  }
};

export const severityName = (severity: string): string => {
  const names: Record<string, string> = {
    critical: '严重',
    warning: '警告',
    info: '信息',
  };
  return names[severity] || severity;
};

export const priorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical':
    case 'urgent':
      return COLORS.error;
    case 'high':
      return COLORS.warning;
    case 'medium':
      return COLORS.info;
    case 'low':
      return COLORS.success;
    default:
      return colors.neutral[400];
  }
};

export const priorityName = (priority: string): string => {
  const names: Record<string, string> = {
    critical: '紧急',
    urgent: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  };
  return names[priority] || priority;
};

export const envColor = (env: string): string => {
  switch (env) {
    case 'prod':
    case 'production':
      return COLORS.error;
    case 'staging':
    case 'pre-prod':
      return COLORS.warning;
    case 'dev':
    case 'development':
      return COLORS.info;
    default:
      return colors.neutral[400];
  }
};

export const envName = (env: string): string => {
  const names: Record<string, string> = {
    prod: '生产',
    production: '生产',
    staging: '预发',
    'pre-prod': '预发',
    dev: '开发',
    development: '开发',
  };
  return names[env] || env;
};

export const formatDuration = (ms: number): string => {
  if (!ms) return '-';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.round((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

export const formatSlaRemaining = (hours: number): { text: string; color: string } => {
  if (hours < 0) {
    return { text: `超时 ${Math.abs(hours)}h`, color: COLORS.error };
  }
  if (hours < 4) {
    return { text: `${hours}h`, color: COLORS.warning };
  }
  return { text: `${hours}h`, color: 'inherit' };
};
