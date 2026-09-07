/**
 * Header - 租户管理标题栏 + 批量操作按钮
 * 抽取自 index.tsx (P2-9 Phase 109)
 */
import React from 'react';
import { Typography, Button, Space, Popconfirm } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  BankOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { TenantListState } from '../useTenantListState';

const { Title, Text } = Typography;

interface HeaderProps {
  state: TenantListState;
}

export const Header: React.FC<HeaderProps> = ({ state }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <BankOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        租户管理
      </Title>
      <Text type="secondary">创建和管理租户，分配资源配额和 Namespace</Text>
    </div>
    <Space>
      {state.selectedRowKeys.length > 0 && (
        <Popconfirm
          title="确认批量删除"
          description={`确定要删除选中的 ${state.selectedRowKeys.length} 个租户吗？此操作将软删除这些租户。`}
          onConfirm={state.handleBatchDelete}
          okText="确认删除"
          cancelText="取消"
        >
          <Button danger icon={<DeleteOutlined />} loading={state.batchDeleting}>
            批量删除 ({state.selectedRowKeys.length})
          </Button>
        </Popconfirm>
      )}
      <Button icon={<ReloadOutlined />} onClick={state.loadTenants} loading={state.loading}>
        刷新
      </Button>
      <Button icon={<DownloadOutlined />} onClick={state.handleExportCSV}>
        导出 CSV
      </Button>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => state.setCreateModalOpen(true)}
      >
        创建租户
      </Button>
    </Space>
  </div>
);
