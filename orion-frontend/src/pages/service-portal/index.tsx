/**
 * ServicePortal — 开发者服务门户
 * 对接后端 /api/v1/service-registry 服务注册与发现
 * 含服务列表、注册、健康监控
 *
 * P2-9 Phase 182: Extracted to constants.tsx + useServicePortalState.ts +
 * columns.tsx + Components/*.tsx (5 components). 421 → 55 行 (-87%).
 */
import React from 'react';
import PageSkeleton from '@/components/PageSkeleton';
import { useServicePortalState } from './useServicePortalState';
import { buildServiceColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsCards } from './Components/StatsCards';
import { ServiceTable } from './Components/ServiceTable';
import { RegisterModal } from './Components/RegisterModal';
import { DetailModal } from './Components/DetailModal';

const ServicePortalPage: React.FC = () => {
  const {
    modalOpen,
    setModalOpen,
    submitting,
    detailOpen,
    setDetailOpen,
    selectedService,
    healthData,
    healthLoading,
    form,
    loading,
    services,
    healthStats,
    handleRegister,
    handleSubmit,
    handleDeregister,
    handleViewDetail,
    handleRefresh,
  } = useServicePortalState();

  const columns = buildServiceColumns({
    onDetail: handleViewDetail,
    onDeregister: handleDeregister,
  });

  if (loading) {
    return <PageSkeleton rows={8} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />
      <StatsCards stats={healthStats} />
      <ServiceTable
        columns={columns}
        dataSource={services}
        loading={loading}
        onRegister={handleRegister}
        onRefresh={handleRefresh}
      />
      <RegisterModal
        open={modalOpen}
        submitting={submitting}
        form={form}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
      />
      <DetailModal
        open={detailOpen}
        service={selectedService}
        health={healthData}
        healthLoading={healthLoading}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
};

export default ServicePortalPage;
