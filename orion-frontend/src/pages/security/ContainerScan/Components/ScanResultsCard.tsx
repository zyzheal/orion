/**
 * ContainerScan Results Card
 * 抽取自 index.tsx (P2-9 Phase 133)
 */
import React from 'react';
import { Card, Table, Space, Input, Select, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ImageScanRecord } from '../types';
import type { ScanStatus } from '../types';
import { buildScanColumns } from '../scanColumns';

const { Search } = Input;
const { Option } = Select;

interface ScanResultsCardProps {
  loading: boolean;
  filteredData: ImageScanRecord[];
  searchText: string;
  setSearchText: (v: string) => void;
  statusFilter: ScanStatus | 'all';
  setStatusFilter: (v: ScanStatus | 'all') => void;
  scanningKey: string | null;
  handleScan: (record: ImageScanRecord) => void;
}

export const ScanResultsCard: React.FC<ScanResultsCardProps> = ({
  loading,
  filteredData,
  searchText,
  setSearchText,
  statusFilter,
  setStatusFilter,
  scanningKey,
  handleScan,
}) => (
  <Card
    title={
      <Space>
        <SearchOutlined />
        <span>扫描结果</span>
      </Space>
    }
    style={{
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    }}
  >
    <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing.sm }}>
      <Search
        placeholder="搜索镜像名称或标签"
        allowClear
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={
          { width: 280 } as React.CSSProperties
        }
      />
      <Select
        placeholder="筛选状态"
        value={statusFilter}
        onChange={setStatusFilter}
        style={{ width: 160 }}
      >
        <Option value="all">全部</Option>
        <Option value="passed">通过</Option>
        <Option value="vulnerable">有漏洞</Option>
        <Option value="failed">扫描失败</Option>
      </Select>
    </div>

    <Table
      loading={loading}
      columns={buildScanColumns({ scanningKey, handleScan })}
      dataSource={filteredData}
      rowKey="key"
      size="small"
      pagination={{ pageSize: 8, showSizeChanger: false, showQuickJumper: true }}
      scroll={{ x: 800 }}
      style={{ marginTop: spacing.sm }}
      locale={{ emptyText: <Empty description="暂无扫描记录，请创建扫描策略并执行扫描" /> }}
    />
  </Card>
);
