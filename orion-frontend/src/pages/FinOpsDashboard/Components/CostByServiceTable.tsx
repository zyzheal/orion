/**
 * CostByServiceTable - 服务成本明细表
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Card } from 'antd';
import TableComponent from '@/components/Table';
import { spacing } from '@/tokens';
import type { FinOpsDashboardState } from '../useFinOpsDashboardState';
import { costByServiceColumns } from '../costByServiceColumns';

interface CostByServiceTableProps {
  state: FinOpsDashboardState;
}

export const CostByServiceTable: React.FC<CostByServiceTableProps> = ({ state }) => {
  const { loading, costByService } = state;

  return (
    <Card
      title="各服务成本明细"
      bordered={false}
      style={{ borderRadius: 8, marginBottom: spacing.md }}
      loading={loading}
    >
      <TableComponent
        columns={costByServiceColumns}
        dataSource={costByService}
        rowKey="key"
        size="middle"
        pagination={false}
      />
    </Card>
  );
};
