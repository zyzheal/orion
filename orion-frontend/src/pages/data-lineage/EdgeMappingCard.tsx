/**
 * EdgeMappingCard.tsx - Edge Mappings 卡片 (显示选中节点的连接边)
 * 抽取自 DataLineagePage.tsx (P2-9 Phase 61)
 */
import React from 'react';
import { Card, Button, Table, Tag, Space, Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { LineageEdge, LineageNode } from '@/api/data-lineage';

const { Text } = Typography;

export interface EdgeMappingCardProps {
  selectedNode: LineageNode;
  edges: LineageEdge[];
  onClose: () => void;
  onEdgeMapping: (edge: LineageEdge) => void;
}

export const EdgeMappingCard: React.FC<EdgeMappingCardProps> = ({
  selectedNode,
  edges,
  onClose,
  onEdgeMapping,
}) => {
  return (
    <Card
      title={`Edge Mappings — ${selectedNode.name}`}
      style={{ marginBottom: spacing.md }}
      extra={
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Table
        columns={[
          { title: 'From', dataIndex: 'from', key: 'from', width: 120 },
          { title: 'To', dataIndex: 'to', key: 'to', width: 120 },
          {
            title: 'Relationship',
            dataIndex: 'relationship',
            key: 'relationship',
            render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
          },
          {
            title: 'Field Mapping',
            dataIndex: 'fieldMapping',
            key: 'fieldMapping',
            render: (fm: Record<string, string> | undefined) => {
              if (!fm || Object.keys(fm).length === 0) return <Text type="secondary">—</Text>;
              return (
                <Space size="small" wrap>
                  {Object.entries(fm).map(([k, v]) => (
                    <Tag key={String(k)} color="cyan">
                      {k} → {v}
                    </Tag>
                  ))}
                </Space>
              );
            },
          },
          {
            title: '',
            key: 'action',
            render: (_: unknown, record: LineageEdge) => (
              <Button
                size="small"
                icon={<LinkOutlined />}
                onClick={() => onEdgeMapping(record)}
              >
                Detail
              </Button>
            ),
          },
        ]}
        dataSource={edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)}
        rowKey="id"
        pagination={false}
        size="small"
      />
    </Card>
  );
};
