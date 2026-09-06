/**
 * FilterBar - 状态/队列筛选栏
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import React from 'react';
import { Card, Space, Select, Typography } from 'antd';
import { spacing } from '@/tokens';
import { STATUS_FILTER_OPTIONS } from '../constants';
import type { QueueState } from '../useQueueState';

const { Text } = Typography;

interface FilterBarProps {
  state: QueueState;
}

export const FilterBar: React.FC<FilterBarProps> = ({ state }) => (
  <Card size="small" style={{ marginBottom: spacing.md }} className="queue-filter-bar">
    <Space>
      <Text>状态筛选:</Text>
      <Select
        style={{ width: 120 }}
        value={state.statusFilter}
        onChange={state.setStatusFilter}
        options={STATUS_FILTER_OPTIONS}
      />
      <Text style={{ marginLeft: spacing.md }}>队列筛选:</Text>
      <Select
        style={{ width: 160 }}
        value={state.queueFilter}
        onChange={state.setQueueFilter}
        options={[
          { label: '全部', value: 'all' },
          ...state.queueNames.map((n) => ({ label: n, value: n })),
        ]}
      />
    </Space>
  </Card>
);
