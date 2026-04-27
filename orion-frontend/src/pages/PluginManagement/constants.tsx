/**
 * PluginManagement - Constants with JSX
 * Extracted from types.ts to allow types.ts to use .ts extension
 */
import React from 'react';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

export const healthConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  healthy: {
    color: colors.success[500],
    icon: <CheckCircleOutlined />,
  },
  warning: {
    color: colors.warning[500],
    icon: <WarningOutlined />,
  },
  error: {
    color: colors.error[400],
    icon: <CloseCircleOutlined />,
  },
};
