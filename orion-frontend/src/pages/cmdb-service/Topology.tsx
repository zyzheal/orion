/**
 * CMDB Service - Topology View
 * Interactive topology graph with ReactFlow for visualizing CI relationships
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Select,
  Tag,
  Space,
  Descriptions,
  Drawer,
  message,
  Empty,
  Spin,
} from 'antd';
import {
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  AimOutlined,
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
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  getTopology,
  analyzeImpact,
  type TopologyNode,
  type TopologyEdge,
  type TopologyData,
  type ImpactAnalysis,
} from '@/api/cmdb-service';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

// CI 类型定义
const CI_TYPES = [
  { value: 'host', label: '主机', color: '#1890ff' },
  { value: 'k8s', label: 'Kubernetes', color: '#13c2c2' },
  { value: 'service', label: '服务', color: '#52c41a' },
  { value: 'application', label: '应用', color: '#722ed1' },
  { value: 'database', label: '数据库', color: '#fa8c16' },
  { value: 'middleware', label: '中间件', color: '#eb2f96' },
];

// 状态颜色映射
const STATUS_COLORS: Record<string, string> = {
  active: colors?.success?.[500] || '#52c41a',
  inactive: colors?.neutral?.[400] || '#d9d9d9',
  maintenance: colors?.warning?.[500] || '#faad14',
  deprecated: colors?.error?.[500] || '#f5222d',
};

// 获取类型颜色
const getTypeColor = (type: string) => {
  const ciType = CI_TYPES.find((t) => t.value === type);
  return ciType?.color || colors?.primary?.[500] || '#1890ff';
};

// 获取状态颜色
const getStatusColor = (status: string) => {
  return STATUS_COLORS[status] || colors?.neutral?.[400] || '#d9d9d9';
};

// ============================================================================
// Data Conversion Functions
// ============================================================================

/**
 * 将后端拓扑数据转换为 ReactFlow 节点
 * 使用分层布局：按 CI 类型分层排列
 */
const convertToFlowNodes = (nodes: TopologyNode[]): Node[] => {
  const nodeSpacing = { x: 300, y: 140 };
  const startX = 100;
  const startY = 50;

  // 按类型分组
  const grouped: Record<string, TopologyNode[]> = {};
  nodes.forEach((node) => {
    if (!grouped[node.type]) {
      grouped[node.type] = [];
    }
    grouped[node.type].push(node);
  });

  const flowNodes: Node[] = [];
  let yOffset = 0;

  // 按类型顺序排列
  const typeOrder = CI_TYPES.map((t) => t.value);

  // 按指定顺序排序类型
  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const aIndex = typeOrder.indexOf(a);
    const bIndex = typeOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  sortedTypes.forEach((type) => {
    const typeNodes = grouped[type];
    typeNodes.forEach((node, index) => {
      const typeColor = getTypeColor(node.type);
      const statusColor = getStatusColor(node.status);

      flowNodes.push({
        id: node.id,
        position: {
          x: startX + index * nodeSpacing.x,
          y: startY + yOffset,
        },
        data: {
          label: node.name,
          type: node.type,
          status: node.status,
          nodeData: node.data || node,
        },
        style: {
          padding: '12px 16px',
          borderRadius: '8px',
          border: `2px solid ${statusColor}`,
          background: colors?.neutral?.[0] || '#fff',
          minWidth: 180,
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

/**
 * 将后端拓扑数据转换为 ReactFlow 边
 */
const convertToFlowEdges = (edges: TopologyEdge[]): Edge[] => {
  return edges.map((edge) => ({
    id: `${edge.source}-${edge.target}-${edge.type}`,
    source: edge.source,
    target: edge.target,
    label: edge.label || edge.type,
    type: 'smoothstep',
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: colors?.neutral?.[400] || '#d9d9d9',
    },
    style: {
      stroke: colors?.neutral?.[400] || '#d9d9d9',
      strokeWidth: 2,
    },
    labelStyle: {
      fontSize: 10,
      fill: colors?.neutral?.[600] || '#595959',
    },
    labelBgStyle: {
      fill: colors?.neutral?.[0] || '#fff',
      fillOpacity: 0.9,
    },
  }));
};

// ============================================================================
// Custom Node Component
// ============================================================================

interface CINodeData {
  label: string;
  type: string;
  status: string;
  nodeData?: Record<string, unknown>;
}

/**
 * 自定义节点渲染组件（带类型图标和状态指示器）
 */
const CINode: React.FC<{ data: CINodeData }> = ({ data }) => {
  const iconColor = getTypeColor(data.type);
  const statusColor = getStatusColor(data.status);
  const typeLabel = CI_TYPES.find((t) => t.value === data.type)?.label || data.type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
      {/* 节点头部：名称 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text strong ellipsis={{ tooltip: data.label }} style={{ maxWidth: 140 }}>
          {data.label}
        </Text>
      </div>
      {/* 类型和状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag color={iconColor} style={{ margin: 0, fontSize: 10 }}>
          {typeLabel}
        </Tag>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor,
              display: 'inline-block',
            }}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {data.status}
          </Text>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Topology Page Component
// ============================================================================

const TopologyPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
  const [analyzingImpact, setAnalyzingImpact] = useState(false);

  // 加载拓扑数据
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getTopology(selectedType);
      const data = (res.data as { data?: TopologyData })?.data || null;
      setTopology(data);
      if (data) {
        const flowNodes = convertToFlowNodes(data.nodes || []);
        const flowEdges = convertToFlowEdges(data.edges || []);
        setNodes(flowNodes);
        setEdges(flowEdges);
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message.includes('401') || err.message.includes('403')) {
        message.error('权限不足，请重新登录或联系管理员');
      } else {
        message.error(`加载拓扑图失败：${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedType]);

  // 节点点击事件：显示 CI 详情
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const topologyNode = topology?.nodes?.find((n) => n.id === node.id);
      if (topologyNode) {
        setSelectedNode(topologyNode);
        setDetailDrawerOpen(true);
        // 清空影响分析
        setImpactAnalysis(null);
      }
    },
    [topology]
  );

  // 影响分析
  const handleImpactAnalysis = async () => {
    if (!selectedNode) return;
    setAnalyzingImpact(true);
    try {
      const res = await analyzeImpact(selectedNode.id);
      setImpactAnalysis((res.data as { data?: ImpactAnalysis })?.data || null);
    } catch (error: unknown) {
      const err = error as Error;
      message.error(`影响分析失败：${err.message}`);
    } finally {
      setAnalyzingImpact(false);
    }
  };

  // 节点和边的变更处理（支持拖拽）
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  // 自定义节点类型注册
  const nodeTypes = useMemo(
    () => ({
      ciNode: CINode,
    }),
    []
  );

  // 为所有节点使用自定义类型
  const typedNodes = useMemo(
    () => nodes.map((node) => ({ ...node, type: 'ciNode' })),
    [nodes]
  );

  // 统计信息
  const stats = useMemo(() => {
    const total = topology?.nodes?.length || 0;
    const edges = topology?.edges?.length || 0;
    const active = topology?.nodes?.filter((n) => n.status === 'active').length || 0;
    return { total, edges, active };
  }, [topology]);

  // 节点颜色函数（用于 MiniMap）
  const getNodeColor = useCallback((node: Node) => {
    const nodeData = node.data as CINodeData;
    return getTypeColor(nodeData?.type || 'application');
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={4}>拓扑图</Title>
          <Text type="secondary">可视化资源配置依赖关系，支持缩放、拖拽</Text>
        </div>
        <Space>
          <Select
            placeholder="筛选类型"
            style={{ width: 140 }}
            allowClear
            value={selectedType}
            onChange={setSelectedType}
          >
            {CI_TYPES.map((type) => (
              <Select.Option key={type.value} value={type.value}>
                {type.label}
              </Select.Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats Row */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text type="secondary">节点数量</Text>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.total}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text type="secondary">连接数量</Text>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.edges}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text type="secondary">运行中</Text>
                <div style={{ fontSize: 20, fontWeight: 600, color: STATUS_COLORS.active }}>
                  {stats.active}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Topology Graph */}
      <Card
        loading={loading}
        styles={{ body: { padding: 0, height: 550 } }}
      >
        {topology && topology.nodes && topology.nodes.length > 0 ? (
          <div style={{ width: '100%', height: 550 }}>
            {/* ReactFlow 画布 */}
            <ReactFlow
              nodes={typedNodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true,
              }}
            >
              <Background
                color={colors?.neutral?.[200] || '#e8e8e8'}
                gap={16}
                size={1}
              />
              <Controls
                style={{
                  background: colors?.neutral?.[0] || '#fff',
                  border: `1px solid ${colors?.neutral?.[200] || '#e8e8e8'}`,
                  borderRadius: 8,
                }}
              />
              <MiniMap
                nodeColor={getNodeColor}
                nodeStrokeColor={colors?.neutral?.[300] || '#d9d9d9'}
                nodeBorderRadius={8}
                maskColor="rgba(0, 0, 0, 0.1)"
                pannable
                zoomable
              />
            </ReactFlow>
          </div>
        ) : (
          <Empty
            description="暂无拓扑数据"
            style={{ padding: 100 }}
          />
        )}
      </Card>

      {/* CI Detail Drawer */}
      <Drawer
        title="配置项详情"
        placement="right"
        width={600}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setImpactAnalysis(null);
        }}
        extra={
          <Button
            type="primary"
            onClick={handleImpactAnalysis}
            loading={analyzingImpact}
            disabled={!selectedNode}
          >
            影响分析
          </Button>
        }
      >
        {selectedNode && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="ID">{selectedNode.id}</Descriptions.Item>
              <Descriptions.Item label="名称">{selectedNode.name}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={getTypeColor(selectedNode.type)}>
                  {CI_TYPES.find((t) => t.value === selectedNode.type)?.label || selectedNode.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(selectedNode.status)}>{selectedNode.status}</Tag>
              </Descriptions.Item>
              {selectedNode.data && (
                <Descriptions.Item label="扩展属性">
                  <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
                    {JSON.stringify(selectedNode.data, null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Impact Analysis Result */}
            {impactAnalysis && (
              <Card
                title="影响分析结果"
                size="small"
                style={{ marginTop: 16 }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary">风险等级：</Text>
                    <Tag
                      color={
                        impactAnalysis.risk_level === 'high'
                          ? 'red'
                          : impactAnalysis.risk_level === 'medium'
                          ? 'orange'
                          : 'green'
                      }
                    >
                      {impactAnalysis.risk_level === 'high'
                        ? '高'
                        : impactAnalysis.risk_level === 'medium'
                        ? '中'
                        : '低'}
                    </Tag>
                  </div>
                  <div>
                    <Text type="secondary">受影响节点：</Text>
                    <Text>{impactAnalysis.affected_nodes?.length || 0} 个</Text>
                  </div>
                  <div>
                    <Text type="secondary">受影响关系：</Text>
                    <Text>{impactAnalysis.affected_relations?.length || 0} 条</Text>
                  </div>
                  {impactAnalysis.recommendations && impactAnalysis.recommendations.length > 0 && (
                    <div>
                      <Text type="secondary">建议：</Text>
                      <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                        {impactAnalysis.recommendations.map((rec, index) => (
                          <li key={index}>
                            <Text>{rec}</Text>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Space>
              </Card>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default TopologyPage;