/**
 * Sessions Table
 * 抽取自 index.tsx (P2-9 Phase 130)
 */
import React from 'react';
import { Card } from 'antd';
import Table from '@/components/Table';
import type { UserSession } from '../types';
import { buildSessionColumns } from '../sessionColumns';

interface SessionsTableProps {
  filteredSessions: UserSession[];
  loading: boolean;
  openDetail: (session: UserSession) => void;
  handleRevoke: (id: string) => void;
}

export const SessionsTable: React.FC<SessionsTableProps> = ({
  filteredSessions,
  loading,
  openDetail,
  handleRevoke,
}) => (
  <Card>
    <Table
      columns={buildSessionColumns({ openDetail, handleRevoke })}
      dataSource={filteredSessions}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
    />
  </Card>
);
