/**
 * EventBus Monitoring filter bar
 * 抽取自 index.tsx (P2-9 Phase 164)
 */
import { Card, Input, Select, Space, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens/spacing';
import { statusFilterOptions } from '../constants';

const { Text } = Typography;

interface FilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  eventTypes: string[];
}

export const FilterBar = ({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  eventTypes,
}: FilterBarProps) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <Space wrap>
      <Input.Search
        placeholder="搜索事件类型、来源、Trace ID..."
        allowClear
        style={{ width: 280 }}
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onSearch={onSearchQueryChange}
      />
      <Text>
        <FilterOutlined /> 状态:
      </Text>
      <Select
        style={{ width: 120 }}
        value={statusFilter}
        onChange={onStatusFilterChange}
        options={statusFilterOptions}
      />
      <Text>事件类型:</Text>
      <Select
        style={{ width: 200 }}
        value={typeFilter}
        onChange={onTypeFilterChange}
        options={[
          { label: '全部', value: 'all' },
          ...eventTypes.map((t) => ({ label: t, value: t })),
        ]}
      />
    </Space>
  </Card>
);
