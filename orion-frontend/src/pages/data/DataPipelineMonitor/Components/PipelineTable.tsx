/**
 * PipelineTable - 管道列表 Card（含筛选器）
 * 抽取自 index.tsx (P2-9 Phase 107)
 */
import React, { useMemo } from 'react';
import { Card, Table, Select, Space, Empty } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { Pipeline } from '../types';
import { STATUS_OPTIONS, FREQUENCY_OPTIONS } from '../constants';
import { buildPipelineColumns } from '../columns';

interface PipelineTableProps {
  dataSource: Pipeline[];
  filterStatus: string | null;
  filterFrequency: string | null;
  onFilterStatusChange: (v: string | null) => void;
  onFilterFrequencyChange: (v: string | null) => void;
}

export const PipelineTable: React.FC<PipelineTableProps> = ({
  dataSource,
  filterStatus,
  filterFrequency,
  onFilterStatusChange,
  onFilterFrequencyChange,
}) => {
  const columns = useMemo(() => buildPipelineColumns(), []);

  return (
    <Card title="管道列表">
      <Space size="small" style={{ marginBottom: spacing.sm }}>
        <FilterOutlined style={{ color: colors.neutral[500] }} />
        <Select
          style={{ width: 110 }}
          placeholder="状态筛选"
          value={filterStatus || undefined}
          onChange={(v) => onFilterStatusChange(v || null)}
          options={STATUS_OPTIONS}
          allowClear
        />
        <Select
          style={{ width: 110 }}
          placeholder="频率筛选"
          value={filterFrequency || undefined}
          onChange={(v) => onFilterFrequencyChange(v || null)}
          options={FREQUENCY_OPTIONS}
          allowClear
        />
      </Space>
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: 900 }}
        locale={{ emptyText: <Empty description="暂无数据管道" /> }}
      />
    </Card>
  );
};
