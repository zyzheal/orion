/**
 * Pipeline Run List Page
 * Shows execution history (runs) for all pipelines, with filtering by status,
 * date range, and environment. Supports real-time status refresh via polling.
 *
 * Features:
 * - Table with columns: Run ID, Pipeline Name, Status, Environment, Started At, Duration, Triggered By
 * - Filter bar: Status filter, Date range picker, Environment selector
 * - Click row to navigate to PipelineDetail page
 * - Pagination support
 * - "Re-run" button for failed runs
 * - Real-time status refresh (polling every 5s for running runs)
 *
 * 拆分 (P2-9 Phase 140): types / constants / helpers / usePipelineRunListState / runColumns / Components/*
 */
import React from 'react';
import { usePipelineRunListState } from './usePipelineRunListState';
import { PipelineRunListHeader } from './Components/PipelineRunListHeader';
import { RunFilterBar } from './Components/RunFilterBar';
import { RunHistoryTable } from './Components/RunHistoryTable';
import StageSelectorModal from './StageSelectorModal';

const PipelineRunList: React.FC = () => {
  const state = usePipelineRunListState();

  const openStageRetry = (runId: string) => {
    state.setStageRetryModal({ visible: true, runId });
  };

  return (
    <div style={{ padding: 0 }}>
      <PipelineRunListHeader
        total={state.sortedRuns.length}
        loading={state.loading}
        onRefresh={state.handleRefresh}
      />
      <RunFilterBar
        filters={state.filters}
        setFilters={state.setFilters}
        onSearch={state.setSearchQuery}
        dateRange={state.dateRange}
        setDateRange={state.setDateRange}
      />
      <RunHistoryTable
        runs={state.sortedRuns}
        loading={state.loading}
        navigate={state.navigate}
        cancellingIds={state.cancellingIds}
        handleCancelConfirm={state.handleCancelConfirm}
        handleRetryConfirm={state.handleRetryConfirm}
        handleRetry={state.handleRetry}
        openStageRetry={openStageRetry}
      />
      <StageSelectorModal
        visible={state.stageRetryModal.visible}
        runId={state.stageRetryModal.runId}
        onClose={() => state.setStageRetryModal({ visible: false, runId: null })}
        onRetry={state.handleRetryFromStage}
      />
    </div>
  );
};

export default PipelineRunList;
