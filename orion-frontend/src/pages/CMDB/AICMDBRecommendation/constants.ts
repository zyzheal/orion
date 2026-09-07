/**
 * AICMDBRecommendation constants
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
import { colors } from '@/tokens';
import type { RecommendationType, RecommendationStatus } from '@/api/cmdb';
import type { ModelStatus } from './types';

export const DEFAULT_MODEL_STATUS: ModelStatus = {
  version: '1.0.0',
  trainingDataCount: 0,
  accuracy: 0,
  lastTrainedAt: '-',
  accuracyTrend: [],
};

export const getConfidenceColor = (value: number): string => {
  if (value >= 90) return colors.success[500];
  if (value >= 70) return colors.primary[500];
  if (value >= 50) return colors.warning[500];
  return colors.error[500];
};

export const getConfidenceLabel = (
  value: number
): 'success' | 'processing' | 'warning' | 'error' => {
  if (value >= 90) return 'success';
  if (value >= 70) return 'processing';
  if (value >= 50) return 'warning';
  return 'error';
};

export const typeConfig: Record<RecommendationType, { label: string; color: string }> = {
  'auto-link': { label: '自动关联', color: colors.purple[500] },
  'attribute-fill': { label: '属性补全', color: colors.info[500] },
  'anomaly-detect': { label: '异常检测', color: colors.warning[500] },
  'topology-fix': { label: '拓扑修正', color: colors.success[500] },
};

export const statusConfig: Record<RecommendationStatus, { label: string; color: string }> = {
  pending: { label: '待确认', color: colors.neutral[500] },
  accepted: { label: '已采纳', color: colors.success[500] },
  rejected: { label: '已拒绝', color: colors.error[500] },
};

export const severityConfig: Record<string, { label: string; color: string }> = {
  critical: { label: '严重', color: colors.error[500] },
  high: { label: '高', color: colors.error[600] },
  medium: { label: '中', color: colors.warning[500] },
  low: { label: '低', color: colors.info[500] },
};
