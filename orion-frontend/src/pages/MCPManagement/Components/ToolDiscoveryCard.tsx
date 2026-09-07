/**
 * MCPManagement tool discovery card
 * 抽取自 index.tsx (P2-9 Phase 147)
 */
import React from 'react';
import { Button, Card, Empty, Table } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { buildToolColumns } from '../columns';
import type { MCPService, MCPTool } from '../types';

interface ToolDiscoveryCardProps {
  server: MCPService | null;
  tools: MCPTool[];
  loading: boolean;
  onRefreshTools: (id: string) => void;
}

export const ToolDiscoveryCard: React.FC<ToolDiscoveryCardProps> = ({
  server,
  tools,
  loading,
  onRefreshTools,
}) => {
  if (!server) return null;
  return (
    <Card
      title={`工具发现: ${server.name}`}
      extra={
        <Button size="small" icon={<EyeOutlined />} onClick={() => onRefreshTools(server.id)}>
          刷新工具
        </Button>
      }
      style={{ marginTop: spacing.md }}
    >
      <Table
        dataSource={tools}
        columns={buildToolColumns()}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
        locale={{ emptyText: <Empty description="暂无工具" /> }}
      />
    </Card>
  );
};
