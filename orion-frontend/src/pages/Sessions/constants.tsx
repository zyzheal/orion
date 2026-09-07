/**
 * Sessions constants
 * 抽取自 index.tsx (P2-9 Phase 130)
 */
import React from 'react';
import { CheckCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons';
import type { SessionStatus } from './types';

export const statusColorMap: Record<SessionStatus, string> = {
  active: 'success',
  expired: 'default',
  revoked: 'error',
};

export const statusLabelMap: Record<SessionStatus, string> = {
  active: '活跃',
  expired: '已过期',
  revoked: '已撤销',
};

export const statusIconMap: Record<SessionStatus, React.ReactNode> = {
  active: <CheckCircleOutlined />,
  expired: <ClockCircleOutlined />,
  revoked: <StopOutlined />,
};

export const statusFilterOptions = [
  { label: '全部', value: 'all' },
  { label: '活跃', value: 'active' },
  { label: '已过期', value: 'expired' },
  { label: '已撤销', value: 'revoked' },
];
