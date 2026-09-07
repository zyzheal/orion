/**
 * AgentRunDetail constants
 * 抽取自 index.tsx (P2-9 Phase 120)
 */
import React from 'react';
import {
  FileTextOutlined,
  CodeOutlined,
  ExperimentOutlined,
  SyncOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

export const statusToBadge: Record<
  string,
  'running' | 'pending' | 'success' | 'failed' | 'warning' | 'cancelled' | 'unknown'
> = {
  running: 'running',
  completed: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
  waiting_approval: 'warning',
};

export const actionIconMap: Record<string, React.ReactNode> = {
  read_file: <FileTextOutlined />,
  write_code: <CodeOutlined />,
  run_test: <ExperimentOutlined />,
  create_pr: <SyncOutlined />,
  request_approval: <WarningOutlined />,
};

export const defaultActionIcon = <ThunderboltOutlined />;
