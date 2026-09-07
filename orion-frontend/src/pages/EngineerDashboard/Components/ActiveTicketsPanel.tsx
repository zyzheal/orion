/**
 * Active Tickets Panel
 * 抽取自 index.tsx (P2-9 Phase 129)
 */
import React from 'react';
import { Table, Tag, Badge } from 'antd';
import CardPanel from '@/components/CardPanel';
import { spacing } from '@/tokens';
import { colors } from '@/tokens';
import type { EngineerDashboardData } from '@/types/pages';
import { activeTicketColumns } from '../activeTicketColumns';
import { COLORS } from '../constants';

interface ActiveTicketsPanelProps {
  data: EngineerDashboardData;
}

export const ActiveTicketsPanel: React.FC<ActiveTicketsPanelProps> = ({ data }) => (
  <div style={{ marginBottom: spacing.lg }}>
    <CardPanel
      title="活跃工单"
      extra={
        <Badge count={data.activeTickets.length} style={{ backgroundColor: COLORS.info }}>
          <Tag>处理中</Tag>
        </Badge>
      }
    >
      <Table
        dataSource={data.activeTickets}
        columns={activeTicketColumns}
        rowKey="ticketId"
        pagination={false}
        size="middle"
        rowClassName={(record) => (record.isOverdue ? 'overdue-row' : '')}
      />
      <style>{`
        .overdue-row {
          background-color: ${colors.error[50]} !important;
        }
        .overdue-row:hover td {
          background-color: ${colors.error[100]} !important;
        }
      `}</style>
    </CardPanel>
  </div>
);
