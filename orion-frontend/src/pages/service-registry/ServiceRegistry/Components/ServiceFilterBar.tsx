/**
 * ServiceRegistry Filter Bar
 * 抽取自 index.tsx (P2-9 Phase 142)
 */
import React from 'react';
import { Card, Input, Select, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { spacing, componentRadius } from '@/tokens';
import { HEALTH_OPTIONS } from '../constants';

const { Option } = Select;

interface ServiceFilterBarProps {
  searchText: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  healthFilter: string | undefined;
  onHealthFilterChange: (v: string) => void;
}

export const ServiceFilterBar: React.FC<ServiceFilterBarProps> = ({
  searchText,
  onSearchChange,
  healthFilter,
  onHealthFilterChange,
}) => (
  <Card size="small" style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
    <Space size="middle" wrap>
      <Input
        placeholder="搜索服务名..."
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={onSearchChange}
        style={{ width: 220 }}
        allowClear
      />
      <Select
        placeholder="健康状态"
        value={healthFilter}
        onChange={onHealthFilterChange}
        style={{ width: 140 }}
        allowClear
      >
        {HEALTH_OPTIONS.map((o) => (
          <Option key={o.value} value={o.value}>
            {o.label}
          </Option>
        ))}
      </Select>
    </Space>
  </Card>
);
