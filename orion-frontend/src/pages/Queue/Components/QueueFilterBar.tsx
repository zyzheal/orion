/**
 * QueueFilterBar.tsx - 队列筛选栏（状态 + 队列名）
 * 抽取自 index.tsx (P2-9 Phase 237)
 */
import React from 'react';
import { Card, Select, Space, Typography } from 'antd';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface Props {
  statusFilter?: string;
  setStatusFilter: (v: string) => void;
  queueFilter?: string;
  setQueueFilter: (v: string) => void;
  queueNames: string[];
}

export const QueueFilterBar: React.FC<Props> = ({
  statusFilter,
  setStatusFilter,
  queueFilter,
  setQueueFilter,
  queueNames,
}) => (
  <Card size="small" style={{ marginBottom: spacing.md }}>
    <Space>
      <Text>状态筛选:</Text>
      <Select
        style={{ width: 120 }}
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { label: '全部', value: 'all' },
          { label: '等待中', value: 'pending' },
          { label: '处理中', value: 'processing' },
          { label: '已完成', value: 'completed' },
          { label: '已失败', value: 'failed' },
        ]}
      />
      <Text style={{ marginLeft: spacing.md }}>队列筛选:</Text>
      <Select
        style={{ width: 160 }}
        value={queueFilter}
        onChange={setQueueFilter}
        options={[
          { label: '全部', value: 'all' },
          ...queueNames.map((n) => ({ label: n, value: n })),
        ]}
      />
    </Space>
  </Card>
);
