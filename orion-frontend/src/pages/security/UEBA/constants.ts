/**
 * UEBA constants
 * 抽取自 index.tsx (P2-9 Phase 135)
 */
import type { CSSProperties } from 'react';
import { colors } from '@/tokens';
import type { AnomalyType, DetectionMethod, EventStatus } from './types';

export const commonStyle = {
  primary: colors.primary[500],
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.info[500],
  neutral: colors.neutral[500],
  purple: colors.purple[500],
};

export const plainCardStyle: CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};

export const statCardStyle = (borderColor: string): CSSProperties => ({
  ...plainCardStyle,
  borderLeft: `3px solid ${borderColor}`,
});

export const anomalyTypeColor: Record<AnomalyType, string> = {
  异常登录: commonStyle.error,
  权限滥用: commonStyle.warning,
  数据外泄: commonStyle.purple,
  异常时间: commonStyle.info,
  高频操作: colors.warning[400],
};

export const methodColor: Record<DetectionMethod, string> = {
  IQR: colors.neutral[100],
  '3σ': colors.warning[50],
  'Z-Score': colors.purple[50],
};

export const statusTagProps: Record<EventStatus, { color: string; text: string }> = {
  待调查: { color: colors.neutral[400], text: '待调查' },
  已确认: { color: commonStyle.success, text: '已确认' },
  误报: { color: commonStyle.info, text: '误报' },
};
