/**
 * Risk Dashboard Page
 * Risk assessment, health checks, and risk event monitoring
 *
 * P2-9 Phase 123 拆分:
 * - useRiskDashboardState.tsx  状态 hook (7 useState + Form.useForm + loadData + 4 handlers + 3 derived + openDetail)
 * - constants.tsx             riskLevelColor/dayLabels/severityLabels/riskLevelToSeverity/eventTypeIconMap
 * - riskColumns.tsx           buildAssessmentColumns + buildEventColumns
 * - Components/RiskDashboardHeader.tsx
 * - Components/SummaryCards.tsx
 * - Components/RiskStatusCard.tsx
 * - Components/RiskChartsRow.tsx
 * - Components/AssessmentTable.tsx
 * - Components/EventsTable.tsx
 * - Components/AssessModal.tsx
 * - Components/DetailDrawer.tsx
 * - Components/HeaderActions.tsx
 */
import React from 'react';
import { useRiskDashboardState } from './useRiskDashboardState';
import { RiskDashboardHeader } from './Components/RiskDashboardHeader';
import { SummaryCards } from './Components/SummaryCards';
import { RiskStatusCard } from './Components/RiskStatusCard';
import { RiskChartsRow } from './Components/RiskChartsRow';
import { AssessmentTable } from './Components/AssessmentTable';
import { EventsTable } from './Components/EventsTable';
import { AssessModal } from './Components/AssessModal';
import { DetailDrawer } from './Components/DetailDrawer';
import { HeaderActions } from './Components/HeaderActions';

const RiskDashboardPage: React.FC = () => {
  const state = useRiskDashboardState();

  return (
    <div style={{ padding: 0 }} data-testid="risk-dashboard-page">
      <RiskDashboardHeader />
      <SummaryCards state={state} />
      <RiskStatusCard state={state} />
      <RiskChartsRow state={state} />
      <AssessmentTable state={state} />
      <EventsTable state={state} />
      <AssessModal state={state} />
      <DetailDrawer state={state} />
      <HeaderActions state={state} />
    </div>
  );
};

export default RiskDashboardPage;
