/**
 * DeploymentsTab - 部署任务列表
 * 抽取自 DeployPage.tsx (P2-9 Phase 113)
 */
import React from 'react';
import { Card, Input, Select, Table as AntTable } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import type { Deployment } from '@/api/deployments';
import { spacing } from '@/tokens';
import { useDeployColumns } from '../columns';
import type { DeployState } from '../useDeployState';

interface DeploymentsTabProps {
  state: DeployState;
}

export const DeploymentsTab: React.FC<DeploymentsTabProps> = ({ state }) => {
  const {
    loading,
    filteredData,
    searchQuery,
    setSearchQuery,
    setFilters,
    openDetail,
    handleExecute,
    handleCancel,
    handleRollback,
  } = state;

  const columns = useDeployColumns({ openDetail, handleExecute, handleCancel, handleRollback });

  return (
    <Card>
      <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing[3] }}>
        <Input.Search
          placeholder="搜索应用、版本..."
          onSearch={setSearchQuery}
          style={{ width: 300 }}
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select
          placeholder="环境"
          style={{ width: 120 }}
          allowClear
          onChange={(v) => setFilters((prev) => ({ ...prev, environment: v || 'all' }))}
          options={[
            { label: '全部', value: 'all' },
            { label: '开发', value: 'dev' },
            { label: '预发', value: 'staging' },
            { label: '生产', value: 'prod' },
          ]}
        />
        <Select
          placeholder="状态"
          style={{ width: 120 }}
          allowClear
          onChange={(v) => setFilters((prev) => ({ ...prev, status: v || 'all' }))}
          options={[
            { label: '全部', value: 'all' },
            { label: '等待中', value: 'pending' },
            { label: '部署中', value: 'deploying' },
            { label: '成功', value: 'success' },
            { label: '失败', value: 'failed' },
            { label: '已回滚', value: 'rolled_back' },
          ]}
        />
        <Select
          placeholder="策略"
          style={{ width: 140 }}
          allowClear
          onChange={(v) => setFilters((prev) => ({ ...prev, strategy: v || 'all' }))}
          options={[
            { label: '全部', value: 'all' },
            { label: '蓝绿部署', value: 'blue-green' },
            { label: '金丝雀', value: 'canary' },
            { label: '滚动部署', value: 'rolling' },
            { label: '重建部署', value: 'recreate' },
          ]}
        />
      </div>
      <AntTable<Deployment>
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
      />
    </Card>
  );
};

export const DeploymentsTabLabel = (
  <>
    <RocketOutlined style={{ marginRight: 6 }} />
    部署任务
  </>
);
