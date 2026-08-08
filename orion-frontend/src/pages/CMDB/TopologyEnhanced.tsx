/**
 * CMDB Enhanced Topology Page
 * Enhanced topology visualization with impact analysis
 * - Left: CI search/select list filtered by type
 * - Center: ReactFlow topology with highlight on selected CI
 * - Bottom: Impact analysis cards with severity levels
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Input,
  Select,
  Tag,
  Space,
  Button,
  Empty,
  Statistic,
  Row,
  Col,
  List,
} from 'antd';
import {
  LinkOutlined,
  SearchOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  DeploymentUnitOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
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
import {
  getCIs,
  getTopology,
  getCIRelations,
  getImpactAnalysis,
  type CIItem,
  type TopologyData,
  type CIRelation,
  type ImpactData,
} from '@/api/cmdb';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// ============================================================================
// Constants
// ============================================================================

const CI_TYPE_OPTIONS = [
  { label: '主机 (host)', value: 'host' },
  { label: 'K8s (k8s)', value: 'k8s' },
  { label: '服务 (service)', value: 'service' },
  { label: '应用 (application)', value: 'application' },
  { label: '数据库 (database)', value: 'database' },
  { label: '缓存 (cache)', value: 'cache' },
];

const typeIconMap: Record<string, React.ReactNode> = {
  host: <CloudServerOutlined />,
  k8s: <ClusterOutlined />,
  service: <DeploymentUnitOutlined />,
  application: <AppstoreOutlined />,
  database: <DatabaseOutlined />,
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

const impactLevelConfig: Record<string, { color: string; label: string; threshold: number }> = {
  critical: { color: colors.error[500], label: '严重 (Critical)', threshold: 10 },
  high: { color: colors.warning[500], label: '高 (High)', threshold: 5 },
  medium: { color: '#FADB14', label: '中 (Medium)', threshold: 2 },
  low: { color: colors.neutral[500], label: '低 (Low)', threshold: 0 },
};

const computeImpactLevel = (upstreamCount: number, downstreamCount: number): string => {
  const total = upstreamCount + downstreamCount;
  if (total >= 10) return 'critical';
  if (total >= 5) return 'high';
  if (total >= 2) return 'medium';
  return 'low';
};

// ============================================================================
// Node Data Interface
// ============================================================================

interface EnhancedNodeData {
  label: string;
  type: string;
  status: string;
  isHighlighted: boolean;
  isRelated: boolean;
}

// ============================================================================
// Custom Node Component
// ============================================================================

const EnhancedNode: React.FC<{ data: EnhancedNodeData }> = ({ data }) => {
  const baseColor = data.isHighlighted
    ? colors.primary[500]
    : data.isRelated
      ? colors.info[500]
      : colors.neutral[400];
  const borderColor = data.isHighlighted
    ? colors.primary[500]
    : data.isRelated
      ? colors.info[300]
      : colors.neutral[300];
  const bgColor = data.isHighlighted
    ? colors.primary[50]
    : colors.light.bg.primary;
  const boxShadow = data.isHighlighted
    ? '0 0 0 3px rgba(51,112,230,0.2), 0 4px 12px rgba(0,0,0,0.12)'
    : '0 2px 4px rgba(0,0,0,0.04)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        padding: '10px 14px',
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        background: bgColor,
        minWidth: 120,
        boxShadow,
        transition: 'all 0.2s',
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: baseColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {typeIconMap[data.type] || <CloudServerOutlined />}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Text strong ellipsis={{ tooltip: data.label }} style={{ fontSize: 12, maxWidth: 140 }}>
          {data.label}
        </Text>
        <Space>
          <Tag color={typeColorMap[data.type] || colors.neutral[400]} style={{ fontSize: 10, padding: '0 4px' }}>
            {data.type}
          </Tag>
        </Space>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const TopologyEnhanced: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [allCIs, setAllCIs] = useState<CIItem[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedType, setSelectedType] = useState<string>();
  const [selectedCIId, setSelectedCIId] = useState<string>();
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [impact, setImpact] = useState<ImpactData | null>(null);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const loadCIs = async () => {
    try {
      const result = await getCIs({ pageSize: 500 });
      setAllCIs(result.data ?? []);
    } catch {
      // silently fail
    }
  };

  const loadTopology = async () => {
    setLoading(true);
    try {
      const result = await getTopology();
      const data = result.data ?? null;
      setTopology(data);
      if (data) {
        buildFlowGraph(data, selectedCIId);
      }
    } catch {
      setTopology(null);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  };

  const buildFlowGraph = (topologyData: TopologyData, highlightId?: string) => {
    const nodeSpacing = { x: 300, y: 140 };
    const startX = 80;
    const startY = 80;

    const grouped: Record<string, typeof topologyData.nodes> = {};
    topologyData.nodes.forEach((node) => {
      if (!grouped[node.type]) grouped[node.type] = [];
      grouped[node.type].push(node);
    });

    // Build relation lookup for highlighting
    const connectedNodeIds = new Set<string>();
    if (highlightId) {
      topologyData.edges.forEach((edge) => {
        if (edge.source === highlightId) connectedNodeIds.add(edge.target);
        if (edge.target === highlightId) connectedNodeIds.add(edge.source);
      });
    }

    const flowNodes: Node[] = [];
    let yOffset = 0;

    Object.entries(grouped).forEach(([, typeNodes]) => {
      typeNodes.forEach((node, index) => {
        const isHighlighted = node.id === highlightId;
        const isRelated = connectedNodeIds.has(node.id);

        flowNodes.push({
          id: node.id,
          position: { x: startX + index * nodeSpacing.x, y: startY + yOffset },
          type: 'enhancedNode',
          data: {
            label: node.name,
            type: node.type,
            status: node.status,
            isHighlighted,
            isRelated,
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        });
      });
      yOffset += nodeSpacing.y;
    });

    setNodes(flowNodes);

    // Build edges: dashed for "影响" type relations
    const flowEdges: Edge[] = [];
    topologyData.edges.forEach((edge) => {
      const isImpactType = edge.type === 'impact' || edge.type === 'affects';
      const isRelatedEdge = highlightId
        ? edge.source === highlightId || edge.target === highlightId
        : false;

      flowEdges.push({
        id: `${edge.source}-${edge.target}-${edge.type}`,
        source: edge.source,
        target: edge.target,
        label: edge.label || edge.type,
        type: isImpactType ? 'smoothstep' : 'smoothstep',
        animated: isRelatedEdge,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isRelatedEdge ? colors.primary[500] : colors.neutral[400],
        },
        style: {
          stroke: isRelatedEdge ? colors.primary[500] : colors.neutral[400],
          strokeWidth: isRelatedEdge ? 2.5 : 1.5,
          strokeDasharray: isImpactType ? '8 4' : '0',
        },
      });
    });

    setEdges(flowEdges);
  };

  const loadImpact = async (ciId: string) => {
    try {
      const result = await getImpactAnalysis(ciId);
      const impactData = (result as { data?: ImpactData }).data ?? null;
      setImpact(impactData);

      // Load relations to build topology around this CI
      try {
        const relResult = await getCIRelations(ciId);
        const relations = relResult.data ?? ([] as CIRelation[]);

        // Build a mini topology from the CI and its relations
        if (relations.length > 0) {
          const relationCIs = allCIs.filter((ci) =>
            relations.some(
              (r) => r.source_id === ci.id || r.target_id === ci.id
            ),
          );

          const topologyNodes = relationCIs.map((ci) => ({
            id: ci.id,
            name: ci.name,
            type: ci.type,
            status: ci.status,
          }));

          const topologyEdges = relations.map((r) => ({
            source: r.source_id,
            target: r.target_id,
            type: r.relation_type,
            label: r.relation_type,
          }));

          const miniTopology: TopologyData = {
            nodes: topologyNodes,
            edges: topologyEdges,
          };
          setTopology(miniTopology);
          buildFlowGraph(miniTopology, ciId);
        } else {
          // Single node topology
          const ci = allCIs.find((c) => c.id === ciId);
          if (ci) {
            const singleTopology: TopologyData = {
              nodes: [{ id: ci.id, name: ci.name, type: ci.type, status: ci.status }],
              edges: [],
            };
            setTopology(singleTopology);
            buildFlowGraph(singleTopology, ciId);
          }
        }
      } catch {
        // relations fetch failed, keep existing topology
      }
    } catch {
      setImpact(null);
    }
  };

  useEffect(() => {
    loadCIs();
    loadTopology();
  }, []);

  useEffect(() => {
    if (selectedCIId) {
      loadImpact(selectedCIId);
    }
  }, [selectedCIId]);

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
  };

  const handleTypeChange = (value: string | undefined) => {
    setSelectedType(value);
    setSearchKeyword('');
  };

  const handleCISelect = (ciId: string) => {
    setSelectedCIId(ciId);
  };

  const filteredCIs = allCIs.filter((ci) => {
    const matchesType = !selectedType || ci.type === selectedType;
    const matchesSearch = !searchKeyword || ci.name.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchesType && matchesSearch;
  });

  const selectedCI = allCIs.find((ci) => ci.id === selectedCIId);
  const impactLevel = impact
    ? computeImpactLevel(impact.upstream?.length || 0, impact.downstream?.length || 0)
    : 'low';
  const levelConfig = impactLevelConfig[impactLevel];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <LinkOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            CMDB 可视化拓扑
          </Title>
          <Text type="secondary">增强拓扑可视化与影响分析</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => { loadCIs(); loadTopology(); }} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        {/* Left Panel - CI Selection */}
        <Col span={5}>
          <Card
            title="配置项选择"
            styles={{ body: { padding: 12, maxHeight: 500, overflowY: 'auto' } }}
            style={{ height: 480 }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={spacing.sm}>
              <Search
                placeholder="搜索配置项名称..."
                allowClear
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                prefix={<SearchOutlined />}
              />
              <Select
                placeholder="按类型筛选"
                style={{ width: '100%' }}
                value={selectedType}
                onChange={handleTypeChange}
                allowClear
                size="small"
              >
                {CI_TYPE_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </Space>

            <List
              style={{ marginTop: spacing.sm }}
              size="small"
              dataSource={filteredCIs}
              locale={{ emptyText: <Empty description="暂无配置项" /> }}
              renderItem={(ci) => (
                <List.Item
                  onClick={() => handleCISelect(ci.id)}
                  style={{
                    cursor: 'pointer',
                    background: ci.id === selectedCIId ? colors.primary[50] : 'transparent',
                    borderRadius: 6,
                    border: ci.id === selectedCIId ? `1px solid ${colors.primary[300]}` : '1px solid transparent',
                  }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <span style={{ color: typeColorMap[ci.type] || colors.primary[500] }}>
                        {typeIconMap[ci.type] || <CloudServerOutlined />}
                      </span>
                      <div>
                        <Text strong style={{ fontSize: 12 }}>{ci.name}</Text>
                        <div>
                          <Tag color={typeColorMap[ci.type] || colors.neutral[400]} style={{ fontSize: 10 }}>
                            {ci.type}
                          </Tag>
                        </div>
                      </div>
                    </Space>
                    <Tag color={ci.status === 'active' ? colors.success[500] : colors.neutral[400]} style={{ fontSize: 10 }}>
                      {ci.status}
                    </Tag>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Right Panel - Topology */}
        <Col span={14}>
          <Card
            loading={loading}
            styles={{ body: { padding: 0, height: 480 } }}
            style={{ height: 480 }}
          >
            {topology && topology.nodes?.length > 0 ? (
              <div style={{ width: '100%', height: 480 }}>
                <div
                  style={{
                    padding: '10px 16px',
                    borderBottom: `1px solid ${colors.neutral[200]}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Space>
                    <Tag color={colors.primary[500]}>节点: {topology.nodes.length}</Tag>
                    <Tag>连接: {topology.edges?.length || 0}</Tag>
                    {selectedCI && (
                      <Tag color={colors.info[500]}>
                        高亮: {selectedCI.name}
                      </Tag>
                    )}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    虚线表示影响关系 | 蓝色高亮选中节点
                  </Text>
                </div>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  nodeTypes={{ enhancedNode: EnhancedNode }}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  minZoom={0.1}
                  maxZoom={2}
                  defaultEdgeOptions={{ type: 'smoothstep' }}
                >
                  <Background color={colors.light.bg.secondary} gap={16} size={1} />
                  <Controls
                    style={{
                      background: colors.neutral[0],
                      border: `1px solid ${colors.neutral[200]}`,
                      borderRadius: 8,
                    }}
                  />
                  <MiniMap
                    nodeColor={(node) => {
                      const d = node.data as EnhancedNodeData | undefined;
                      if (d?.isHighlighted) return colors.primary[500];
                      if (d?.isRelated) return colors.info[500];
                      return typeColorMap[d?.type || ''] || colors.neutral[400];
                    }}
                    nodeStrokeColor={colors.neutral[300]}
                    nodeBorderRadius={8}
                    maskColor="rgba(0, 0, 0, 0.08)"
                    pannable
                    zoomable
                  />
                </ReactFlow>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 480 }}>
                <Empty description="选择左侧配置项查看拓扑依赖关系" />
              </div>
            )}
          </Card>
        </Col>

        {/* Right Info Panel - Selected CI Details */}
        <Col span={5}>
          <Card title="选中详情" styles={{ body: { maxHeight: 500, overflowY: 'auto' } }} style={{ height: 480 }}>
            {selectedCI ? (
              <Space direction="vertical" size={spacing.md} style={{ width: '100%' }}>
                <Space>
                  <span style={{ color: typeColorMap[selectedCI.type], fontSize: 18 }}>
                    {typeIconMap[selectedCI.type] || <CloudServerOutlined />}
                  </span>
                  <div>
                    <Title level={5} style={{ margin: 0 }}>{selectedCI.name}</Title>
                    <Tag color={typeColorMap[selectedCI.type] || colors.neutral[400]}>{selectedCI.type}</Tag>
                  </div>
                </Space>

                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  <div>
                    <Text type="secondary">状态：</Text>
                    <Tag color={selectedCI.status === 'active' ? colors.success[500] : colors.neutral[400]}>
                      {selectedCI.status}
                    </Tag>
                  </div>
                  {selectedCI.environment && (
                    <div>
                      <Text type="secondary">环境：</Text>
                      <Tag color={selectedCI.environment === 'production' ? colors.error[500] : colors.info[700]}>
                        {selectedCI.environment}
                      </Tag>
                    </div>
                  )}
                  {selectedCI.owner && (
                    <div>
                      <Text type="secondary">负责人：</Text>
                      <Text>{selectedCI.owner}</Text>
                    </div>
                  )}
                </div>

                {selectedCI.tags && selectedCI.tags.length > 0 && (
                  <div>
                    <Text type="secondary">标签：</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {selectedCI.tags.map((tag, i) => (
                        <Tag key={i}>{tag}</Tag>
                      ))}
                    </div>
                  </div>
                )}
              </Space>
            ) : (
              <Empty description="请选择一个配置项查看详情" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Bottom - Impact Analysis */}
      {impact && (
        <Card
          title="影响分析"
          styles={{ body: { padding: 12 } }}
        >
          <Row gutter={spacing.md}>
            <Col span={6}>
              <div
                style={{
                  padding: spacing.md,
                  borderRadius: 10,
                  border: `1px solid ${levelConfig.color}30`,
                  background: levelConfig.color + '08',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
                  <ExclamationCircleOutlined style={{ color: levelConfig.color, fontSize: 18 }} />
                  <Text strong>影响级别</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: levelConfig.color,
                      display: 'inline-block',
                      boxShadow: impactLevel === 'critical' ? `0 0 8px ${levelConfig.color}` : 'none',
                    }}
                  />
                  <Text strong style={{ color: levelConfig.color, fontSize: 16 }}>{levelConfig.label}</Text>
                </div>
              </div>
            </Col>
            <Col span={6}>
              <Statistic
                title="上游依赖"
                value={impact.upstream?.length || 0}
                prefix={<ArrowUpOutlined />}
                valueStyle={{ color: colors.info[500] }}
                suffix="个"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="下游影响"
                value={impact.downstream?.length || 0}
                prefix={<ArrowDownOutlined />}
                valueStyle={{ color: colors.warning[500] }}
                suffix="个"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="总影响范围"
                value={impact.total_affected || impact.upstream?.length + impact.downstream?.length || 0}
                prefix={<LinkOutlined />}
                valueStyle={{ color: colors.purple[500] }}
                suffix="个"
              />
            </Col>
          </Row>

          {(impact.upstream?.length || 0) > 0 || (impact.downstream?.length || 0) > 0 ? (
            <div style={{ marginTop: spacing.sm, display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
              {impact.upstream?.slice(0, 5).map((ci) => (
                <Tag
                  key={`up-${ci.id}`}
                  color={colors.info[500]}
                  style={{ margin: 0 }}
                  onClick={() => handleCISelect(ci.id)}
                >
                  ↑ {ci.name}
                </Tag>
              ))}
              {impact.downstream?.slice(0, 5).map((ci) => (
                <Tag
                  key={`down-${ci.id}`}
                  color={colors.warning[500]}
                  style={{ margin: 0 }}
                  onClick={() => handleCISelect(ci.id)}
                >
                  ↓ {ci.name}
                </Tag>
              ))}
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 12, marginTop: spacing.sm, display: 'block' }}>
              当前配置项无上下游依赖
            </Text>
          )}
        </Card>
      )}

      {!impact && selectedCIId && (
        <Card styles={{ body: { textAlign: 'center', padding: spacing.lg } }}>
          <Empty description="暂无影响分析数据" />
        </Card>
      )}
    </div>
  );
};

export default TopologyEnhanced;
