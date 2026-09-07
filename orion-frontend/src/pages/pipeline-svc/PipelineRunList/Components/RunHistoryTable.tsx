/**
 * PipelineRunList History Table
 * 抽取自 index.tsx (P2-9 Phase 140)
 */
import React, { useMemo } from 'react';
import Table from '@/components/Table';
import type { PipelineRunSummary } from '@/api/pipelineRuns';
import { buildRunColumns } from '../runColumns';

interface RunHistoryTableProps {
  runs: PipelineRunSummary[];
  loading: boolean;
  navigate: (path: string) => void;
  cancellingIds: Set<string>;
  handleCancelConfirm: (runId: string) => void;
  handleRetryConfirm: (runId: string) => void;
  handleRetry: (runId: string, options?: { fromStage?: string; onlyFailed?: boolean }) => void;
  openStageRetry: (runId: string) => void;
}

export const RunHistoryTable: React.FC<RunHistoryTableProps> = ({
  runs,
  loading,
  navigate,
  cancellingIds,
  handleCancelConfirm,
  handleRetryConfirm,
  handleRetry,
  openStageRetry,
}) => {
  const columns = useMemo(
    () =>
      buildRunColumns({
        navigate,
        cancellingIds,
        handleCancelConfirm,
        handleRetryConfirm,
        handleRetry,
        openStageRetry,
      }),
    [navigate, cancellingIds, handleCancelConfirm, handleRetryConfirm, handleRetry, openStageRetry]
  );

  return (
    <Table
      columns={columns}
      dataSource={runs}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
    />
  );
};
