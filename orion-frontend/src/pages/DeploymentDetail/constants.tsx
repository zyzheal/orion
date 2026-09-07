/**
 * DeploymentDetail constants
 * 抽取自 index.tsx (P2-9 Phase 168)
 */
import React from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

// Environment display config
export const envConfig: Record<string, { color: string; label: string }> = {
  prod: { color: 'red', label: '生产环境' },
  production: { color: 'red', label: '生产环境' },
  staging: { color: 'orange', label: '预发环境' },
  dev: { color: 'blue', label: '开发环境' },
  development: { color: 'blue', label: '开发环境' },
  test: { color: 'default', label: '测试环境' },
};

// Strategy display labels
export const strategyLabels: Record<string, string> = {
  rolling: '滚动更新 (Rolling)',
  'blue-green': '蓝绿部署 (Blue-Green)',
  canary: '金丝雀发布 (Canary)',
  recreate: '重建部署 (Recreate)',
};

// Health check status icon
export const healthCheckIcon: Record<string, React.ReactNode> = {
  healthy: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
  unhealthy: <CloseCircleOutlined style={{ color: colors.error[500] }} />,
  degraded: <QuestionCircleOutlined style={{ color: colors.warning[500] }} />,
  unknown: <InfoCircleOutlined style={{ color: colors.neutral[400] }} />,
};

// Stage progress status color
export const stageStatusColor: Record<string, string> = {
  success: colors.success[500],
  running: colors.primary[500],
  failed: colors.error[500],
  pending: colors.neutral[300],
};

// Format duration helper
export const formatDuration = (seconds?: number) => {
  if (!seconds) return '-';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
};
