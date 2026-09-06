/**
 * Product Line Management Page
 * List, create, edit product lines; manage ReleaseTrains and HotfixChannels
 *
 * 主入口 (P2-9 Phase 95 refactor: 已抽取 BranchResolver / DetailTabs / useProductLineState)
 */
import React, { useMemo } from 'react';
import { Typography, Button, Space, Card } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import PageSkeleton from '@/components/PageSkeleton';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { colors, spacing } from '@/tokens';
import { filterDefinitions } from './columns';
import { ProductLineModals } from './ProductLineModals';
import { BranchResolver } from './Components/BranchResolver';
import { useDetailTabs } from './Components/DetailTabs';
import { buildProductLineColumns } from './columns';
import { useProductLineState } from './useProductLineState';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

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
    [
      state.openDetail,
      state.openEdit,
      state.handleActivate,
      state.handleSuspend,
      state.handleDelete,
    ],
  );

  const { items: detailTabItems } = useDetailTabs({
    selectedPL: state.selectedPL,
    releaseTrains: state.releaseTrains,
    hotfixChannels: state.hotfixChannels,
    onOpenRtModal: () => state.setRtModalVisible(true),
    onOpenHfModal: () => state.setHfModalVisible(true),
  });

  if (state.isInitialLoading) {
    return (
      <div style={{ padding: 0 }}>
        <PageSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <AppstoreOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            多分支产品线
          </Title>
          <Text type="secondary">管理产品线的分支策略、环境映射、发布列车和紧急修复通道</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={state.loadData} loading={state.loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => state.setCreateModalVisible(true)}
          >
            创建产品线
          </Button>
        </Space>
      </div>

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

      <ProductLineModals
        createModalVisible={state.createModalVisible}
        setCreateModalVisible={state.setCreateModalVisible}
        editModalVisible={state.editModalVisible}
        setEditModalVisible={state.setEditModalVisible}
        editingPL={state.editingPL}
        setEditingPL={state.setEditingPL}
        detailDrawerVisible={state.detailDrawerVisible}
        setDetailDrawerVisible={state.setDetailDrawerVisible}
        selectedPL={state.selectedPL}
        setSelectedPL={state.setSelectedPL}
        releaseTrains={state.releaseTrains}
        hotfixChannels={state.hotfixChannels}
        rtModalVisible={state.rtModalVisible}
        setRtModalVisible={state.setRtModalVisible}
        hfModalVisible={state.hfModalVisible}
        setHfModalVisible={state.setHfModalVisible}
        createForm={state.createForm}
        editForm={state.editForm}
        rtForm={state.rtForm}
        hfForm={state.hfForm}
        submitting={state.submitting}
        setSubmitting={state.setSubmitting}
        handleCreate={state.handleCreate}
        handleEdit={state.handleEdit}
        handleCreateRT={state.handleCreateRT}
        handleCreateHF={state.handleCreateHF}
        productLines={state.productLines}
        detailTabItems={detailTabItems as any}
      />
    </div>
  );
};

export default ProductLineManagement;
