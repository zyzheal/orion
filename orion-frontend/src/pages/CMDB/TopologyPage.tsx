/**
 * Topology Page - ReactFlow CI topology visualization
 * Extracted from CMDB/index.tsx
 *
 * 2026-06-24: 增加拓扑编辑能力（添加/删除关系）
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Tag,
  Space,
  Button,
  Descriptions,
  Drawer,
  Modal,
  Form,
  Select,
  Input,
  Popconfirm,
  message,
} from 'antd';
import {
  ReloadOutlined,
  CloudServerOutlined,
  LinkOutlined,
  DeploymentUnitOutlined,
  ClusterOutlined,
  AppstoreOutlined,
  PlusOutlined,
  DeleteOutlined,
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
import { colors, spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getTopology,
  getCIs,
  createRelation,
  deleteRelation,
  type TopologyData,
  type TopologyNode,
  type TopologyEdge,
  type CIItem,
} from '@/api/cmdb';

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

const relationTypeOptions = [
  { label: '依赖 (depends_on)', value: 'depends_on' },
  { label: '运行于 (runs_on)', value: 'runs_on' },
  { label: '包含 (contains)', value: 'contains' },
  { label: '连接 (connects_to)', value: 'connects_to' },
  { label: '部署于 (deployed_on)', value: 'deployed_on' },
  { label: '监控 (monitors)', value: 'monitors' },
  { label: '备份 (backups)', value: 'backups' },
  { label: '使用 (uses)', value: 'uses' },
  { label: '宿主 (hosted_on)', value: 'hosted_on' },
];

// Store relation IDs in edge data for deletion
interface TopologyEdgeWithId extends TopologyEdge {
  relationId?: string;
}

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

const convertToFlowEdges = (edges: TopologyEdgeWithId[]): Edge[] => {
  return edges.map((edge) => ({
    id: `${edge.source}-${edge.target}-${edge.type}`,
    source: edge.source,
    target: edge.target,
    label: edge.label || edge.type,
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: colors.neutral[400] },
    style: { stroke: colors.neutral[400], strokeWidth: 2 },
    data: { relationId: edge.relationId, relationType: edge.type },
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
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
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

  // Edit state
  const [addRelationOpen, setAddRelationOpen] = useState(false);
  const [addRelationSubmitting, setAddRelationSubmitting] = useState(false);
  const [allCIs, setAllCIs] = useState<CIItem[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgeDetailOpen, setEdgeDetailOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getTopology();
      const data = result.data ?? null;
      setTopology(data);
      if (data) {
        setNodes(convertToFlowNodes(data.nodes || []));
        setEdges(convertToFlowEdges((data.edges || []) as TopologyEdgeWithId[]));
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

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setEdgeDetailOpen(true);
  }, []);

  const handleAddRelation = async () => {
    try {
      const values = await form.validateFields();
      setAddRelationSubmitting(true);
      await createRelation({
        source_id: values.sourceId,
        target_id: values.targetId,
        relation_type: values.relationType,
        description: values.description,
      });
      message.success('关系创建成功');
      setAddRelationOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`创建关系失败：${msg}`);
      }
    } finally {
      setAddRelationSubmitting(false);
    }
  };

  const handleDeleteEdge = async () => {
    if (!selectedEdge?.data?.relationId) {
      message.warning('无法删除该关系（缺少关系ID）');
      return;
    }
    try {
      await deleteRelation(selectedEdge.data.relationId as string);
      message.success('关系已删除');
      setEdgeDetailOpen(false);
      setSelectedEdge(null);
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`删除关系失败：${msg}`);
    }
  };

  const openAddRelation = async () => {
    setAddRelationOpen(true);
    try {
      const res = await getCIs({ pageSize: 200 });
      setAllCIs((res.data ?? []) as CIItem[]);
    } catch {
      // silently fail, user can still type
    }
  };

  const nodeTypes = { ciNode: CINode };
  const typedNodes = nodes.map((node) => ({ ...node, type: 'ciNode' }));
  const isInitialLoading = loading && !topology;

  const ciOptions = allCIs.map((ci) => ({
    label: `${ci.name} (${ci.type})`,
    value: ci.id,
  }));

  return (
    <div>
      {isInitialLoading && <PageSkeleton rows={6} />}
      {isInitialLoading ? null : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
            <div>
              <Title level={4}>拓扑图</Title>
              <Text type="secondary">可视化资源配置依赖关系</Text>
            </div>
            <Space>
              <Button icon={<PlusOutlined />} onClick={openAddRelation}>添加关系</Button>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
            </Space>
          </div>

          <Card loading={loading} styles={{ body: { padding: 0, height: 600 } }}>
            {topology ? (
              <div style={{ width: '100%', height: 600 }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.neutral[200]}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Tag color={colors.primary[500]} icon={<CloudServerOutlined />}>节点: {topology.nodes?.length || 0}</Tag>
                    <Tag icon={<LinkOutlined />}>连接: {topology.edges?.length || 0}</Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>点击节点查看详情 | 点击连线管理关系 | 支持缩放、拖拽</Text>
                </div>
                <ReactFlow
                  nodes={typedNodes} edges={edges}
                  onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick} onEdgeClick={onEdgeClick}
                  nodeTypes={nodeTypes}
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

          {/* Node Detail Drawer */}
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

          {/* Edge Detail Drawer */}
          <Drawer
            title="关系详情"
            placement="right"
            width={500}
            open={edgeDetailOpen}
            onClose={() => { setEdgeDetailOpen(false); setSelectedEdge(null); }}
            extra={
              selectedEdge?.data?.relationId ? (
                <Popconfirm title="确认删除此关系？" onConfirm={handleDeleteEdge} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                  <Button danger icon={<DeleteOutlined />}>删除关系</Button>
                </Popconfirm>
              ) : null
            }
          >
            {selectedEdge && (
              <Descriptions column={1} bordered>
                <Descriptions.Item label="源节点">{selectedEdge.source}</Descriptions.Item>
                <Descriptions.Item label="目标节点">{selectedEdge.target}</Descriptions.Item>
                <Descriptions.Item label="关系类型">
                  <Tag color={colors.primary[500]}>{(selectedEdge.data as Record<string, unknown>)?.relationType as string || selectedEdge.label}</Tag>
                </Descriptions.Item>
                {(selectedEdge.data as Record<string, unknown>)?.relationId ? (
                  <Descriptions.Item label="关系ID">
                    <Text code>{(selectedEdge.data as Record<string, unknown>).relationId as string}</Text>
                  </Descriptions.Item>
                ) : null}
              </Descriptions>
            )}
          </Drawer>

          {/* Add Relation Modal */}
          <Modal
            title="添加关系"
            open={addRelationOpen}
            onCancel={() => { setAddRelationOpen(false); form.resetFields(); }}
            onOk={handleAddRelation}
            confirmLoading={addRelationSubmitting}
            width={500}
          >
            <Form form={form} layout="vertical">
              <Form.Item name="sourceId" label="源节点" rules={[{ required: true, message: '请选择源节点' }]}>
                <Select placeholder="选择源配置项" showSearch optionFilterProp="label" options={ciOptions} />
              </Form.Item>
              <Form.Item name="targetId" label="目标节点" rules={[{ required: true, message: '请选择目标节点' }]}>
                <Select placeholder="选择目标配置项" showSearch optionFilterProp="label" options={ciOptions} />
              </Form.Item>
              <Form.Item name="relationType" label="关系类型" rules={[{ required: true, message: '请选择关系类型' }]}>
                <Select placeholder="选择关系类型" options={relationTypeOptions} />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input placeholder="关系描述（可选）" />
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
  );
};

export default TopologyPage;
