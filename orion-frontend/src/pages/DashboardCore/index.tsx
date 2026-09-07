/**
 * Dashboard Page (TASK-905)
 * Platform overview with KPIs, recent activity timeline, and quick access cards.
 *
 * P0-3 Fix: Replaced mock data imports with real API calls to efficiency,
 * alert, and pipeline endpoints.
 *
 * Split into components (P2-9 Phase 156):
 * - types.ts / constants.tsx / api.ts / useDashboardCoreState.ts
 * - Components/{DashboardCoreHeader,KPICards,RecentActivity,QuickActions,SystemHealth,LoadingAndError}.tsx
 */
import React from 'react';
import { Row, Col } from 'antd';
import { useDashboardCoreState } from './useDashboardCoreState';
import { DashboardCoreHeader } from './Components/DashboardCoreHeader';
import { KPICards } from './Components/KPICards';
import { RecentActivity } from './Components/RecentActivity';
import { QuickActions } from './Components/QuickActions';
import { SystemHealth } from './Components/SystemHealth';
import {
  DashboardLoading,
  DashboardError,
  shouldShowLoading,
  shouldShowError,
} from './Components/LoadingAndError';

const DashboardCore: React.FC = () => {
  const { state, systemHealth } = useDashboardCoreState();

  if (shouldShowLoading(state)) {
    return <DashboardLoading />;
  }

  if (shouldShowError(state) && state.error) {
    return <DashboardError error={state.error} />;
  }

  return (
    <div style={{ padding: 0 }}>
      <DashboardCoreHeader />

      <KPICards kpis={state.kpis} />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <RecentActivity events={state.events} />
        </Col>
        <Col xs={24} xl={8}>
          <QuickActions />
          <SystemHealth items={systemHealth} />
        </Col>
      </Row>
    </div>
  );
};

export default DashboardCore;
