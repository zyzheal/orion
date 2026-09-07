/**
 * Chaos Engineering Page
 * Phase 3 - Chaos experiments dashboard with resilience score tracking
 *
 * Features:
 * - Resilience score dashboard with progress indicators
 * - Chaos experiment management (create, run, monitor)
 * - Fault injection configuration
 * - Experiment history and results
 *
 * 拆分为: useChaosEngineeringState + experimentColumns + Components/*
 * 参考: P2-9 Phase 132
 */
import React from 'react';
import { Alert } from 'antd';
import { spacing } from '@/tokens';
import { useChaosEngineeringState } from './useChaosEngineeringState';
import { ChaosEngineeringHeader } from './Components/ChaosEngineeringHeader';
import { ResilienceScoreCard } from './Components/ResilienceScoreCard';
import { ExperimentStatsRow } from './Components/ExperimentStatsRow';
import { ExperimentsTable } from './Components/ExperimentsTable';
import { CreateExperimentModal } from './Components/CreateExperimentModal';
import { DetailDrawer } from './Components/DetailDrawer';

const ChaosEngineering: React.FC = () => {
  const state = useChaosEngineeringState();

  return (
    <div style={{ padding: 0 }}>
      <ChaosEngineeringHeader
        loading={state.loading}
        error={state.error}
        loadData={state.loadData}
        clearError={() => state.setError(null)}
      />

      {state.error && (
        <Alert
          message="加载失败"
          description={state.error}
          type="error"
          showIcon
          closable
          onClose={() => state.setError(null)}
          style={{ marginBottom: spacing.md }}
        />
      )}

      {state.runError && (
        <Alert
          message="实验运行失败"
          description={state.runError}
          type="error"
          showIcon
          closable
          onClose={() => state.setRunError(null)}
          style={{ marginBottom: spacing.md }}
        />
      )}

      <ResilienceScoreCard score={state.score} />

      <ExperimentStatsRow stats={state.stats} />

      {state.experiments.some((e) => e.scope?.environment === 'production' && e.status === 'active') && (
        <Alert
          message="注意"
          description="存在生产环境的混沌实验，执行前请确认影响范围"
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
      )}

      <ExperimentsTable
        experiments={state.experiments}
        loading={state.loading}
        runningId={state.runningId}
        openDetail={state.openDetail}
        handleRunExperiment={state.handleRunExperiment}
        openCreate={state.openCreate}
        loadData={state.loadData}
      />

      <CreateExperimentModal
        open={state.createModal}
        submitting={state.submitting}
        form={state.form}
        onCancel={() => state.setCreateModal(false)}
        handleCreateExperiment={state.handleCreateExperiment}
      />

      <DetailDrawer
        open={state.detailDrawer}
        selectedExperiment={state.selectedExperiment}
        runningId={state.runningId}
        onClose={() => state.setDetailDrawer(false)}
        handleRunExperiment={state.handleRunExperiment}
      />
    </div>
  );
};

export default ChaosEngineering;
