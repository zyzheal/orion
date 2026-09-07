/**
 * Pipeline 重试与回滚相关常量
 * 抽取自 PipelineRetryRollback.tsx (P2-9 Phase 111)
 */
import React from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';

export const formatDuration = (seconds: number): string => {
  if (!seconds) return '-';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMin = minutes % 60;
    return `${hours}h ${remainingMin}m`;
  }
  return `${minutes}m ${secs}s`;
};

export const statusColorMap: Record<string, string> = {
  success: colors.success[500],
  failed: colors.error[500],
  running: colors.info[500],
  cancelled: colors.neutral[500],
  pending: colors.warning[500],
};

export const statusIconMap: Record<string, React.ReactNode> = {
  success: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  running: <LoadingOutlined />,
  cancelled: <ClockCircleOutlined />,
  pending: <InfoCircleOutlined />,
};

export const statusLabelMap: Record<string, string> = {
  success: '成功',
  failed: '失败',
  running: '运行中',
  cancelled: '已取消',
  pending: '等待中',
};

export const stageStatusColorMap: Record<string, string> = {
  success: colors.success[500],
  failed: colors.error[500],
  running: colors.info[500],
  pending: colors.neutral[500],
  skipped: colors.neutral[500],
};

export const mockRuns: any[] = [];
