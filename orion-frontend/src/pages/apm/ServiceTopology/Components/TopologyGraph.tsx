/**
 * TopologyGraph - APM Service Topology 拓扑图
 * 抽取自 index.tsx (P2-9 Phase 218)
 */
import { useMemo } from 'react';
import { Card, Empty, Tag, Typography } from 'antd';
import { DeploymentUnitOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

const { Text } = Typography;

interface ServiceNodeData {
  name: string;
  totalCalls: number;
  avgLatency: number;
  errorRate: number;
}

interface Props {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
}

export const TopologyGraph = ({ nodes, edges, onNodesChange, onEdgesChange }: Props) => {
  // Custom node renderer
  const nodeTypes = useMemo(
    () => ({
      serviceNode: ({ data }: { data: ServiceNodeData }) => (
        <div style={{ padding: '8px 12px', minWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 6 }}>
            <DeploymentUnitOutlined
              style={{
                color: (data as unknown as { isError?: boolean }).isError
                  ? colors.error[500]
                  : colors.primary[500],
              }}
            />
            <Text strong style={{ fontSize: 13 }}>
              {data.name}
            </Text>
          </div>
          <div style={{ display: 'flex', gap: spacing.sm, fontSize: 11 }}>
            <Tag style={{ margin: 0, padding: '0 6px', fontSize: 10 }}>
              <ClockCircleOutlined /> {data.avgLatency}ms
            </Tag>
            {data.errorRate > 0 && (
              <Tag
                color={data.errorRate > 5 ? colors.error[500] : colors.warning[500]}
                style={{ margin: 0, padding: '0 6px', fontSize: 10 }}
              >
                <WarningOutlined /> {data.errorRate}%
              </Tag>
            )}
          </div>
        </div>
      ),
    }),
    []
  );

  const typedNodes = useMemo(
    () => nodes.map((node) => ({ ...node, type: 'serviceNode' })),
    [nodes]
  );

  return (
    <Card styles={{ body: { padding: 0, height: 500 } }}>
      {nodes.length > 0 ? (
        <ReactFlow
          nodes={typedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          nodeTypes={nodeTypes}
        >
          <Background color={colors.neutral[200]} gap={16} size={1} />
          <Controls
            style={{
              background: colors.neutral[0],
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: 8,
            }}
          />
          <MiniMap
            nodeColor={(node) => {
              const d = node.data as ServiceNodeData;
              return (d as unknown as { isError?: boolean }).isError
                ? colors.error[500]
                : colors.primary[500];
            }}
            nodeStrokeColor={colors.neutral[300]}
            nodeBorderRadius={12}
            maskColor="rgba(0, 0, 0, 0.1)"
            pannable
            zoomable
          />
        </ReactFlow>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 500,
          }}
        >
          <Empty description="暂无服务依赖数据" />
        </div>
      )}
    </Card>
  );
};
