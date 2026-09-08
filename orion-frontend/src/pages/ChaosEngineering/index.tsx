/**
 * Chaos Engineering Page
 * Phase 3 - Chaos experiments dashboard with resilience score tracking
 *
 * 重构自 P2-9 Phase 91 (634 → ~120 行):
 *  - constants.ts - faultTypeConfig/statusConfig/envConfig
 *  - useChaosEngineeringState.ts - 全部状态 + loadData + handleRunExperiment + handleCreateExperiment + openDetail
 *  - columns.tsx - makeExperimentColumns
 *  - Modals/CreateExperimentModal.tsx - 创建实验弹窗
 *  - Components/DetailDrawer.tsx - 实验详情抽屉
 *  - Components/ResilienceScoreCard.tsx - 系统弹性评分卡
 *  - Components/PageHeader.tsx - 标题 + 刷新
 *  - Components/ExperimentStatsCard.tsx - 4 张统计卡
 *  - Components/ExperimentsTableCard.tsx - 实验列表卡
 *  - index.tsx: 组合层
 */
import React from 'react';
import { Alert } from 'antd';
import { spacing } from '@/tokens';
import { useChaosEngineeringState } from './useChaosEngineeringState';
import { makeExperimentColumns } from './columns';
import { CreateExperimentModal } from './Modals/CreateExperimentModal';
import { DetailDrawer } from './Components/DetailDrawer';
import { ResilienceScoreCard } from './Components/ResilienceScoreCard';
import { PageHeader } from './Components/PageHeader';
import { ExperimentStatsCard } from './Components/ExperimentStatsCard';
import { ExperimentsTableCard } from './Components/ExperimentsTableCard';

const ChaosEngineering: React.FC = () => {
  const {
    experiments,
    score,
    loading,
    error,
    setError,
    createModal,
    setCreateModal,
    detailDrawer,
    setDetailDrawer,
    selectedExperiment,
    form,
    submitting,
    runningId,
    runError,
    setRunError,
    loadData,
    handleRunExperiment,
    handleCreateExperiment,
    openDetail,
    openCreate,
    stats,
  } = useChaosEngineeringState();

  const columns = React.useMemo(
    () => makeExperimentColumns({ runningId, openDetail, handleRunExperiment }),
    [runningId, openDetail, handleRunExperiment]
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} error={error} setError={setError} onRefresh={loadData} />

      {error && (
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: spacing.md } as React.CSSProperties}
        />
      )}

      {runError && (
        <Alert
          message="实验运行失败"
          description={runError}
          type="error"
          showIcon
          closable
          onClose={() => setRunError(null)}
          style={{ marginBottom: spacing.md } as React.CSSProperties}
        />
      )}

      <ResilienceScoreCard score={score} />
      <ExperimentStatsCard stats={stats} />

      {stats.hasProductionActive && (
        <Alert
          message="注意"
          description="存在生产环境的混沌实验，执行前请确认影响范围"
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md } as React.CSSProperties}
        />
      )}

      <ExperimentsTableCard
        columns={columns}
        dataSource={experiments}
        loading={loading}
        onCreate={openCreate}
        onRefresh={loadData}
      />

      <CreateExperimentModal
        open={createModal}
        submitting={submitting}
        form={form}
        onCancel={() => setCreateModal(false)}
        onFinish={handleCreateExperiment}
      />

      <DetailDrawer
        open={detailDrawer}
        experiment={selectedExperiment}
        runningId={runningId}
        onClose={() => setDetailDrawer(false)}
        onRun={handleRunExperiment}
      />
    </div>
  );
};

export default ChaosEngineering;
