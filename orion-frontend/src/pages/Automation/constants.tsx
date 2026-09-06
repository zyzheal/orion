/**
 * Automation Constants & Helpers
 */
import React from 'react';
import { colors } from '@/tokens';
import {
  ThunderboltOutlined,
  SettingOutlined,
  FolderOpenOutlined,
  RocketOutlined,
} from '@ant-design/icons';

export const JOB_TYPE_MAP: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  script: { color: colors.info[500], label: '脚本', icon: <ThunderboltOutlined /> },
  tool: { color: colors.purple[500], label: '工具调用', icon: <SettingOutlined /> },
  composite: { color: colors.warning[500], label: '复合工具', icon: <FolderOpenOutlined /> },
  api: { color: colors.success[500], label: 'API 调用', icon: <RocketOutlined /> },
};

export const JOB_STATUS_MAP: Record<string, { color: string; label: string }> = {
  idle: { color: colors.neutral[400], label: '待执行' },
  running: { color: colors.primary[500], label: '执行中' },
  succeeded: { color: colors.success[500], label: '成功' },
  failed: { color: colors.error[500], label: '失败' },
  cancelled: { color: colors.warning[500], label: '已取消' },
};

export const EXEC_STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: colors.neutral[400], label: '等待中' },
  running: { color: colors.primary[500], label: '执行中' },
  completed: { color: colors.success[500], label: '完成' },
  failed: { color: colors.error[500], label: '失败' },
  cancelled: { color: colors.warning[500], label: '已取消' },
};

export const JOB_TYPE_OPTIONS = Object.entries(JOB_TYPE_MAP).map(([value, { label }]) => ({
  label,
  value,
}));
export const JOB_STATUS_OPTIONS = Object.entries(JOB_STATUS_MAP).map(([value, { label }]) => ({
  label,
  value,
}));

export function parseJSON(val: string): Record<string, unknown> {
  if (!val || typeof val !== 'string') return {};
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
