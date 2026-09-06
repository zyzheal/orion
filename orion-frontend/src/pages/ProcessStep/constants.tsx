/**
 * constants.tsx - 流程引擎常量与辅助函数
 * 抽取自 ProcessStep/index.tsx (P2-9 Phase 96)
 */
import React from 'react';
import {
  ForwardOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  UndoOutlined,
} from '@ant-design/icons';

export const statusColor: Record<string, string> = {
  draft: 'default',
  pending: 'processing',
  running: 'processing',
  success: 'success',
  failed: 'error',
  paused: 'warning',
  aborted: 'default',
  wait: 'warning',
  retry: 'warning',
  rejected: 'error',
  skip: 'default',
  close: 'default',
  completed: 'success',
};

export const statusLabel: Record<string, string> = {
  draft: '草稿',
  pending: '待处理',
  running: '运行中',
  success: '成功',
  failed: '失败',
  paused: '已暂停',
  aborted: '已中止',
  wait: '等待中',
  retry: '重试中',
  rejected: '已拒绝',
  skip: '已跳过',
  close: '已关闭',
  completed: '已完成',
};

export const actionLabel: Record<string, string> = {
  pending: '提交',
  running: '启动',
  success: '完成',
  failed: '失败',
  paused: '暂停',
  aborted: '中止',
  wait: '等待',
  retry: '重试',
  rejected: '拒绝',
  close: '关闭',
};

export const actionIcon: Record<string, React.ReactNode> = {
  pending: <ForwardOutlined />,
  running: <PlayCircleOutlined />,
  success: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  paused: <PauseCircleOutlined />,
  aborted: <StopOutlined />,
  wait: <PauseCircleOutlined />,
  retry: <UndoOutlined />,
  rejected: <CloseCircleOutlined />,
  close: <StopOutlined />,
};

export const stepTypeLabel: Record<string, string> = {
  auto: '自动',
  manual: '手动',
  approval: '审批',
  script: '脚本',
};

export const getAllowedActions = (status: string): string[] => {
  const transitions: Record<string, string[]> = {
    draft: ['pending', 'aborted'],
    pending: ['running', 'rejected'],
    running: ['success', 'failed', 'paused', 'wait', 'retry'],
    success: ['close'],
    failed: ['retry', 'close'],
    paused: ['running', 'aborted'],
    aborted: ['close'],
    wait: ['running'],
    retry: ['running', 'failed'],
    rejected: ['pending', 'close'],
  };
  return transitions[status] || [];
};

export const getTimelineColor = (status: string): string => {
  if (status === 'success' || status === 'completed') return 'green';
  if (status === 'failed' || status === 'rejected') return 'red';
  if (status === 'running' || status === 'pending') return 'blue';
  if (status === 'paused' || status === 'wait') return 'orange';
  return 'gray';
};
