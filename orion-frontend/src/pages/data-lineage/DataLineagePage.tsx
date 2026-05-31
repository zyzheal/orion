/**
 * Data Lineage Page
 * Visualize data flow between services, databases, and pipelines
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

const { Title, Text } = Typography;

interface LineageNode {
  id: string;
  name: string;
  type: 'database' | 'service' | 'pipeline' | 'table' | 'api';
  schema?: string;
  description?: string;
}

interface LineageEdge {
  id: string;
  source: string;
  target: string;
  transform?: string;
  column_mapping?: Record<string, string>;
}

interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

const nodeTypeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  database: { color: 'blue', icon: <DatabaseOutlined />, label: '数据库' },
  service: { color: 'green', icon: <CloudServerOutlined />, label: '服务' },
  pipeline: { color: 'purple', icon: <ApiOutlined />, label: '流水线' },
  table: { color: 'orange', icon: <DatabaseOutlined />, label: '数据表' },
  api: { color: 'cyan', icon: <ApiOutlined />, label: 'API' },
};

export default function DataLineagePage() {
  const [loading, setLoading] = useState(false);
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [nodeType, setNodeType] = useState<string | null>(null);

  const fetchLineage = async () => {
    setLoading(true);
    try {
      // TODO: integrate with graph API for data lineage
      setGraph({ nodes: [], edges: [] });
    } catch {
      // silently handle
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
      .filter(Boolean) as LineageNode[];
  };

  const getDownstream = (nodeId: string) => {
    return (graph?.edges || [])
      .filter(e => e.source === nodeId)
      .map(e => graph?.nodes.find(n => n.id === e.target))
      .filter(Boolean) as LineageNode[];
  };

  const nodeColumns = [
    {
      title: '名称',
      key: 'name',
      render: (_: any, record: LineageNode) => {
        const cfg = nodeTypeConfig[record.type] || nodeTypeConfig.service;
        return (
          <Space>
            <span style={{ color: colors.primary[500] }}>{cfg.icon}</span>
            <div>
              <Text strong>{record.name}</Text>
              {record.schema && <><br /><Text type="secondary" style={{ fontSize: 12 }}>{record.schema}</Text></>}
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
        const cfg = nodeTypeConfig[v] || nodeTypeConfig.service;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '上游',
      key: 'upstream',
      render: (_: any, record: LineageNode) => {
        const ups = getUpstream(record.id);
        return ups.length ? ups.map(u => <Tag key={u.id}>{u.name}</Tag>) : <Text type="secondary">-</Text>;
      },
    },
    {
      title: '下游',
      key: 'downstream',
      render: (_: any, record: LineageNode) => {
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
      render: (_: any, record: LineageNode) => (
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
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <BranchesOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数据血缘
      </Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="数据节点"
              value={graph?.nodes.length ?? 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="血缘关系"
              value={graph?.edges.length ?? 0}
              prefix={<BranchesOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="数据源"
              value={(graph?.nodes || []).filter(n => n.type === 'database').length}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: colors.info[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="服务"
              value={(graph?.nodes || []).filter(n => n.type === 'service').length}
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
          style={{ marginTop: 16 }}
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
