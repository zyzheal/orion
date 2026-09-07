/**
 * 表单实例流水线 (Form Instance Pipeline)
 * 提交 → 审批 → 完成 全流程管理
 * 组件化重构 (P2-9 Phase 176): 429→55 行
 */
import React, { useMemo } from 'react';
import { spacing } from '@/tokens';
import { useFormInstancePipelineState } from './useFormInstancePipelineState';
import { buildColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsCards } from './Components/StatsCards';
import { InstancesCard } from './Components/InstancesCard';
import { SubmitModal } from './Components/SubmitModal';
import { DetailModal } from './Components/DetailModal';

const FormInstancePipeline: React.FC = () => {
  const state = useFormInstancePipelineState();
  const {
    instances,
    forms,
    loading,
    selectedForm,
    setSelectedForm,
    status,
    setStatus,
    selectedInstance,
    submitModalOpen,
    setSubmitModalOpen,
    submitting,
    submitForm,
    detailOpen,
    setDetailOpen,
    totalInstances,
    approvedCount,
    pendingCount,
    rejectedCount,
    loadInstances,
    handleSubmit,
    handleApprove,
    handleViewDetail,
    openSubmitModal,
  } = state;

  const columns = useMemo(
    () => buildColumns({ handleViewDetail, handleApprove }),
    [handleViewDetail, handleApprove]
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      <StatsCards
        totalInstances={totalInstances}
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        rejectedCount={rejectedCount}
      />
      <InstancesCard
        instances={instances}
        forms={forms}
        loading={loading}
        selectedForm={selectedForm}
        setSelectedForm={setSelectedForm}
        status={status}
        setStatus={setStatus}
        columns={columns}
        onLoad={loadInstances}
        onOpenSubmit={openSubmitModal}
      />
      <SubmitModal
        open={submitModalOpen}
        submitting={submitting}
        forms={forms}
        form={submitForm}
        onCancel={() => setSubmitModalOpen(false)}
        onSubmit={handleSubmit}
      />
      <DetailModal open={detailOpen} instance={selectedInstance} onClose={() => setDetailOpen(false)} />
    </div>
  );
};

export default FormInstancePipeline;
