import { useMemo } from 'react';
import { Card } from 'antd';
import { spacing } from '@/tokens';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import ArtifactStats from './ArtifactStats';
import ArtifactTable from './ArtifactTable';
import { getArtifactTabItems } from './ArtifactDetail';
import { useArtifactState } from './useArtifactState';
import { PageHeader } from './Components/PageHeader';
import { ArtifactModalsBundle } from './Components/ModalsBundle';


const ArtifactManagement: React.FC = () => {
  const state = useArtifactState();
  const { loading, artifacts, filteredData, stats } = state;

  const detailTabItems = useMemo(
    () => getArtifactTabItems(state.selectedArtifact, state.tags, state.promotionHistory, state.openTagModal),
    [state.selectedArtifact, state.tags, state.promotionHistory, state.openTagModal]
  );

  const isInitialLoading = loading && artifacts.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading && <PageSkeleton cards={7} rows={8} />}

      {isInitialLoading ? null : (
        <>
          <PageHeader
            loading={loading}
            onRefresh={() => { state.loadData(); state.loadStats(); }}
            onCreate={() => state.setCreateModalVisible(true)}
          />

          {stats && <ArtifactStats stats={stats} />}

          <Card>
            <div style={{ marginBottom: spacing.md }}>
              <SearchFilterBar
                onSearch={state.setSearchQuery}
                onFilter={state.setFilters}
                filters={state.filterDefs}
                searchPlaceholder="搜索制品..."
              />
            </div>
            <ArtifactTable
              dataSource={filteredData}
              loading={loading}
              currentPage={state.currentPage}
              pageSize={state.pageSize}
              total={state.total}
              onDetail={state.openDetail}
              onEdit={state.openEdit}
              onPromote={state.openPromotion}
              onTag={state.openTagModal}
              onDownload={state.handleDownload}
              onDeprecate={state.handleDeprecate}
              onQuarantine={state.handleQuarantine}
              onDelete={state.handleDelete}
              onPaginationChange={(page, size) => {
                state.setCurrentPage(page);
                state.setPageSize(size);
                state.loadData(page, size);
              }}
            />
          </Card>

          <ArtifactModalsBundle state={state} detailTabItems={detailTabItems} />
        </>
      )}
    </div>
  );
};

export default ArtifactManagement;
