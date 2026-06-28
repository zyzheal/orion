/**
 * Data Lineage Page
 * Visualize data flow between services, databases, and pipelines
 * Uses dedicated data-lineage API (migrated from metadata API)
 */
import React, { useState, useEffect } from 'react';
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
} from 'antd';
import {
  BranchesOutlined,
  SearchOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  ApiOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  getLineageGraph,
  type LineageNode as ApiLineageNode,
  type LineageStats,
} from '@/api/data-lineage';

const { Title, Text } = Typography;

// ==================== Types ====================

interface DisplayNode {
  id: string;
  name: string;
  type: 'source' | 'transform' | 'sink' | 'dataset' | 'model';
  description?: string;
  pipelineId?: string;
}

interface DisplayEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
}

interface DisplayGraph {
  nodes: DisplayNode[];
  edges: DisplayEdge[];
}

// ==================== Helpers ====================

const apiNodeToDisplay = (node: ApiLineageNode): DisplayNode => ({
  id: node.id,
  name: node.name,
  type: node.type,
  description: node.description,
  pipelineId: node.pipelineId,
});

const nodeTypeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  source: { color: 'blue', icon: <DatabaseOutlined />, label: '数据源' },
  transform: { color: 'purple', icon: <ApiOutlined />, label: '转换' },
  sink: { color: 'green', icon: <CloudServerOutlined />, label: '数据汇' },
  dataset: { color: 'orange', icon: <DatabaseOutlined />, label: '数据集' },
  model: { color: 'cyan', icon: <ApiOutlined />, label: '模型' },
};

// ==================== Component ====================

export default function DataLineagePage() {
  const [loading, setLoading] = useState(false);
  const [graph, setGraph] = useState<DisplayGraph | null>(null);
  const [stats, setStats] = useState<LineageStats | null>(null);
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<DisplayNode | null>(null);
  const [nodeType, setNodeType] = useState<string | null>(null);

  const fetchLineage = async () => {
    setLoading(true);
    try {
      const result = await getLineageGraph();
      setGraph({
        nodes: result.graph.nodes.map(apiNodeToDisplay),
        edges: result.graph.edges.map(e => ({
          id: e.id,
          source: e.from,
          target: e.to,
          relationship: e.relationship,
        })),
      });
      setStats(result.stats);
    } catch {
      message.error('获取数据血缘失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLineage(); }, []);

  const filteredNodes = (graph?.nodes || []).filter(n => {
    const matchSearch = !search || n.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !nodeType || n.type === nodeType;
    return matchSearch && matchType;
  });

  const getUpstream = (nodeId: string) => {
    return (graph?.edges || [])
      .filter(e => e.target === nodeId)
      .map(e => graph?.nodes.find(n => n.id === e.source))
      .filter(Boolean) as DisplayNode[];
  };

  const getDownstream = (nodeId: string) => {
    return (graph?.edges || [])
      .filter(e => e.source === nodeId)
      .map(e => graph?.nodes.find(n => n.id === e.target))
      .filter(Boolean) as DisplayNode[];
  };

  const nodeColumns = [
    {
      title: '名称',
      key: 'name',
      render: (_: unknown, record: DisplayNode) => {
        const cfg = nodeTypeConfig[record.type] || nodeTypeConfig.source;
        return (
          <Space>
            <span style={{ color: colors.primary[500] }}>{cfg.icon}</span>
            <div>
              <Text strong>{record.name}</Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => {
        const cfg = nodeTypeConfig[v] || nodeTypeConfig.source;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '上游',
      key: 'upstream',
      render: (_: unknown, record: DisplayNode) => {
        const ups = getUpstream(record.id);
        return ups.length ? ups.map(u => <Tag key={u.id}>{u.name}</Tag>) : <Text type="secondary">-</Text>;
      },
    },
    {
      title: '下游',
      key: 'downstream',
      render: (_: unknown, record: DisplayNode) => {
        const downs = getDownstream(record.id);
        return downs.length ? downs.map(d => <Tag key={d.id}>{d.name}</Tag>) : <Text type="secondary">-</Text>;
      },
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
      render: (_: unknown, record: DisplayNode) => (
        <Button
          size="small"
          icon={<BranchesOutlined />}
          onClick={() => setSelectedNode(record)}
        >
          查看血缘
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <BranchesOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        数据血缘
      </Title>

      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="数据节点"
              value={stats?.totalNodes ?? graph?.nodes.length ?? 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="血缘关系"
              value={stats?.totalEdges ?? graph?.edges.length ?? 0}
              prefix={<BranchesOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="数据源"
              value={stats?.sourceCount ?? (graph?.nodes || []).filter(n => n.type === 'source').length}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: colors.info[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="转换节点"
              value={stats?.transformCount ?? (graph?.nodes || []).filter(n => n.type === 'transform').length}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="数据血缘图谱"
        extra={
          <Space>
            <Input
              placeholder="搜索节点..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              style={{ width: 200 }}
            />
            <Select
              placeholder="节点类型"
              value={nodeType}
              onChange={setNodeType}
              allowClear
              style={{ width: 120 }}
            >
              {Object.entries(nodeTypeConfig).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v.label}</Select.Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchLineage}>刷新</Button>
          </Space>
        }
      >
        {loading ? (
          <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
        ) : filteredNodes.length === 0 ? (
          <Empty description="暂无数据血缘信息" />
        ) : (
          <Table
            dataSource={filteredNodes}
            columns={nodeColumns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
          />
        )}
      </Card>

      {selectedNode && (
        <Card
          title={`血缘详情: ${selectedNode.name}`}
          style={{ marginTop: spacing.md }}
          extra={<Button size="small" onClick={() => setSelectedNode(null)}>关闭</Button>}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Card title="上游数据源" size="small">
                {getUpstream(selectedNode.id).length === 0 ? (
                  <Empty description="无上游" />
                ) : (
                  <Table
                    dataSource={getUpstream(selectedNode.id)}
                    columns={[
                      { title: '名称', dataIndex: 'name', key: 'name' },
                      { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{nodeTypeConfig[v]?.label}</Tag> },
                    ]}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="下游消费者" size="small">
                {getDownstream(selectedNode.id).length === 0 ? (
                  <Empty description="无下游" />
                ) : (
                  <Table
                    dataSource={getDownstream(selectedNode.id)}
                    columns={[
                      { title: '名称', dataIndex: 'name', key: 'name' },
                      { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{nodeTypeConfig[v]?.label}</Tag> },
                    ]}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                )}
              </Card>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
}
