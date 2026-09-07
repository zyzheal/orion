/**
 * Sessions Filters
 * 抽取自 index.tsx (P2-9 Phase 130)
 */
import React from 'react';
import { Card, Input, Select, Space, Typography } from 'antd';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens/spacing';
import { statusFilterOptions } from '../constants';

const { Text } = Typography;

interface FiltersProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}

export const Filters: React.FC<FiltersProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
}) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <Space wrap>
      <Input
        placeholder="搜索用户、Session ID 或 IP 地址..."
        allowClear
        prefix={<SearchOutlined />}
        style={{ width: 280 }}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <Text>
        <FilterOutlined /> 状态:
      </Text>
      <Select
        style={{ width: 130 }}
        value={statusFilter}
        onChange={setStatusFilter}
        options={statusFilterOptions}
      />
    </Space>
  </Card>
);
