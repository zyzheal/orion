/**
 * Infrastructure Edge List
 * Renders the connection relationships between infrastructure nodes.
 */
import React from 'react';
import { Card, Tag, Typography } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { InfrastructureNode, GraphEdge } from '@/api/graph';

const { Text } = Typography;

export interface InfrastructureEdgeListProps {
  nodes: InfrastructureNode[];
  edges: GraphEdge[];
}

const InfrastructureEdgeList: React.FC<InfrastructureEdgeListProps> = ({
  nodes,
  edges,
}) => {
  if (edges.length === 0) return null;

  return (
    <Card title="连接关系" size="small" style={{ marginTop: spacing.md }} >
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {edges.map((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          return (
            <div
              key={edge.id}
              style={edgeItemStyle}
            >
              <Tag color="blue">{sourceNode?.name ?? edge.source}</Tag>
              <Text type="secondary">{edge.label || '连接'}</Text>
              <Text type="secondary">→</Text>
              <Tag color="purple">{targetNode?.name ?? edge.target}</Tag>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const edgeItemStyle: React.CSSProperties = {
  padding: '6px 0',
  borderBottom: `1px solid ${colors.neutral[100]}`,
  display: 'flex',
  alignItems: 'center',
  gap: spacing.sm,
};

export default InfrastructureEdgeList;
