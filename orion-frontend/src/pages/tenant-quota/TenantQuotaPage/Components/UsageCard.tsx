/**
 * TenantQuotaPage Usage Card
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import React from 'react';
import { Card, Table, Button, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { QuotaUsage } from '@/api/tenantQuota';
import { buildUsageColumns } from '../columns';

interface UsageCardProps {
  usages: QuotaUsage[];
  loadUsage: () => void;
  handleCheckQuota: (metric: string) => void;
}

export const UsageCard: React.FC<UsageCardProps> = ({
  usages,
  loadUsage,
  handleCheckQuota,
}) => (
  <Card
    title="用量明细"
    extra={
      <Button icon={<ReloadOutlined />} size="small" onClick={loadUsage}>
        刷新
      </Button>
    }
  >
    <Table
      columns={buildUsageColumns(handleCheckQuota)}
      dataSource={usages}
      rowKey="id"
      size="small"
      locale={{ emptyText: <Empty description="暂无用量数据" /> }}
      pagination={{ pageSize: 10 }}
    />
  </Card>
);
