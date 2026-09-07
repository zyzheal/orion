/**
 * SBOM Dashboard Page
 * 组件化重构 (P2-9 Phase 170): 445→66 行
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from './Components/PageHeader';
import { StatsCards } from './Components/StatsCards';
import { SbomTableCard } from './Components/SbomTableCard';
import { ComplianceReportCard } from './Components/ComplianceReportCard';
import { WaiverModal } from './Components/WaiverModal';
import { buildColumns } from './columns';
import { useSbomDashboardState } from './useSbomDashboardState';
import type { FilterDefinition } from '@/components/SearchFilterBar';

const SbomDashboard = () => {
  const navigate = useNavigate();
  const {
    loading,
    documents,
    waivers,
    compliance,
    setSearchQuery,
    setFilters,
    waiverModalVisible,
    setWaiverModalVisible,
    form,
    loadData,
    filteredDocs,
    totalPackages,
    activeDocs,
    licenseDistribution,
    componentByDoc,
    handleCreateWaiver,
  } = useSbomDashboardState();

  const columns = useMemo(() => buildColumns({ navigate }), [navigate]);

  const filterDefs = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'format',
        label: '格式',
        options: [
          { label: '全部', value: 'all' },
          { label: 'SPDX', value: 'spdx' },
          { label: 'CycloneDX', value: 'cyclonedx' },
        ],
      },
      {
        key: 'status',
        label: '状态',
        options: [
          { label: '全部', value: 'all' },
          { label: 'Active', value: 'active' },
          { label: 'Expired', value: 'expired' },
          { label: 'Revoked', value: 'revoked' },
        ],
      },
    ],
    []
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={loading}
        onRefresh={loadData}
        onCreateWaiver={() => setWaiverModalVisible(true)}
      />

      <StatsCards
        documentsCount={documents.length}
        activeDocs={activeDocs}
        totalPackages={totalPackages}
        compliance={compliance}
      />

      <SbomTableCard
        columns={columns}
        dataSource={filteredDocs}
        loading={loading}
        onSearch={setSearchQuery}
        onFilter={setFilters}
        filterDefs={filterDefs}
      />

      <ComplianceReportCard
        compliance={compliance}
        waiversCount={waivers.length}
        licenseDistribution={licenseDistribution}
        componentByDoc={componentByDoc}
        documents={documents}
      />

      <WaiverModal
        open={waiverModalVisible}
        form={form}
        onOk={() => form.submit()}
        onCancel={() => setWaiverModalVisible(false)}
        onFinish={handleCreateWaiver}
      />
    </div>
  );
};

export default SbomDashboard;
