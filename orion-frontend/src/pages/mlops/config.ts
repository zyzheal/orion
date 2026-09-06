/**
 * MLOps Page - Configuration Constants
 * Status color maps, Select options, form rules and shared style presets.
 */
import type { CSSProperties } from 'react';
import { colors, spacing } from '@/tokens';

// ============================================================================
// Status color maps
// ============================================================================

export const experimentStatusColor: Record<string, string> = {
  draft: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
};

export const modelStatusColor: Record<string, string> = {
  draft: colors.neutral[400],
  staging: colors.warning[500],
  production: colors.success[500],
  archived: colors.neutral[300],
};

export const jobStatusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
};

// ============================================================================
// Select options
// ============================================================================

export const MODEL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'llm', label: 'LLM' },
  { value: 'classification', label: 'Classification' },
  { value: 'regression', label: 'Regression' },
  { value: 'clustering', label: 'Clustering' },
  { value: 'neural-network', label: 'Neural Network' },
];

export const EXPERIMENT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'running', label: '运行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
];

export const MODEL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'staging', label: '预发布' },
  { value: 'production', label: '生产' },
  { value: 'archived', label: '已归档' },
];

// ============================================================================
// Layout presets
// ============================================================================

export const headerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: spacing.md,
};

export const filterRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: spacing.sm,
  marginBottom: spacing.md,
  alignItems: 'center',
};

export const sectionTitleStyle: CSSProperties = {
  marginBottom: spacing.sm,
};

// ============================================================================
// Form rules
// ============================================================================

export const EXPERIMENT_NAME_RULES = [{ required: true, message: '请输入实验名称' }];

export const MODEL_NAME_RULES = [{ required: true, message: '请输入模型名称' }];

export const DATASET_RULES = [{ required: true, message: '请输入数据集名称' }];
