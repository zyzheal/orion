/**
 * SBOM Dashboard Page
 * SBOM coverage stats, vulnerability trends, compliance score, SBOM list
 *
 * 拆分 (P2-9 Phase 148): types / constants / columns / useSbomDashboardState / Components/*
 */
import React, { useMemo } from 'react';
import PageSkeleton from '@/components/PageSkeleton';
import { useSbomDashboardState } from './useSbomDashboardState';
import { buildSbomColumns } from './columns';
import { SbomDashboardHeader } from './Components/SbomDashboardHeader';
import { StatsRow } from './Components/StatsRow';
import { SbomListCard } from './Components/SbomListCard';
import { ComplianceReport } from './Components/ComplianceReport';
import { WaiverModal } from './Components/WaiverModal';

const SbomDashboard: React.FC = () => {
  const state = useSbomDashboardState();

  const columns = useMemo(() => buildSbomColumns({ navigate: state.navigate }), [state.navigate]);

  // 初始加载时展示骨架屏，提升感知性能
  if (state.loading) {
    return <PageSkeleton rows={6} />;
  }

  return (
    <div style={{ padding: 0 }}>
      <SbomDashboardHeader
        loading={state.loading}
        onRefresh={() => state.refetch()}
        onCreateWaiver={() => state.setWaiverModalVisible(true)}
      />
      <StatsRow
        documents={state.documents}
        compliance={state.compliance}
        totalPackages={state.totalPackages}
        activeDocs={state.activeDocs}
      />
      <SbomListCard
        columns={columns}
        filteredDocs={state.filteredDocs}
        loading={state.loading}
        searchQuery={state.searchQuery}
        filters={state.filters}
        onSearch={state.setSearchQuery}
        onFilter={state.setFilters}
      />
      <ComplianceReport
        compliance={state.compliance}
        waivers={state.waivers}
        documents={state.documents}
        licenseDistribution={state.licenseDistribution}
        componentByDoc={state.componentByDoc}
      />
      <WaiverModal
        open={state.waiverModalVisible}
        submitting={state.waiverSubmitting}
        form={state.form}
        onCancel={() => state.setWaiverModalVisible(false)}
        onSubmit={state.handleCreateWaiver}
      />
    </div>
  );
};

export default SbomDashboard;
