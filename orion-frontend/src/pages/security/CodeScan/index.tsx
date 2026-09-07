/**
 * Code Scan / SAST Page (H1.8 OWASP Top 10)
 * Static Application Security Testing - code vulnerability scanning, OWASP Top 10 detection
 *
 * Split into components (P2-9 Phase 150):
 * - types.ts / api.ts / constants.ts / columns.tsx / useCodeScanState.ts
 * - Components/{CodeScanHeader,StatsRow,ScanTable,VulnTable,CreateScanModal}.tsx
 */
import React, { useCallback, useMemo } from 'react';
import { spacing } from '@/tokens';
import { useCodeScanState } from './useCodeScanState';
import { buildScanColumns, buildVulnColumns } from './columns';
import { CodeScanHeader } from './Components/CodeScanHeader';
import { StatsRow } from './Components/StatsRow';
import { ScanTable } from './Components/ScanTable';
import { VulnTable } from './Components/VulnTable';
import { CreateScanModal } from './Components/CreateScanModal';

const CodeScanPage: React.FC = () => {
  const state = useCodeScanState();

  const scanColumns = useMemo(
    () => buildScanColumns({ scanning: state.scanning, handleScan: state.handleScan }),
    [state.scanning, state.handleScan],
  );
  const vulnColumns = useMemo(() => buildVulnColumns(), []);

  const handleCreateSubmit = useCallback(
    (values: { target: string; branch?: string }) => {
      state.createScanMutation.mutate(values, {
        onSuccess: () => {
          state.setCreateModalOpen(false);
          state.createForm.resetFields();
        },
      });
    },
    [state],
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <CodeScanHeader />
      <StatsRow
        scanCount={state.scans.length}
        totalVulns={state.totalVulns}
        highAndAboveVulns={state.highAndAboveVulns}
        passRate={state.passRate}
      />
      <ScanTable
        dataSource={state.scans}
        columns={scanColumns}
        loading={state.loading}
        onRefresh={() => {
          void state.loadScans();
        }}
        onCreate={() => state.setCreateModalOpen(true)}
      />
      <VulnTable dataSource={state.vulns} columns={vulnColumns} loading={state.loading} />
      <CreateScanModal
        open={state.createModalOpen}
        form={state.createForm}
        submitting={state.createScanMutation.isPending}
        onCancel={() => {
          state.setCreateModalOpen(false);
          state.createForm.resetFields();
        }}
        onSubmit={handleCreateSubmit}
      />
    </div>
  );
};

export default CodeScanPage;
