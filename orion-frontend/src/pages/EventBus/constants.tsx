/**
 * EventBus Monitoring constants
 * 抽取自 index.tsx (P2-9 Phase 164)
 */
import React from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { EventStatus } from './types';

export const statusColorMap: Record<EventStatus, string> = {
  delivered: 'success',
  failed: 'error',
  pending: 'processing',
  retried: 'warning',
};

export const statusLabelMap: Record<EventStatus, string> = {
  delivered: '已投递',
  failed: '失败',
  pending: '待处理',
  retried: '重试中',
};

export const statusIconMap: Record<EventStatus, React.ReactNode> = {
  delivered: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  pending: <ClockCircleOutlined />,
  retried: <SwapOutlined />,
};

export const statusFilterOptions = [
  { label: '全部', value: 'all' },
  { label: '已投递', value: 'delivered' },
  { label: '失败', value: 'failed' },
  { label: '待处理', value: 'pending' },
  { label: '重试中', value: 'retried' },
];

export const formatPayloadSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
