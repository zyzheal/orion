/**
 * RiskDashboard events table
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
import React, { useMemo } from 'react';
import { Card, Table } from 'antd';
import type { RiskEvent } from '@/api/risk';
import { buildEventColumns } from '../riskColumns';

interface EventsTableProps {
  eventTableData: Array<RiskEvent & { key: string }>;
  loading: boolean;
  handleAcknowledge: (id: string) => Promise<void>;
}

export const EventsTable: React.FC<EventsTableProps> = ({
  eventTableData,
  loading,
  handleAcknowledge,
}) => {
  const columns = useMemo(() => buildEventColumns({ handleAcknowledge }), [handleAcknowledge]);
  return (
    <Card title="风险事件">
      <Table
        columns={columns}
        dataSource={eventTableData}
        loading={loading}
        pagination={{ pageSize: 5 }}
        size="small"
      />
    </Card>
  );
};
