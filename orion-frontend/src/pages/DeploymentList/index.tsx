/**
 * Deployment List Page (TASK-905)
 * Deployment history with status filtering and detail links.
 *
 * 拆分自 index.tsx (P2-9 Phase 198)
 */
import { useMemo } from 'react';
import { Button, Empty } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useNavigate } from 'react-router-dom';
import { useDeploymentListState } from './useDeploymentListState';
import { buildColumns } from './columns';
import { FILTER_DEFS } from './constants';
import { PageHeader } from './Components/PageHeader';

const DeploymentList = () => {
  const navigate = useNavigate();
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    loading,
    filteredDeployments,
    loadDeployments,
    handleRefresh,
  } = useDeploymentListState();

  const columns = useMemo(
    () => buildColumns({ navigate, onRollbackSuccess: () => loadDeployments() }),
    [navigate, loadDeployments]
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader totalCount={filteredDeployments.length} loading={loading} onRefresh={handleRefresh} />

      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={FILTER_DEFS}
          searchPlaceholder="搜索应用名称、版本、提交..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredDeployments}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        locale={
          filteredDeployments.length === 0
            ? {
                emptyText: (
                  <Empty description="暂无部署记录" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                    <Button
                      type="primary"
                      icon={<RocketOutlined />}
                      onClick={() => navigate('/deployments/new')}
                    >
                      创建部署
                    </Button>
                  </Empty>
                ),
              }
            : undefined
        }
      />
    </div>
  );
};

export default DeploymentList;
