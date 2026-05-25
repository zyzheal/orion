/**
 * Topology Page - ReactFlow CI topology visualization
 * Extracted from CMDB/index.tsx
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Tag,
  Space,
  Button,
  Descriptions,
  Drawer,
  message,
} from 'antd';
import {
  ReloadOutlined,
  CloudServerOutlined,
  LinkOutlined,
  DeploymentUnitOutlined,
  ClusterOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { colors } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { getTopology, type TopologyData, type TopologyNode, type TopologyEdge } from '@/api/cmdb';

const { Title, Text } = Typography;

const typeIconMap: Record<string, React.ReactNode> = {
  host: <CloudServerOutlined />,
  k8s: <ClusterOutlined />,
  service: <DeploymentUnitOutlined />,
  application: <AppstoreOutlined />,
  database: <CloudServerOutlined />,
  cache: <CloudServerOutlined />,
};

const typeColorMap: Record<string, string> = {
  host: colors.primary[500],
  k8s: colors.info[500],
  service: colors.success[500],
  application: colors.purple[500],
  database: colors.warning[500],
  cache: colors.warning[500],
};

const statusColorMap: Record<string, string> = {
  active: colors.success[500],
  inactive: colors.neutral[400],
  maintenance: colors.warning[500],
  deprecated: colors.error[500],
};

const convertToFlowNodes = (nodes: TopologyNode[]): Node[] => {
  const nodeSpacing = { x: 280, y: 120 };
  const startX = 50;
  const startY = 50;

  const grouped: Record<string, TopologyNode[]> = {};
  nodes.forEach((node) => {
    if (!grouped[node.type]) grouped[node.type] = [];
    grouped[node.type].push(node);
  });

  const flowNodes: Node[] = [];
  let yOffset = 0;

  Object.entries(grouped).forEach(([, typeNodes]) => {
    typeNodes.forEach((node, index) => {
      flowNodes.push({
        id: node.id,
        position: { x: startX + index * nodeSpacing.x, y: startY + yOffset },
        data: { label: node.name, type: node.type, status: node.status, nodeData: node.data || node },
        style: {
          padding: '12px 16px',
          borderRadius: '8px',
          border: `2px solid ${statusColorMap[node.status] || colors.neutral[300]}`,
          background: colors.neutral[0],
          minWidth: 160,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });
    });
    yOffset += nodeSpacing.y;
  });

  return flowNodes;
};

const convertToFlowEdges = (edges: TopologyEdge[]): Edge[] => {
  return edges.map((edge) => ({
    id: `${edge.source}-${edge.target}-${edge.type}`,
    source: edge.source,
    target: edge.target,
    label: edge.label || edge.type,
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: colors.neutral[400] },
    style: { stroke: colors.neutral[400], strokeWidth: 2 },
  }));
};

interface CINodeData {
  label: string;
  type: string;
  status: string;
  nodeData?: Record<string, unknown>;
}

const CINode: React.FC<{ data: CINodeData }> = ({ data }) => {
  const iconColor = typeColorMap[data.type] || colors.primary[500];
  const statusColor = statusColorMap[data.status] || colors.neutral[400];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: iconColor, fontSize: 16 }}>{typeIconMap[data.type]}</span>
        <Text strong ellipsis={{ tooltip: data.label }} style={{ maxWidth: 140 }}>
          {data.label}
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>{data.status}</Text>
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>{data.type}</Text>
      </div>
    </div>
  );
};

const TopologyPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getTopology();
      const data = (res.data as any).data || null;
      setTopology(data);
      if (data) {
        setNodes(convertToFlowNodes(data.nodes || []));
        setEdges(convertToFlowEdges(data.edges || []));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载拓扑图失败：${error.message}`);
      } else {
        message.error('加载拓扑图失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onNodesChange: OnNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange: OnEdgesChange = (changes) => setEdges((eds) => applyEdgeChanges(changes, eds));

  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    const topologyNode = topology?.nodes?.find((n) => n.id === node.id);
    if (topologyNode) {
      setSelectedNode(topologyNode);
      setDetailDrawerOpen(true);
    }
  };

  const nodeTypes = { ciNode: CINode };
  const typedNodes = nodes.map((node) => ({ ...node, type: 'ciNode' }));
  const isInitialLoading = loading && !topology;

  return (
    <div>
      {isInitialLoading && <PageSkeleton rows={6} />}
      {isInitialLoading ? null : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <Title level={4}>拓扑图</Title>
              <Text type="secondary">可视化资源配置依赖关系</Text>
            </div>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          </div>

          <Card loading={loading} styles={{ body: { padding: 0, height: 600 } }}>
            {topology ? (
              <div style={{ width: '100%', height: 600 }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.neutral[200]}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Tag color={colors.primary[500]} icon={<CloudServerOutlined />}>节点: {topology.nodes?.length || 0}</Tag>
                    <Tag icon={<LinkOutlined />}>连接: {topology.edges?.length || 0}</Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>点击节点查看配置项详情 | 支持缩放、拖拽</Text>
                </div>
                <ReactFlow
                  nodes={typedNodes} edges={edges}
                  onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick} nodeTypes={nodeTypes}
                  fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.1} maxZoom={2}
                  defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
                >
                  <Background color={colors.neutral[200]} gap={16} size={1} />
                  <Controls style={{ background: colors.neutral[0], border: `1px solid ${colors.neutral[200]}`, borderRadius: 8 }} />
                  <MiniMap
                    nodeColor={(node) => { const d = node.data as CINodeData; return typeColorMap[d?.type] || colors.primary[500]; }}
                    nodeStrokeColor={colors.neutral[300]} nodeBorderRadius={8}
                    maskColor="rgba(0, 0, 0, 0.1)" pannable zoomable
                  />
                </ReactFlow>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: colors.neutral[400] }}>暂无拓扑数据</div>
            )}
          </Card>

          <Drawer title="配置项详情" placement="right" width={700} open={detailDrawerOpen} onClose={() => setDetailDrawerOpen(false)}>
            {selectedNode && (
              <Descriptions column={1} bordered>
                <Descriptions.Item label="ID">{selectedNode.id}</Descriptions.Item>
                <Descriptions.Item label="名称">{selectedNode.name}</Descriptions.Item>
                <Descriptions.Item label="类型">
                  <Space>
                    {typeIconMap[selectedNode.type] || <CloudServerOutlined />}
                    <Tag color={typeColorMap[selectedNode.type] || 'blue'}>{selectedNode.type}</Tag>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColorMap[selectedNode.status] || 'default'}>{selectedNode.status}</Tag>
                </Descriptions.Item>
                {selectedNode.data && (
                  <Descriptions.Item label="扩展属性">
                    <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto' }}>{JSON.stringify(selectedNode.data, null, 2)}</pre>
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}
          </Drawer>
        </>
      )}
    </div>
  );
};

export default TopologyPage;
