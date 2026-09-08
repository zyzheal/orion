/**
 * Alert.tsx - 简单 Alert 组件替代
 * 抽取自 index.tsx (P2-9 Phase 229)
 */
import React from 'react';
import { colors, spacing } from '@/tokens';

interface Props {
  type: 'info' | 'warning' | 'error' | 'success';
  showIcon?: boolean;
  children: React.ReactNode;
}

export const Alert: React.FC<Props> = ({ type, children }) => {
  const alertColors = {
    info: { bg: colors.info[50], border: colors.info[200], text: colors.info[600] },
    warning: { bg: colors.warning[50], border: colors.warning[200], text: colors.warning[600] },
    error: { bg: colors.error[50], border: colors.error[200], text: colors.error[600] },
    success: { bg: colors.success[50], border: colors.success[200], text: colors.success[600] },
  };
  const style = alertColors[type];

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 6,
        padding: '12px 16px',
        color: style.text,
        marginTop: spacing.md,
      }}
    >
      {children}
    </div>
  );
};
