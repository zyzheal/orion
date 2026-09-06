/**
 * EphemeralEnvList Page - 临时开发环境
 * 数据环境列表、成本查看、唤醒/销毁
 * 9 文件拆分: types.ts + constants.ts + useEphemeralEnvState.ts + EphemeralEnvColumns.tsx + CreateEnvModal.tsx + CostDrawer.tsx + SummaryCards.tsx + index.tsx
 * 抽取自 700 行原始文件 (P2-9 Phase 69)
 */
import React, { useState } from 'react';
import { Typography, Button, Space } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import { useEphemeralEnvState } from './useEphemeralEnvState';
import { useEphemeralEnvColumns } from './EphemeralEnvColumns';
import { CreateEnvModal } from './CreateEnvModal';
import { CostDrawer } from './CostDrawer';
import { SummaryCards } from './SummaryCards';

const { Title, Text } = Typography;

const EphemeralEnvList: React.FC = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const {
    loading,
    filteredEnvs,
    setSearchQuery,
    setFilters,
    filterDefs,
    summary,
    costDrawerOpen,
    selectedEnv,
    loadEnvs,
    handleViewDetail,
    handleOpenPreview,
    handleWake,
    handleTeardown,
    handleViewCost,
    closeCostDrawer,
  } = useEphemeralEnvState();

  const columns = useEphemeralEnvColumns({
    handleViewDetail,
    handleOpenPreview,
    handleWake,
    handleTeardown,
    handleViewCost,
  });

  return (
    <div style={{ padding: 0 }} data-testid="ephemeral-env-list-page">
      {/* Page header */}
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
            <CloudServerOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            临时开发环境
          </Title>
          <Text type="secondary">共 {filteredEnvs.length} 个环境</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadEnvs} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            data-testid="create-env-button"
          >
            创建环境
          </Button>
        </Space>
      </div>

      {/* Summary cards */}
      <SummaryCards summary={summary} />

      {/* Search and filter bar */}
      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索 PR、仓库、分支、Namespace..."
        />
      </div>

      {/* Environment table */}
      <Table
        columns={columns}
        dataSource={filteredEnvs}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        data-testid="env-table"
      />

      {/* Create environment modal */}
      <CreateEnvModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          loadEnvs();
        }}
      />

      {/* Cost drawer */}
      <CostDrawer
        env={selectedEnv}
        open={costDrawerOpen}
        onClose={closeCostDrawer}
      />
    </div>
  );
};

export default EphemeralEnvList;
