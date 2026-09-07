/**
 * SBOM Component Table Card
 * 抽取自 index.tsx (P2-9 Phase 134)
 */
import React from 'react';
import { Card, Table, Space, Select, Empty } from 'antd';
import { spacing } from '@/tokens';
import type { SBOMComponent } from '../types';
import { buildSbomColumns } from '../sbomColumns';

const { Option } = Select;

interface ComponentTableCardProps {
  filteredComponents: SBOMComponent[];
  loading: boolean;
  filterType: string;
  setFilterType: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  handleViewSBOM: (record: SBOMComponent) => void;
  handleViewVulnDetails: (record: SBOMComponent) => void;
}

export const ComponentTableCard: React.FC<ComponentTableCardProps> = ({
  filteredComponents,
  loading,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  handleViewSBOM,
  handleViewVulnDetails,
}) => (
  <Card
    title="依赖组件列表"
    style={{ borderRadius: 12 }}
    extra={
      <Space size={spacing.md}>
        <Select
          placeholder="按类型筛选"
          value={filterType}
          style={{ width: 140 }}
          onChange={(v) => setFilterType(v)}
        >
          <Option value="all">全部类型</Option>
          <Option value="npm">npm</Option>
          <Option value="Go">Go</Option>
          <Option value="Python">Python</Option>
          <Option value="Maven">Maven</Option>
          <Option value="Docker">Docker</Option>
        </Select>
        <Select
          placeholder="按状态筛选"
          value={filterStatus}
          style={{ width: 140 }}
          onChange={(v) => setFilterStatus(v)}
        >
          <Option value="all">全部状态</Option>
          <Option value="safe">安全</Option>
          <Option value="vulnerable">有漏洞</Option>
          <Option value="expired">过期</Option>
        </Select>
      </Space>
    }
  >
    <Table
      loading={loading}
      columns={buildSbomColumns({ handleViewSBOM, handleViewVulnDetails })}
      dataSource={filteredComponents}
      rowKey="key"
      rowHoverable
      pagination={{ pageSize: 10, showSizeChanger: false }}
      style={{ fontSize: 13 }}
      locale={{ emptyText: <Empty description="暂无 SBOM 组件数据" /> }}
    />
  </Card>
);
