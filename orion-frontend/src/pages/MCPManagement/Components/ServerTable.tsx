/**
 * MCPManagement server list table
 * 抽取自 index.tsx (P2-9 Phase 147)
 */
import React from 'react';
import { Button, Card, Empty, Space, Table } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { buildServerColumns, type ServerColumnDeps } from '../columns';
import type { MCPService } from '../types';

interface ServerTableProps {
  servers: MCPService[];
  loading: boolean;
  colDeps: ServerColumnDeps;
  onRefresh: () => void;
  onOpenCreate: () => void;
}

export const ServerTable: React.FC<ServerTableProps> = ({
  servers,
  loading,
  colDeps,
  onRefresh,
  onOpenCreate,
}) => (
  <Card
    title="MCP 服务列表"
    extra={
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onOpenCreate}>
          注册服务
        </Button>
      </Space>
    }
  >
    <Table
      dataSource={servers}
      columns={buildServerColumns(colDeps)}
      rowKey="id"
      loading={loading}
      size="small"
      pagination={false}
      locale={{ emptyText: <Empty description="暂无 MCP 服务" /> }}
    />
  </Card>
);
