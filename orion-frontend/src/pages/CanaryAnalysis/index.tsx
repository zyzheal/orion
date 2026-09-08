/**
 * ML Canary Analysis Page
 * 组件化重构 (P2-9 Phase 266): 175->90行 (-49%)
 * 首轮已拆 useCanaryAnalysisState + RunColumns + RunDetailModal + TriggerModal + ConfigModal
 * 本轮再拆 Components/PageHeader + Components/StatsRow
 */
import React, { useMemo } from 'react';
import { Card } from 'antd';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useCanaryAnalysisState } from './useCanaryAnalysisState';
import { makeRunColumns, canaryFilterDefs } from './RunColumns';
import { RunDetailModal } from './RunDetailModal';
import { TriggerModal } from './TriggerModal';
import { ConfigModal } from './ConfigModal';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';

const CanaryAnalysis: React.FC = () => {
  const {
    loading, runs, selectedRun, metrics, mlResults,
    runDetailVisible, setRunDetailVisible,
    triggerModalVisible, setTriggerModalVisible,
    configModalVisible, setConfigModalVisible,
    setSearchQuery, setFilters,
    triggerForm, configForm,
    triggerSubmitting, configSubmitting,
    filteredRuns, runningCount, promotedCount, rolledbackCount,
    loadData, handleViewRun, handleTrigger, handleForcePromote, handleForceRollback, handleSaveConfig,
  } = useCanaryAnalysisState();

  const runColumns = useMemo(() => makeRunColumns(handleViewRun), [handleViewRun]);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={loading}
        loadData={loadData}
        onOpenTrigger={() => setTriggerModalVisible(true)}
        onOpenConfig={() => setConfigModalVisible(true)}
      />

      <StatsRow total={runs.length} runningCount={runningCount} promotedCount={promotedCount} rolledbackCount={rolledbackCount} />

      <Card title="分析运行历史">
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={canaryFilterDefs}
            searchPlaceholder="搜索部署 ID..."
          />
        </div>
        <Table
          columns={runColumns}
          dataSource={filteredRuns}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      <RunDetailModal
        visible={runDetailVisible}
        selectedRun={selectedRun}
        metrics={metrics}
        mlResults={mlResults}
        onCancel={() => setRunDetailVisible(false)}
        onForcePromote={handleForcePromote}
        onForceRollback={handleForceRollback}
      />

      <TriggerModal
        visible={triggerModalVisible}
        form={triggerForm}
        submitting={triggerSubmitting}
        onCancel={() => setTriggerModalVisible(false)}
        onOk={handleTrigger}
      />

      <ConfigModal
        visible={configModalVisible}
        form={configForm}
        submitting={configSubmitting}
        onCancel={() => setConfigModalVisible(false)}
        onOk={handleSaveConfig}
      />
    </div>
  );
};

export default CanaryAnalysis;
