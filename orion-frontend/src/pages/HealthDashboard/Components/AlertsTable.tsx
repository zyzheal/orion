/**
 * AlertsTable - 告警表
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import React from 'react';
import { Card, Empty, Space, Table } from 'antd';
import { AlertOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { HealthDashboardState } from '../useHealthDashboardState';
import { alertColumns } from '../alertColumns';

interface AlertsTableProps {
  state: HealthDashboardState;
}

export const AlertsTable: React.FC<AlertsTableProps> = ({ state }) => {
  const { alerts } = state;

  return (
    <Card
      style={{ marginBottom: spacing.lg }}
      title={
        <Space>
          <AlertOutlined style={{ color: colors.error[500] }} />
          告警列表
        </Space>
      }
    >
      <Table
        rowKey="id"
        columns={alertColumns}
        dataSource={alerts}
        pagination={{ pageSize: 5 }}
        scroll={{ x: 700 }}
        locale={{ emptyText: <Empty description="暂无告警" /> }}
      />
    </Card>
  );
};
