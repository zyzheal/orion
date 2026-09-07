/**
 * WorkflowTriggers constants
 * 抽取自 index.tsx (P2-9 Phase 131)
 */
import React from 'react';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import type { WorkflowTriggerType } from '@/api/workflow-trigger';

export const TRIGGER_TYPE_CONFIG: Record<
  WorkflowTriggerType,
  { color: string; label: string; icon: React.ReactNode }
> = {
  event: { color: 'blue', label: '事件触发', icon: <ThunderboltOutlined /> },
  cron: { color: 'orange', label: '定时触发', icon: <ClockCircleOutlined /> },
  webhook: { color: 'purple', label: 'Webhook', icon: <ApiOutlined /> },
  manual: { color: 'default', label: '手动触发', icon: <GlobalOutlined /> },
};
