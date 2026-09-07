/**
 * TestReport constants
 * 抽取自 index.tsx (P2-9 Phase 167)
 */
import React from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';

export const statusColor: Record<string, string> = {
  passed: 'green',
  failed: 'red',
  skipped: 'orange',
  error: 'red',
};

export const statusIcon: Record<string, React.ReactNode> = {
  passed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  skipped: <MinusCircleOutlined />,
  error: <CloseCircleOutlined />,
};

export const caseStatusOptions = [
  { label: '全部', value: 'all' },
  { label: '通过', value: 'passed' },
  { label: '失败', value: 'failed' },
  { label: '跳过', value: 'skipped' },
  { label: '错误', value: 'error' },
];
