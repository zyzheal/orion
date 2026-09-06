/**
 * Capacity Planning Page (Phase 4 - Capacity Planning)
 * Resource capacity tracking, forecasting, bottleneck analysis
 *
 * 重构自 P2-9 Phase 92 (614 → ~30 行):
 *  - constants.ts - impactColorMap/severityColorMap/typeColorMap
 *  - Tabs/OverviewTab.tsx - 容量概览 (瓶颈分析 + 容量预警)
 *  - Tabs/ForecastTab.tsx - 容量预测
 *  - Tabs/MetricsTab.tsx - 资源指标 (含记录指标 Modal)
 *  - Tabs/ReportsTab.tsx - 容量报告
 */
import React from 'react';
import { Tabs } from 'antd';
import { spacing } from '@/tokens';
import { OverviewTab } from './Tabs/OverviewTab';
import { ForecastTab } from './Tabs/ForecastTab';
import { MetricsTab } from './Tabs/MetricsTab';
import { ReportsTab } from './Tabs/ReportsTab';

const CapacityPlanningPage: React.FC = () => {
  const tabItems = [
    { key: 'overview', label: '容量概览', children: <OverviewTab /> },
    { key: 'forecast', label: '容量预测', children: <ForecastTab /> },
    { key: 'metrics', label: '资源指标', children: <MetricsTab /> },
    { key: 'reports', label: '容量报告', children: <ReportsTab /> },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Tabs defaultActiveKey="overview" items={tabItems} size="large" />
    </div>
  );
};

export default CapacityPlanningPage;
