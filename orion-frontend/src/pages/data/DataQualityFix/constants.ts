/**
 * DataQualityFix constants and mock data
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import type { ProblemType, Severity, Status, QualityIssue, RepairHistory, DimensionScore } from './types';

export const PROBLEM_TYPE_CONFIG: Record<ProblemType, { label: string; color: string }> = {
  null: { label: '空值', color: 'orange' },
  duplicate: { label: '重复', color: 'purple' },
  format: { label: '格式错误', color: 'red' },
  out_of_range: { label: '越界', color: 'blue' },
  inconsistent: { label: '不一致', color: 'gold' },
};

export const SEVERITY_CONFIG: Record<Severity, { label: string; color: string }> = {
  critical: { label: '严重', color: 'red' },
  high: { label: '高', color: 'orange' },
  medium: { label: '中', color: 'blue' },
  low: { label: '低', color: 'green' },
};

export const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'default' },
  processing: { label: '处理中', color: 'processing' },
  fixed: { label: '已修复', color: 'success' },
  ignored: { label: '忽略', color: 'default' },
};

export const MOCK_ISSUES: QualityIssue[] = [];

export const MOCK_DIMENSIONS: DimensionScore[] = [];

export const MOCK_TREND: number[] = [];
export const TREND_LABELS: string[] = [];

export const MOCK_REPAIR_HISTORY: RepairHistory[] = [];

export const RULE_COUNT = 42;
