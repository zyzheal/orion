/**
 * PluginManagement - Shared Types & Constants
 * Type definitions, label maps, and health status configuration
 */
import React from 'react';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type {
  Plugin,
  PluginType,
  PluginCategory,
  PluginExecutionResult,
} from '@/api/plugins';
import type { PluginHealthStatus } from '@/api/plugins';
export type { PluginHealthStatus };
import { categoryLabels, healthStatusLabels } from '@/pages/__mocks__/mockPluginData';

// ============================================================================
// Type aliases for UI compatibility
// ============================================================================

export type ApiPlugin = Plugin & {
  category?: 'core' | 'extension' | 'security' | 'monitoring';
  status?: 'enabled' | 'disabled';
};

// Plugin config form values - mirrors Plugin.config
export type PluginConfig = Record<string, unknown>;

// Execute plugin task result - alias of API type
export type ExecutePluginResult = PluginExecutionResult;

// ============================================================================
// Health status config
// ============================================================================

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

// ============================================================================
// Re-export label maps from mock data for convenience
// ============================================================================

export { categoryLabels, healthStatusLabels };

// ============================================================================
// Plugin type to category mapping
// ============================================================================

export function mapPluginTypeToCategory(type: PluginType): PluginCategory {
  switch (type) {
    case 'CUSTOM_TASK':
    case 'WEBHOOK_HANDLER':
      return 'extension';
    case 'AI_SKILL':
      return 'core';
    case 'APPROVAL_PROVIDER':
      return 'security';
    case 'NOTIFICATION_CHANNEL':
      return 'monitoring';
    case 'DEPLOYMENT_STRATEGY':
      return 'core';
    default:
      return 'extension';
  }
}
