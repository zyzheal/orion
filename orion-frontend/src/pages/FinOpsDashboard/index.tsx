/**
 * FinOps Dashboard Page
 *
 * A comprehensive cost management dashboard with:
 * - Summary cards (monthly cost, budget usage, waste, savings)
 * - Cost trend chart (placeholder)
 * - Cost by service table
 * - Budget alerts
 * - Optimization recommendations
 * - Quick actions
 *
 * P2-9 Phase 125 拆分:
 * - useFinOpsDashboardState.tsx  状态 hook (6 useState + loadData + handleApplyOptimization + handleExportReport + budgetUsagePercent/monthOverMonthChange/dataTimestamp)
 * - constants.tsx                effortConfig/optimizationStatusConfig/alertStatusConfig
 * - costByServiceColumns.tsx     4列 service/cost/percent/trend
 * - Components/FinOpsDashboardHeader.tsx
 * - Components/SummaryCards.tsx
 * - Components/CostTrendChart.tsx
 * - Components/CostByServiceTable.tsx
 * - Components/ServiceCostRanking.tsx
 * - Components/BudgetAlerts.tsx
 * - Components/BudgetAllocationChart.tsx
 * - Components/OptimizationRecommendations.tsx
 * - Components/QuickActions.tsx
 */
import React from 'react';
import { Col, Row } from 'antd';
import { useFinOpsDashboardState } from './useFinOpsDashboardState';
import { FinOpsDashboardHeader } from './Components/FinOpsDashboardHeader';
import { SummaryCards } from './Components/SummaryCards';
import { CostTrendChart } from './Components/CostTrendChart';
import { CostByServiceTable } from './Components/CostByServiceTable';
import { ServiceCostRanking } from './Components/ServiceCostRanking';
import { BudgetAlerts } from './Components/BudgetAlerts';
import { BudgetAllocationChart } from './Components/BudgetAllocationChart';
import { OptimizationRecommendations } from './Components/OptimizationRecommendations';
import { QuickActions } from './Components/QuickActions';

const FinOpsDashboard: React.FC = () => {
  const state = useFinOpsDashboardState();

  return (
    <div style={{ padding: 0 }}>
      <FinOpsDashboardHeader state={state} />
      <SummaryCards state={state} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <CostTrendChart state={state} />
          <CostByServiceTable state={state} />
          <ServiceCostRanking state={state} />
          <BudgetAlerts state={state} />
        </Col>
        <Col xs={24} lg={8}>
          <BudgetAllocationChart state={state} />
          <OptimizationRecommendations state={state} />
          <QuickActions state={state} />
        </Col>
      </Row>
    </div>
  );
};

export default FinOpsDashboard;
