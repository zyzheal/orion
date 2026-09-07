/**
 * ServiceRegistry constants
 * 抽取自 index.tsx (P2-9 Phase 142)
 */
import React from 'react';
import { colors } from '@/tokens';

export const HEALTH_STATUS_CONFIG: Record<
  string,
  { color: string; label: string; icon?: React.ReactNode }
> = {
  healthy: { color: colors.success[500], label: '健康' },
  unhealthy: { color: colors.error[500], label: '异常' },
  degraded: { color: colors.warning[500], label: '降级' },
  unknown: { color: colors.neutral[500], label: '未知' },
};

export const PROTOCOL_COLOR_MAP: Record<string, string> = {
  http: 'blue',
  grpc: 'green',
  tcp: 'orange',
  custom: 'purple',
};

export const PROTOCOL_OPTIONS = [
  { value: 'http', label: 'HTTP' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'tcp', label: 'TCP' },
  { value: 'custom', label: 'Custom' },
];

export const HEALTH_OPTIONS = [
  { value: 'healthy', label: '健康' },
  { value: 'unhealthy', label: '异常' },
  { value: 'degraded', label: '降级' },
  { value: 'unknown', label: '未知' },
];
