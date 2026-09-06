/**
 * Serverless Page (Phase 4 P0 - Serverless Module)
 * Function lifecycle management, triggers, metrics, logs, auto-scaling
 *
 * Tab 拆分:
 * - FunctionsTab.tsx: 函数管理
 * - TriggersTab.tsx: 事件触发器
 * - MetricsTab.tsx: 指标与扩缩容
 */
import React from 'react';
import { Tabs } from 'antd';
import { spacing } from '@/tokens';
import { FunctionsTab } from './FunctionsTab';
import { TriggersTab } from './TriggersTab';
import { MetricsTab } from './MetricsTab';

const ServerlessPage: React.FC = () => {
  const tabItems = [
    { key: 'functions', label: '函数管理', children: <FunctionsTab /> },
    { key: 'triggers', label: '事件触发器', children: <TriggersTab /> },
    { key: 'metrics', label: '指标与扩缩容', children: <MetricsTab /> },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Tabs defaultActiveKey="functions" items={tabItems} size="large" />
    </div>
  );
};

export default ServerlessPage;
