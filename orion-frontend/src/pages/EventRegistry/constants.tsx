/**
 * constants.tsx - EventRegistry 常量与工具函数
 * 抽取自 EventRegistry/index.tsx (P2-9 Phase 63)
 */
import React from 'react';
import {
  CalendarOutlined,
  PlayCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';

export const categoryColorMap: Record<string, string> = {
  pipeline: 'blue',
  code: 'green',
  deploy: 'orange',
  config: 'purple',
  incident: 'red',
  workflow: 'cyan',
};

export const triggerTypeIconMap: Record<string, React.ReactNode> = {
  cron: <CalendarOutlined />,
  manual: <PlayCircleOutlined />,
  webhook: <LinkOutlined />,
};

export function getTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    event: 'blue',
    cron: 'purple',
    manual: 'orange',
    webhook: 'green',
  };
  return colorMap[type] || 'default';
}
