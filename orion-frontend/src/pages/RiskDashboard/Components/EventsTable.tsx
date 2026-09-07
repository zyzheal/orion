/**
 * EventsTable - 风险事件表
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import { Table } from 'antd';
import CardPanel from '@/components/CardPanel';
import { buildEventColumns } from '../riskColumns';
import type { RiskDashboardState } from '../useRiskDashboardState';

interface EventsTableProps {
  state: RiskDashboardState;
}

export const EventsTable: React.FC<EventsTableProps> = ({ state }) => {
  const { loading, eventTableData, handleAcknowledge } = state;

  const columns = buildEventColumns({ handleAcknowledge });

  return (
    <CardPanel title="风险事件">
      <Table
        columns={columns}
        dataSource={eventTableData}
        loading={loading}
        pagination={{ pageSize: 5 }}
        size="small"
      />
    </CardPanel>
  );
};
