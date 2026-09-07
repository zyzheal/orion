/**
 * ManagerDashboard TrendIndicator
 * 抽取自 index.tsx (P2-9 Phase 181)
 */
import React from 'react';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import { COLORS } from '../constants';

export const TrendIndicator: React.FC<{ trend: 'improving' | 'stable' | 'declining' }> = ({
  trend,
}) => {
  if (trend === 'improving') {
    return <ArrowUpOutlined style={{ color: COLORS.success }} />;
  }
  if (trend === 'declining') {
    return <ArrowDownOutlined style={{ color: COLORS.error }} />;
  }
  return <MinusOutlined style={{ color: colors.neutral[400] }} />;
};
