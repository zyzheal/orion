/**
 * service-portal constants
 * 抽取自 index.tsx (P2-9 Phase 182)
 */
import React from 'react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';

export const HEALTH_STATUS: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  healthy: { color: 'green', icon: <CheckCircleOutlined />, label: '健康' },
  unhealthy: { color: 'red', icon: <CloseCircleOutlined />, label: '不健康' },
  degraded: { color: 'orange', icon: <WarningOutlined />, label: '降级' },
  unknown: { color: 'default', icon: <WarningOutlined />, label: '未知' },
};

export const PROTOCOL_OPTIONS = [
  { label: 'HTTP', value: 'http' },
  { label: 'gRPC', value: 'grpc' },
  { label: 'TCP', value: 'tcp' },
  { label: '自定义', value: 'custom' },
];
