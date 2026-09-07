/**
 * 多租户配额管理 (Tenant Quota Management)
 * /api/v1/tenant-quota — 配额计划 · 用量监控 · 超额告警
 * Refactored in P2-9 Phase 136.
 */
import React from 'react';
import { Space } from 'antd';
import { spacing } from '@/tokens';
import { useTenantQuotaState } from './useTenantQuotaState';
import { TenantQuotaHeader } from './Components/TenantQuotaHeader';
import { StatsRow } from './Components/StatsRow';
import { ActivePlanMetricsCard } from './Components/ActivePlanMetricsCard';
import { PlansCard } from './Components/PlansCard';
import { UsageCard } from './Components/UsageCard';
import { AlertsCard } from './Components/AlertsCard';
import { CreateEditModal } from './Components/CreateEditModal';
import { DetailModal } from './Components/DetailModal';

const TenantQuotaPage: React.FC = () => {
  const state = useTenantQuotaState();

  return (
    <div style={{ padding: spacing.lg }}>
      <TenantQuotaHeader />

      <StatsRow
        plansCount={state.plans.length}
        usagesCount={state.usages.length}
        alerts={state.alerts}
      />

      <ActivePlanMetricsCard plans={state.plans} usages={state.usages} />

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <PlansCard
          plans={state.plans}
          loading={state.loading}
          status={state.status}
          setStatus={state.setStatus}
          loadPlans={state.loadPlans}
          handleCreate={state.handleCreate}
          handleViewDetail={state.handleViewDetail}
          handleEdit={state.handleEdit}
          handleDelete={state.handleDelete}
        />

        <UsageCard
          usages={state.usages}
          loadUsage={state.loadUsage}
          handleCheckQuota={state.handleCheckQuota}
        />

        <AlertsCard alerts={state.alerts} loadAlerts={state.loadAlerts} />
      </Space>

      <CreateEditModal
        selectedPlan={state.selectedPlan}
        modalOpen={state.modalOpen}
        form={state.form}
        handleSubmit={state.handleSubmit}
        setModalOpen={state.setModalOpen}
      />

      <DetailModal
        selectedPlan={state.selectedPlan}
        detailOpen={state.detailOpen}
        setDetailOpen={state.setDetailOpen}
      />
    </div>
  );
};

export default TenantQuotaPage;
