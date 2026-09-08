/**
 * Product Line Management Page
 * List, create, edit product lines; manage ReleaseTrains and HotfixChannels
 *
 * 主入口 (P2-9 Phase 95 refactor: 已抽取 BranchResolver / DetailTabs / useProductLineState)
 * P2-9 Phase 283: 154->86 行 (-44%), 新增 Components/{PageHeader,ModalsBundle}.tsx
 */
import React, { useMemo } from 'react';
import { Card } from 'antd';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { spacing } from '@/tokens';
import { filterDefinitions, buildProductLineColumns } from './columns';
import { BranchResolver } from './Components/BranchResolver';
import { useDetailTabs } from './Components/DetailTabs';
import { PageHeader } from './Components/PageHeader';
import { ProductLineModalsBundle } from './Components/ModalsBundle';
import { useProductLineState } from './useProductLineState';

dayjs.extend(relativeTime);

const ProductLineManagement: React.FC = () => {
  const state = useProductLineState();

  const columns = useMemo(
    () =>
      buildProductLineColumns({
        openDetail: state.openDetail,
        openEdit: state.openEdit,
        handleActivate: state.handleActivate,
        handleSuspend: state.handleSuspend,
        handleDelete: state.handleDelete,
      }),
    [state.openDetail, state.openEdit, state.handleActivate, state.handleSuspend, state.handleDelete],
  );

  const { items: detailTabItems } = useDetailTabs({
    selectedPL: state.selectedPL,
    releaseTrains: state.releaseTrains,
    hotfixChannels: state.hotfixChannels,
    onOpenRtModal: () => state.setRtModalVisible(true),
    onOpenHfModal: () => state.setHfModalVisible(true),
  });

  if (state.isInitialLoading) {
    return <PageSkeleton rows={8} />;
  }

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={state.loading}
        onRefresh={state.loadData}
        onCreateClick={() => state.setCreateModalVisible(true)}
      />

      <BranchResolver productLines={state.productLines} />

      <Card>
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={state.setSearchQuery}
            onFilter={state.setFilters}
            filters={filterDefinitions}
            searchPlaceholder="搜索产品线..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={state.filteredData}
          loading={state.loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      <ProductLineModalsBundle state={state} detailTabItems={detailTabItems as any} />
    </div>
  );
};

export default ProductLineManagement;
