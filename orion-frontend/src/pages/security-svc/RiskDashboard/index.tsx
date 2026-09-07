/**
 * Risk Dashboard Page
 * Risk assessment, health checks, and risk event monitoring
 *
 * 拆分 (P2-9 Phase 143): constants / useRiskDashboardState / riskColumns / Components/*
 */
import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { spacing } from '@/tokens';
import { useRiskDashboardState } from './useRiskDashboardState';
import { RiskDashboardHeader } from './Components/RiskDashboardHeader';
import { SummaryRow } from './Components/SummaryRow';
import { RiskStatusCard } from './Components/RiskStatusCard';
import { ChartsRow } from './Components/ChartsRow';
import { AssessmentTable } from './Components/AssessmentTable';
import { EventsTable } from './Components/EventsTable';
import { AssessModal } from './Components/AssessModal';
import { DetailDrawer } from './Components/DetailDrawer';

const RiskDashboardPage: React.FC = () => {
  const state = useRiskDashboardState();

  return (
    <DashboardLayout>
      <div style={{ padding: spacing.lg }}>
        <RiskDashboardHeader
          loading={state.loading}
          onRefresh={state.loadData}
          onQuickCheck={() => state.handleHealthCheck('basic')}
          onFullCheck={() => state.handleHealthCheck('comprehensive')}
          onOpenAssess={state.openAssessModal}
        />
        <SummaryRow
          totalAssessments={state.status?.totalAssessments || 0}
          pendingAssessments={state.status?.pendingAssessments || 0}
          highRiskCount={state.status?.highRiskCount || 0}
          unacknowledgedCount={state.events.length}
        />
        <RiskStatusCard systemStatus={state.status?.status ?? null} />
        <ChartsRow heatmapData={state.heatmapData} riskTypeData={state.riskTypeData} />
        <AssessmentTable
          assessments={state.assessments}
          loading={state.loading}
          openDrawer={state.openDrawer}
        />
        <EventsTable
          eventTableData={state.eventTableData}
          loading={state.loading}
          handleAcknowledge={state.handleAcknowledge}
        />
        <AssessModal
          open={state.assessModalOpen}
          form={state.form}
          onCancel={state.closeAssessModal}
          onOk={() => state.form.submit()}
          onFinish={state.handleAssess}
        />
        <DetailDrawer
          open={state.drawerOpen}
          selectedAssessment={state.selectedAssessment}
          onClose={state.closeDrawer}
        />
      </div>
    </DashboardLayout>
  );
};

export default RiskDashboardPage;
