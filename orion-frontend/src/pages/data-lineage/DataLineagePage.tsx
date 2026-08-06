/**
 * Column-Level Data Lineage & Impact Analysis
 * Enhances DataLineagePage with:
 * - Column-level schema for each node
 * - Field mappings along edges
 * - API-backed impact analysis (upstream/downstream traversal)
 * - Pipeline filter
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Select,
  Tag,
  Table,
  Input,
  Row,
  Col,
  Statistic,
  Empty,
  Spin,
  message,
  Modal,
  Descriptions,
  Drawer,
  Collapse,
  Badge,
} from 'antd';
import {
  BranchesOutlined,
  SearchOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  ApiOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FilterOutlined,
  FileTextOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getLineageGraph,
  getUpstream,
  getDownstream,
  getImpactAnalysis,
  type LineageNode as ApiLineageNode,
  type LineageEdge,
  type LineageStats,
  type ImpactAnalysis as ApiImpact,
} from '@/api/data-lineage';
import { getAllPipelineRuns } from '@/api/pipelineRuns';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

// ==================== Types ====================

interface DisplayNode extends ApiLineageNode {
  upstreamIds: string[];
  downstreamIds: string[];
}

interface ColumnDef {
  name: string;
  type: string;
  description?: string;
  upstreamSource?: string;
  upstreamColumn?: string;
  transformed?: boolean;
}

interface ImpactNode {
  id: string;
  name: string;
  type: ApiLineageNode['type'];
  distance: number;
  direction: 'upstream' | 'downstream';
}

// ==================== Helpers ====================

const nodeTypeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  source: { color: 'blue', icon: <DatabaseOutlined />, label: '数据源' },
  transform: { color: 'purple', icon: <ApiOutlined />, label: '转换' },
  sink: { color: 'green', icon: <CloudServerOutlined />, label: '数据汇' },
  dataset: { color: 'orange', icon: <DatabaseOutlined />, label: '数据集' },
  model: { color: 'cyan', icon: <ApiOutlined />, label: '模型' },
};

// Derive column schema from node metadata/schema or generate defaults
const deriveColumns = (node: ApiLineageNode): ColumnDef[] => {
  const schema = node.schema;
  if (schema && Object.keys(schema).length > 0) {
    return Object.entries(schema).map(([name, type]) => ({
      name,
      type,
      transformed: node.type === 'transform',
      upstreamSource: undefined,
      upstreamColumn: undefined,
    }));
  }

  // Default columns based on node type
  const defaults: Record<string, string[]> = {
    source: ['id', 'name', 'created_at', 'updated_at'],
    transform: ['id', 'input_ref', 'transformed_value', 'ts'],
    sink: ['id', 'destination', 'record_count', 'written_at'],
    dataset: ['id', 'partition_key', 'value', 'version'],
    model: ['id', 'feature_name', 'score', 'metadata'],
  };
  return (defaults[node.type] || defaults.source).map((name) => ({
    name,
    type: 'string',
    transformed: node.type === 'transform',
    upstreamSource: undefined,
    upstreamColumn: undefined,
  }));
};

// ==================== Component ====================

export default function DataLineageEnhancedPage() {
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<DisplayNode[]>([]);
  const [edges, setEdges] = useState<LineageEdge[]>([]);
  const [stats, setStats] = useState<LineageStats | null>(null);

  const [search, setSearch] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null);

  // Detail & impact
  const [selectedNode, setSelectedNode] = useState<ApiLineageNode | null>(null);
  const [nodeColumns] = useState<ColumnDef[]>([]);
  const [impactData, setImpactData] = useState<ApiImpact | null>(null);
  const [upstreamNodes, setUpstreamNodes] = useState<ApiLineageNode[]>([]);
  const [downstreamNodes, setDownstreamNodes] = useState<ApiLineageNode[]>([]);
  const [impactLoading, setImpactLoading] = useState(false);

  // Pipeline list for filter
  const [pipelineList, setPipelineList] = useState<{ key: string; label: string }[]>([]);

  // Edge mapping modal
  const [edgeMapping, setEdgeMapping] = useState<LineageEdge | null>(null);

  useEffect(() => {
    fetchLineage();
    loadPipelines();
  }, []);

  const loadPipelines = async () => {
    try {
      const res = await getAllPipelineRuns({ limit: 50 });
      const runs = (res.data as { runs?: unknown[] })?.runs ?? res.data;
      if (Array.isArray(runs)) {
        const ids = new Set<string>();
        const list: { key: string; label: string }[] = [];
        runs.forEach((r) => {
          const run = r as { pipelineId?: string; pipelineName?: string };
          if (run.pipelineId && !ids.has(run.pipelineId)) {
            ids.add(run.pipelineId);
            list.push({ key: run.pipelineId, label: `${run.pipelineName || run.pipelineId}` });
          }
        });
        setPipelineList(list);
      }
    } catch {
      // Pipeline list optional
    }
  };

  const fetchLineage = async () => {
    setLoading(true);
    try {
      const result = await getLineageGraph();
      const graph = result.graph;
      const displayEdges = graph.edges;

      // Build adjacency for upstream/downstream
      const adj: Record<string, { from: string[]; to: string[] }> = {};
      graph.nodes.forEach((n) => { adj[n.id] = { from: [], to: [] }; });
      displayEdges.forEach((e) => {
        if (adj[e.from]) adj[e.from].to.push(e.to);
        if (adj[e.to]) adj[e.to].from.push(e.from);
      });

      const displayNodes = graph.nodes.map((n) => ({
        ...n,
        upstreamIds: adj[n.id]?.from || [],
        downstreamIds: adj[n.id]?.to || [],
      }));

      setNodes(displayNodes);
      setEdges(displayEdges);
      setStats(result.stats);
    } catch {
      message.error('获取数据血缘失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredNodes = nodes.filter((n) => {
    const matchSearch = !search || n.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !nodeTypeFilter || n.type === nodeTypeFilter;
    const matchPipeline = !pipelineFilter || n.pipelineId === pipelineFilter;
    return matchSearch && matchType && matchPipeline;
  });

  const openNodeDetail = async (node: ApiLineageNode) => {
    setSelectedNode(node);
    setImpactData(null);
    setUpstreamNodes([]);
    setDownstreamNodes([]);
    setImpactLoading(true);

    try {
      const [impact, upstream, downstream] = await Promise.all([
        getImpactAnalysis(node.id).catch(() => ({
          upstreamCount: 0,
          downstreamCount: 0,
          affectedPipelines: [],
        })),
        getUpstream(node.id).catch(() => []),
        getDownstream(node.id).catch(() => []),
      ]);
      setImpactData(impact);
      setUpstreamNodes(upstream);
      setDownstreamNodes(downstream);
    } catch {
      message.error('获取影响分析失败');
    } finally {
      setImpactLoading(false);
    }
  };

  const openEdgeMapping = (edge: LineageEdge) => {
    setEdgeMapping(edge);
  };

  // ==================== Columns ====================

  const nodeColumnsDef = [
    {
      title: '名称',
      key: 'name',
      width: 220,
      render: (_: unknown, record: DisplayNode) => {
        const cfg = nodeTypeConfig[record.type] || nodeTypeConfig.source;
        return (
          <Space>
            <Badge
              dot={false}
              count={null}
            />
            <span style={{ color: colors.primary[500] }}>{cfg.icon}</span>
            <div>
              <Text strong>{record.name}</Text>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {record.pipelineId || '—'}
                </Text>
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (v: string) => {
        const cfg = nodeTypeConfig[v] || nodeTypeConfig.source;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '列数',
      key: 'columns',
      width: 70,
      render: (_: unknown, record: DisplayNode) => {
        const cols = deriveColumns(record);
        return <Tag color="default">{cols.length}</Tag>;
      },
    },
    {
      title: '上游',
      key: 'upstream',
      width: 140,
      render: (_: unknown, record: DisplayNode) => (
        <Space size="small" wrap>
          {record.upstreamIds.length > 0
            ? record.upstreamIds.map((uId) => {
                const u = nodes.find((n) => n.id === uId);
                return u ? <Tag key={uId}>{u.name}</Tag> : null;
              })
            : <Text type="secondary">—</Text>}
        </Space>
      ),
    },
    {
      title: '下游',
      key: 'downstream',
      width: 140,
      render: (_: unknown, record: DisplayNode) => (
        <Space size="small" wrap>
          {record.downstreamIds.length > 0
            ? record.downstreamIds.map((dId) => {
                const d = nodes.find((n) => n.id === dId);
                return d ? <Tag key={dId} color="green">{d.name}</Tag> : null;
              })
            : <Text type="secondary">—</Text>}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: ApiLineageNode) => (
        <Space size="small">
          <Button size="small" type="primary" icon={<ThunderboltOutlined />} onClick={() => openNodeDetail(record)}>
            影响分析
          </Button>
        </Space>
      ),
    },
  ];

  // Column-level table
  const columnColumnsDef = selectedNode
    ? [
        {
          title: '列名',
          dataIndex: 'name',
          key: 'name',
          render: (v: string) => <Text code strong>{v}</Text>,
        },
        {
          title: '类型',
          dataIndex: 'type',
          key: 'type',
          render: (v: string) => <Tag color="blue">{v}</Tag>,
        },
        {
          title: '上游来源',
          dataIndex: 'upstreamSource',
          key: 'upstreamSource',
          render: (v: string | undefined) => (v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>),
        },
        {
          title: '上游列',
          dataIndex: 'upstreamColumn',
          key: 'upstreamColumn',
          render: (v: string | undefined) => (v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>),
        },
        {
          title: '转换',
          dataIndex: 'transformed',
          key: 'transformed',
          render: (v: boolean) => (v ? <Tag color="purple">是</Tag> : <Tag>—</Tag>),
        },
        {
          title: '描述',
          dataIndex: 'description',
          key: 'description',
        },
      ]
    : [];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <BranchesOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        列级数据血缘
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        Column-level lineage graph with impact analysis
      </Text>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="数据节点"
              value={stats?.totalNodes ?? nodes.length}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="血缘关系"
              value={stats?.totalEdges ?? edges.length}
              prefix={<BranchesOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="数据源"
              value={stats?.sourceCount ?? nodes.filter((n) => n.type === 'source').length}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: colors.info[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="转换节点"
              value={stats?.transformCount ?? nodes.filter((n) => n.type === 'transform').length}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Edge Mapping: show edges connecting to selected node */}
      {selectedNode && (
        <Card
          title={`Edge Mappings — ${selectedNode.name}`}
          style={{ marginBottom: spacing.md }}
          extra={<Button size="small" onClick={() => setSelectedNode(null)}>Close</Button>}
        >
          <Table
            columns={[
              { title: 'From', dataIndex: 'from', key: 'from', width: 120 },
              {
                title: 'To',
                dataIndex: 'to',
                key: 'to',
                width: 120,
              },
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
                        <Tag key={k} color="cyan">{k} → {v}</Tag>
                      ))}
                    </Space>
                  );
                },
              },
              {
                title: '',
                key: 'action',
                render: (_: unknown, record: LineageEdge) => (
                  <Button size="small" icon={<LinkOutlined />} onClick={() => openEdgeMapping(record)}>
                    Detail
                  </Button>
                ),
              },
            ]}
            dataSource={edges.filter(
              (e) => e.from === selectedNode.id || e.to === selectedNode.id,
            )}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* Node Table */}
      <Card
        title="数据血缘图谱"
        extra={
          <Space>
            <Select
              placeholder="Pipeline"
              value={pipelineFilter}
              onChange={setPipelineFilter}
              allowClear
              style={{ width: 160 }}
            >
              {pipelineList.map((p) => (
                <Option key={p.key} value={p.key}>{p.label}</Option>
              ))}
            </Select>
            <Input
              placeholder="搜索节点..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 180 }}
            />
            <Select
              placeholder="类型"
              value={nodeTypeFilter}
              onChange={setNodeTypeFilter}
              allowClear
              style={{ width: 110 }}
            >
              {Object.entries(nodeTypeConfig).map(([k, v]) => (
                <Option key={k} value={k}>{v.label}</Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchLineage} loading={loading}>
              Refresh
            </Button>
          </Space>
        }
      >
        {loading ? (
          <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
        ) : filteredNodes.length === 0 ? (
          <Empty description="暂无数据血缘信息" />
        ) : (
          <Table
            dataSource={filteredNodes}
            columns={nodeColumnsDef}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            size="small"
          />
        )}
      </Card>

      {/* Node Detail Drawer */}
      <Drawer
        title={`节点详情 — ${selectedNode?.name}`}
        placement="right"
        width={600}
        open={!!selectedNode}
        onClose={() => setSelectedNode(null)}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {impactData && (
            <Row gutter={12}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="上游"
                    value={impactData.upstreamCount}
                    prefix={<ArrowUpOutlined />}
                    valueStyle={{ color: colors.info[500] }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="下游"
                    value={impactData.downstreamCount}
                    prefix={<ArrowDownOutlined />}
                    valueStyle={{ color: colors.success[500] }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="影响 Pipeline"
                    value={impactData.affectedPipelines.length}
                    prefix={<FilterOutlined />}
                    valueStyle={{ color: colors.warning[500] }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {selectedNode && (
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="ID">{selectedNode.id}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={(nodeTypeConfig[selectedNode.type] || nodeTypeConfig.source).color}>
                  {(nodeTypeConfig[selectedNode.type] || nodeTypeConfig.source).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Pipeline">{selectedNode.pipelineId || '—'}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedNode.description || '—'}</Descriptions.Item>
            </Descriptions>
          )}

          {/* Column Schema */}
          <Collapse defaultActiveKey={undefined} size="small">
            <Panel header="列级 Schema" key="columns">
              {selectedNode ? (
                <Table
                  columns={columnColumnsDef}
                  dataSource={deriveColumns(selectedNode)}
                  rowKey="name"
                  pagination={false}
                  size="small"
                />
              ) : null}
            </Panel>
            <Panel header={`上游 (${upstreamNodes.length})`} key="upstream">
              {upstreamNodes.length === 0 ? (
                <Empty description="无上游" />
              ) : (
                <Table
                  columns={[
                    { title: '名称', dataIndex: 'name', key: 'name' },
                    {
                      title: '类型',
                      dataIndex: 'type',
                      key: 'type',
                      render: (v: string) => <Tag>{nodeTypeConfig[v]?.label}</Tag>,
                    },
                    { title: 'Pipeline', dataIndex: 'pipelineId', key: 'pipelineId' },
                  ]}
                  dataSource={upstreamNodes}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              )}
            </Panel>
            <Panel header={`下游 (${downstreamNodes.length})`} key="downstream">
              {downstreamNodes.length === 0 ? (
                <Empty description="无下游" />
              ) : (
                <Table
                  columns={[
                    { title: '名称', dataIndex: 'name', key: 'name' },
                    {
                      title: '类型',
                      dataIndex: 'type',
                      key: 'type',
                      render: (v: string) => <Tag>{nodeTypeConfig[v]?.label}</Tag>,
                    },
                    { title: 'Pipeline', dataIndex: 'pipelineId', key: 'pipelineId' },
                  ]}
                  dataSource={downstreamNodes}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              )}
            </Panel>
            <Panel header={`受影响的 Pipelines (${impactData?.affectedPipelines.length ?? 0})`} key="pipelines">
              <Space size="small" wrap>
                {(impactData?.affectedPipelines || []).length > 0
                  ? impactData.affectedPipelines.map((p) => (
                      <Tag key={p} color="warning">{p}</Tag>
                    ))
                  : <Text type="secondary">无受影响 Pipeline</Text>}
              </Space>
            </Panel>
          </Collapse>
        </Space>
      </Drawer>

      {/* Edge Mapping Detail Modal */}
      <Modal
        title="Edge Mapping Detail"
        open={!!edgeMapping}
        onCancel={() => setEdgeMapping(null)}
        footer={null}
      >
        {edgeMapping && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="ID">{edgeMapping.id}</Descriptions.Item>
            <Descriptions.Item label="From">{edgeMapping.from}</Descriptions.Item>
            <Descriptions.Item label="To">{edgeMapping.to}</Descriptions.Item>
            <Descriptions.Item label="Relationship">
              <Tag>{edgeMapping.relationship.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Field Mapping">
              {edgeMapping.fieldMapping && Object.keys(edgeMapping.fieldMapping).length > 0
                ? Object.entries(edgeMapping.fieldMapping).map(([k, v]) => (
                    <div key={k}>
                      <Text code>{k}</Text> → <Text code>{v}</Text>
                    </div>
                  ))
                : <Text type="secondary">无字段映射</Text>}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
