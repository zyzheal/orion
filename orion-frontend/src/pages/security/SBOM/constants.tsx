/**
 * SBOM constants
 * 抽取自 index.tsx (P2-9 Phase 134)
 */
import React from 'react';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { ComponentType, ComponentStatus, Severity } from './types';

// ============ Design Token Aliases ============
export const cPrimary = colors.primary[500];
export const cSuccess = colors.success[500];
export const cWarning = colors.warning[500];
export const cError = colors.error[500];
export const cInfo = colors.info[500];
export const cPurple = colors.purple[500];
export const cNeutral = colors.neutral[500];

export const cardStyle = (borderColor: string): React.CSSProperties => ({
  borderRadius: 12,
  borderLeft: `3px solid ${borderColor}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
});

// ============ Config Maps ============

export const typeTagColor: Record<ComponentType, string> = {
  npm: cPrimary,
  Go: cInfo,
  Python: cPurple,
  Maven: colors.tier.bronze,
  Docker: colors.cloud.aws,
};

export const typeTagIcon: Record<ComponentType, React.ReactNode> = {
  npm: '⬛',
  Go: '🐹',
  Python: '🐍',
  Maven: '🏗️',
  Docker: '🐳',
};

export const statusTagProps: Record<
  ComponentStatus,
  { color: string; text: string; icon: React.ReactNode }
> = {
  safe: { color: cSuccess, text: '安全', icon: <CheckCircleOutlined /> },
  vulnerable: { color: cWarning, text: '有漏洞', icon: <ExclamationCircleOutlined /> },
  expired: { color: cError, text: '过期', icon: <BellOutlined /> },
};

export const severityColor: Record<Severity, string> = {
  Critical: cError,
  High: cWarning,
  Medium: colors.warning[300],
  Low: cInfo,
};

export const severityTag: Record<Severity, string> = {
  Critical: '严重',
  High: '高危',
  Medium: '中危',
  Low: '低危',
};

export const LICENSE_VIOLATIONS = ['GPL-3.0', 'Proprietary'];
