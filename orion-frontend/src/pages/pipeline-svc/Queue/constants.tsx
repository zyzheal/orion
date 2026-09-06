/**
 * Queue Management 常量
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import React from 'react';
import {
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { JobStatus } from '@/api/queue';

export const statusColorMap: Record<JobStatus, string> = {
  pending: 'processing',
  processing: 'warning',
  completed: 'success',
  failed: 'error',
};

export const statusLabelMap: Record<JobStatus, string> = {
  pending: '等待中',
  processing: '处理中',
  completed: '已完成',
  failed: '已失败',
};

export const statusIconMap: Record<JobStatus, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  processing: <SyncOutlined spin />,
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
};

export const QUEUE_OPTIONS = [
  { label: 'pipeline-execution', value: 'pipeline-execution' },
  { label: 'deployment', value: 'deployment' },
  { label: 'notification', value: 'notification' },
  { label: 'artifact-scan', value: 'artifact-scan' },
];

export const STATUS_FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '等待中', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '已失败', value: 'failed' },
];

export const formatPayload = (payload: Record<string, unknown>): string => {
  return JSON.stringify(payload, null, 2);
};
