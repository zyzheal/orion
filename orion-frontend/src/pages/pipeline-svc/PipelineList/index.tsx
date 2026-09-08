/**
 * Pipeline List Page (TASK-905) - FIXED P0-1
 * Pipeline listing with filters/status, table view with pagination.
 *
 * 拆分自 index.tsx (P2-9 Phase 217)
 * - usePipelineListState.ts: state + useNavigate + loadPipelines + handlers
 * - columns.tsx: buildPipelineListColumns (6 列)
 * - Components/PageHeader.tsx: header with icon + Refresh/Create buttons
 * - Components/RunModal.tsx: run pipeline dialog
 * - index.tsx: composition + BatchActions + Table + Empty
 */
import { Button, Empty } from 'antd';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { usePipelineListState } from './usePipelineListState';
import { buildPipelineListColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { RunModal } from './Components/RunModal';
import BatchActions from './BatchActions';

const PipelineList = () => {
  const {
    loading,
    filteredPipelines,
    selectedRowKeys,
    setSelectedRowKeys,
    runModalVisible,
    setRunModalVisible,
    selectedPipeline,
    runBranch,
    setRunBranch,
    variablesText,
    setVariablesText,
    running,
    filterDefs,
    setSearchQuery,
    setFilters,
    loadPipelines,
    handleRefresh,
    handleRun,
    confirmRun,
    handleCreate,
    handleView,
    handleEdit,
    handleViewRuns,
    handleClearSelection,
  } = usePipelineListState();

  const columns = buildPipelineListColumns({
    onRun: handleRun,
    onView: handleView,
    onEdit: handleEdit,
    onViewRuns: handleViewRuns,
  });

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        total={filteredPipelines.length}
        loading={loading}
        onRefresh={handleRefresh}
        onCreate={handleCreate}
      />

      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索 Pipeline 名称、版本、描述..."
        />
      </div>

      <BatchActions
        selectedIds={selectedRowKeys.map(String)}
        onRefresh={loadPipelines}
        onClearSelection={handleClearSelection}
      />

      {filteredPipelines.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: spacing.xxl }}>
          <Empty description="暂无匹配的 Pipeline">
            <Button type="primary" onClick={handleCreate}>
              创建 Pipeline
            </Button>
          </Empty>
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={filteredPipelines}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      )}

      <RunModal
        open={runModalVisible}
        selectedPipeline={selectedPipeline}
        runBranch={runBranch}
        setRunBranch={setRunBranch}
        variablesText={variablesText}
        setVariablesText={setVariablesText}
        confirmLoading={running}
        onConfirm={confirmRun}
        onCancel={() => setRunModalVisible(false)}
      />
    </div>
  );
};

export default PipelineList;
