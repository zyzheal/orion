/**
 * Health Dashboard Page (Task 6.8)
 * 系统健康仪表盘：KPI 卡片、服务健康列表、告警列表、趋势图
 *
 * P2-9 Phase 126 拆分:
 * - useHealthDashboardState.tsx  状态 hook (8 useState + loadData + 30s 轮询 useEffect)
 * - constants.tsx                severityMap/alertStatusMap/serviceStatusMap 3 映射
 * - tagRenderers.tsx             severityTag/statusTag/serviceStatusTag 3 函数
 * - alertColumns.tsx             5 列 alertColumns
 * - serviceColumns.tsx           6 列 serviceColumns
 * - Components/TrendChart.tsx    SVG 趋势图 (grid + area + line + points + xLabels)
 * - Components/HealthDashboardHeader.tsx
 * - Components/KpiCards.tsx
 * - Components/ServiceHealthTable.tsx
 * - Components/AlertsTable.tsx
 * - Components/TrendChartCard.tsx
 */
import React from 'react';
import { Spin } from 'antd';
import { spacing } from '@/tokens';
import { useHealthDashboardState } from './useHealthDashboardState';
import { HealthDashboardHeader } from './Components/HealthDashboardHeader';
import { KpiCards } from './Components/KpiCards';
import { ServiceHealthTable } from './Components/ServiceHealthTable';
import { AlertsTable } from './Components/AlertsTable';
import { TrendChartCard } from './Components/TrendChartCard';

const HealthDashboard: React.FC = () => {
  const state = useHealthDashboardState();

  return (
    <Spin spinning={state.loading}>
      <div style={{ padding: spacing.lg }}>
        <HealthDashboardHeader state={state} />
        <KpiCards state={state} />
        <ServiceHealthTable state={state} />
        <AlertsTable state={state} />
        <TrendChartCard state={state} />
      </div>
    </Spin>
  );
};

export default HealthDashboard;
