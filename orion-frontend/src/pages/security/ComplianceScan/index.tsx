/**
 * Compliance Scan Page (H1.7 合规检查)
 * Security baseline scanning, compliance report generation, and remediation tracking
 *
 * 拆分自 index.tsx (P2-9 Phase 188)
 */
import { useMemo } from 'react';
import { useComplianceScanState } from './useComplianceScanState';
import { buildBaselineColumns, buildFindingColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { BaselineTable } from './Components/BaselineTable';
import { FindingTable } from './Components/FindingTable';
import { CreateBaselineModal } from './Components/CreateBaselineModal';

const ComplianceScanPage = () => {
  const {
    createModalOpen,
    createForm,
    scanning,
    creating,
    loading,
    safeFindings,
    safeBaselines,
    totalRules,
    avgPassRate,
    criticalCount,
    refetch,
    handleScan,
    handleSubmitBaseline,
    closeCreate,
    setCreateModalOpen,
  } = useComplianceScanState();

  const baselineColumns = useMemo(
    () => buildBaselineColumns({ scanning, onScan: handleScan }),
    [scanning, handleScan]
  );

  const findingColumns = useMemo(() => buildFindingColumns(), []);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader />
      <StatsRow
        baselineCount={safeBaselines.length}
        totalRules={totalRules}
        avgPassRate={avgPassRate}
        criticalCount={criticalCount}
      />
      <BaselineTable
        baselines={safeBaselines}
        columns={baselineColumns}
        loading={loading}
        onRefresh={() => refetch()}
        onCreate={() => setCreateModalOpen(true)}
      />
      <FindingTable findings={safeFindings} columns={findingColumns} loading={loading} />
      <CreateBaselineModal
        form={createForm}
        open={createModalOpen}
        confirmLoading={creating}
        onOk={handleSubmitBaseline}
        onCancel={closeCreate}
      />
    </div>
  );
};

export default ComplianceScanPage;
