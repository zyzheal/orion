/**
 * ServiceHealthTable - 服务健康表
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import React from 'react';
import { Card, Empty, Space, Table } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { HealthDashboardState } from '../useHealthDashboardState';
import { serviceColumns } from '../serviceColumns';

interface ServiceHealthTableProps {
  state: HealthDashboardState;
}

export const ServiceHealthTable: React.FC<ServiceHealthTableProps> = ({ state }) => {
  const { services } = state;

  return (
    <Card
      style={{ marginBottom: spacing.lg }}
      title={
        <Space>
          <CheckCircleOutlined style={{ color: colors.primary[500] }} />
          服务健康列表
        </Space>
      }
    >
      <Table
        rowKey="serviceId"
        columns={serviceColumns}
        dataSource={services}
        pagination={false}
        size="small"
        scroll={{ x: 800 }}
        locale={{ emptyText: <Empty description="暂无服务健康数据" /> }}
      />
    </Card>
  );
};
