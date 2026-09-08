/**
 * Pipeline Run List Page
 * Shows execution history (runs) for all pipelines, with filtering by status,
 * date range, and environment. Supports real-time status refresh via polling.
 * 组件化重构 (P2-9 Phase 180): 424→61 行
 */
import React from 'react';
import Table from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import { useNavigate } from 'react-router-dom';
import { usePipelineRunListState } from './usePipelineRunListState';
import { buildColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { FilterBar } from './Components/FilterBar';

const PipelineRunList: React.FC = () => {
  const navigate = useNavigate();
  const {
    pipelineId,
    pipelineName,
    setSearchQuery,
    setFilters,
    dateRange,
    setDateRange,
    loading,
    sortedRuns,
    handleRetry,
    handleRefresh,
  } = usePipelineRunListState();

  const columns = buildColumns({
    handleRetry,
    onNavigatePipeline: (pid) => navigate(`/pipelines/${pid}`),
    onNavigateRun: (pid, rid) => navigate(`/pipelines/${pid}/runs/${rid}`),
  });

  if (loading) return <PageSkeleton rows={10} />;

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        pipelineName={pipelineName}
        pipelineId={pipelineId}
        totalCount={sortedRuns.length}
        loading={loading}
        onRefresh={handleRefresh}
        onBackToList={() => navigate('/pipelines')}
      />

      <FilterBar
        onSearch={setSearchQuery}
        onFilter={setFilters}
        dateRange={dateRange}
        setDateRange={setDateRange}
      />

      <Table
        columns={columns}
        dataSource={sortedRuns}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </div>
  );
};

export default PipelineRunList;
