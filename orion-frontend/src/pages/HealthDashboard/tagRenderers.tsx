/**
 * Tag renderer helpers
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import React from 'react';
import { Tag } from 'antd';
import { colors } from '@/tokens';
import { severityMap, alertStatusMap, serviceStatusMap } from './constants';

export const severityTag = (severity: string): React.ReactNode => {
  const cfg = severityMap[severity] ?? severityMap.info;
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
};

export const statusTag = (status: string): React.ReactNode => {
  const cfg = alertStatusMap[status] ?? { color: colors.neutral[400], text: status };
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
};

export const serviceStatusTag = (status: string): React.ReactNode => {
  const cfg = serviceStatusMap[status] ?? { color: colors.neutral[400], text: status };
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
};
