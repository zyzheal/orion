/**
 * constants.tsx - 熔断器状态常量
 * 抽取自 CircuitBreakerPage.tsx (P2-9 Phase 81)
 */
import React from 'react';
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import type { CircuitState } from '@/api/circuit-breaker';

export const stateColor: Record<CircuitState, string> = {
  closed: colors.success[500],
  open: colors.error[500],
  'half-open': colors.warning[500],
};

export const stateLabel: Record<CircuitState, string> = {
  closed: '正常',
  open: '熔断',
  'half-open': '半开',
};

export const stateIcon: Record<CircuitState, React.ReactNode> = {
  closed: <CheckCircleOutlined />,
  open: <CloseCircleOutlined />,
  'half-open': <SyncOutlined spin />,
};
