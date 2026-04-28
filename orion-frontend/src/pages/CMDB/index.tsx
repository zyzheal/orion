/**
 * CMDB - Configuration Management Database
 * CI management, topology view, and integration status
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  type TableColumnsType,
  Tag,
  Space,
  Button,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  message,
  Drawer,
  Descriptions,
  Tabs,
} from 'antd';
import { colors } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
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
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  ClusterOutlined,
  SyncOutlined,
  AppstoreOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  getCIs,
  createCI,
  updateCI,
  deleteCI,
  getTopology,
  getHosts,
  getK8sResources,
  startK8sSync,
  type CIItem,
  type TopologyData,
  type TopologyNode,
  type TopologyEdge,
  type HostInfo,
  type K8sResource,
  type UpdateCIInput,
} from '@/api/cmdb';

const { Title, Text } = Typography;

// ============================================================================
// CI Table Page
// ============================================================================

const CITablePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [cis, setCIs] = useState<CIItem[]>([]);
  const [selectedCI, setSelectedCI] = useState<CIItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCI, setEditingCI] = useState<CIItem | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getCIs({ pageSize: 50 });
      setCIs((res.data as any).data || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          message.error('权限不足，请重新登录或联系管理员');
        } else {
          message.error(`加载配置项失败：${error.message}`);
        }
      } else {
        message.error('加载配置项失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await createCI({
        tenant_id: 'default',
        name: values.name,
        type: values.type,
        subtype: values.subtype,
        environment: values.environment,
        owner: values.owner,
        tags: values.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
        attributes: {},
      });
      message.success('配置项创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建配置项失败：${error.message}`);
      } else {
        message.error('创建配置项失败');
      }
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      onOk: async () => {
        try {
          await deleteCI(id);
          message.success('删除成功');
          loadData();
        } catch (error: unknown) {
          if (error instanceof Error) {
            message.error(`删除失败：${error.message}`);
          } else {
            message.error('删除失败');
          }
        }
      },
    });
  };

  const openEdit = (ci: CIItem) => {
    setEditingCI(ci);
    editForm.setFieldsValue({
      name: ci.name,
      type: ci.type,
      subtype: ci.subtype,
      environment: ci.environment,
      owner: ci.owner,
      status: ci.status,
      tags: ci.tags?.join(', ') || '',
    });
    setEditModalOpen(true);
  };

  const handleUpdate = async (values: any) => {
    if (!editingCI) return;
    try {
      const payload: UpdateCIInput = {
        name: values.name,
        status: values.status,
        owner: values.owner,
        environment: values.environment,
        tags: values.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
        attributes: editingCI.attributes,
      };
      await updateCI(editingCI.id, payload);
      message.success('配置项更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      setEditingCI(null);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新配置项失败：${error.message}`);
      } else {
        message.error('更新配置项失败');
      }
    }
  };

  const typeIconMap: Record<string, React.ReactNode> = {
    host: <CloudServerOutlined />,
    k8s: <ClusterOutlined />,
    service: <DeploymentUnitOutlined />,
    application: <AppstoreOutlined />,
  };

  const statusColorMap: Record<string, string> = {
    active: 'green',
    inactive: 'default',
    maintenance: 'orange',
    deprecated: 'red',
  };

  const columns: TableColumnsType<CIItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: unknown, record: CIItem) => (
        <Space>
          {typeIconMap[record.type] || <CloudServerOutlined />}
          <Text strong>{String(text)}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: unknown) => <Tag color="blue">{String(type)}</Tag>,
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: unknown) => env ? <Tag color={String(env) === 'production' ? 'red' : 'geekblue'}>{String(env)}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: unknown) => (
        <Tag color={statusColorMap[String(status)] || 'default'}>{String(status)}</Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
      render: (owner: unknown) => owner ? String(owner) : '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (ts: unknown) => new Date(String(ts)).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CIItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setSelectedCI(record); setDetailDrawerOpen(true); }}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const isInitialLoading = loading && cis.length === 0;

  return (
    <div>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton cards={5} rows={8} />}

      {isInitialLoading ? null : (
        <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={4}>配置项管理</Title>
          <Text type="secondary">管理所有配置项 (CI) 及其生命周期</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateModalOpen(true)}>
            新建配置项
          </Button>
        </Space>
      </div>

      {/* Summary */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="配置项总数" value={cis.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃"
              value={cis.filter((c) => c.status === 'active').length}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="维护中"
              value={cis.filter((c) => c.status === 'maintenance').length}
              valueStyle={{ color: colors.warning[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已废弃"
              value={cis.filter((c) => c.status === 'deprecated').length}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={cis}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      {/* Create Modal */}
      <Modal
        title="新建配置项"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="例如：prod-api-server-01" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="类型" name="type" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="host">Host</Select.Option>
                  <Select.Option value="k8s">K8s</Select.Option>
                  <Select.Option value="service">Service</Select.Option>
                  <Select.Option value="application">Application</Select.Option>
                  <Select.Option value="database">Database</Select.Option>
                  <Select.Option value="cache">Cache</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="子类型" name="subtype">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="环境" name="environment">
                <Select>
                  <Select.Option value="development">development</Select.Option>
                  <Select.Option value="testing">testing</Select.Option>
                  <Select.Option value="staging">staging</Select.Option>
                  <Select.Option value="production">production</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负责人" name="owner">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="标签" name="tags">
            <Input placeholder="逗号分隔，例如：web,api,v2" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑配置项"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); editForm.resetFields(); setEditingCI(null); }}
        onOk={() => editForm.submit()}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="例如：prod-api-server-01" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="类型" name="type">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="子类型" name="subtype">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="环境" name="environment">
                <Select>
                  <Select.Option value="development">development</Select.Option>
                  <Select.Option value="testing">testing</Select.Option>
                  <Select.Option value="staging">staging</Select.Option>
                  <Select.Option value="production">production</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负责人" name="owner">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="状态" name="status">
                <Select>
                  <Select.Option value="active">active</Select.Option>
                  <Select.Option value="inactive">inactive</Select.Option>
                  <Select.Option value="maintenance">maintenance</Select.Option>
                  <Select.Option value="deprecated">deprecated</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="标签" name="tags">
                <Input placeholder="逗号分隔，例如：web,api,v2" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title="配置项详情"
        placement="right"
        width={700}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
      >
        {selectedCI && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">{selectedCI.id}</Descriptions.Item>
            <Descriptions.Item label="名称">{selectedCI.name}</Descriptions.Item>
            <Descriptions.Item label="类型">{selectedCI.type}</Descriptions.Item>
            <Descriptions.Item label="子类型">{selectedCI.subtype || '-'}</Descriptions.Item>
            <Descriptions.Item label="环境">{selectedCI.environment || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[selectedCI.status]}>{selectedCI.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="负责人">{selectedCI.owner || '-'}</Descriptions.Item>
            <Descriptions.Item label="标签">
              <Space>
                {(selectedCI.tags || []).map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="属性">
              <pre>{JSON.stringify(selectedCI.attributes, null, 2)}</pre>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(selectedCI.created_at).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {new Date(selectedCI.updated_at).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Topology Page
// ============================================================================

/** CI 类型到图标的映射 */
const typeIconMap: Record<string, React.ReactNode> = {
  host: <CloudServerOutlined />,
  k8s: <ClusterOutlined />,
  service: <DeploymentUnitOutlined />,
  application: <AppstoreOutlined />,
  database: <CloudServerOutlined />,
  cache: <CloudServerOutlined />,
};

/** CI 类型到颜色的映射（使用 design tokens） */
const typeColorMap: Record<string, string> = {
  host: colors.primary[500],
  k8s: colors.info[500],
  service: colors.success[500],
  application: colors.purple[500],
  database: colors.warning[500],
  cache: colors.warning[500],
};

/** CI 状态到颜色的映射 */
const statusColorMap: Record<string, string> = {
  active: colors.success[500],
  inactive: colors.neutral[400],
  maintenance: colors.warning[500],
  deprecated: colors.error[500],
};

/**
 * 将后端拓扑数据转换为 ReactFlow 节点
 * 使用层次布局：按 CI 类型分层排列
 */
const convertToFlowNodes = (nodes: TopologyNode[]): Node[] => {
  const nodeSpacing = { x: 280, y: 120 };
  const startX = 50;
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

  Object.entries(grouped).forEach(([, typeNodes]) => {
    typeNodes.forEach((node, index) => {
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
      color: colors.neutral[400],
    },
    style: {
      stroke: colors.neutral[400],
      strokeWidth: 2,
    },
  }));
};

/** CI 节点数据类型 */
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
  const iconColor = typeColorMap[data.type] || colors.primary[500];
  const statusColor = statusColorMap[data.status] || colors.neutral[400];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* 节点头部：类型图标 + 名称 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: iconColor, fontSize: 16 }}>{typeIconMap[data.type]}</span>
        <Text strong ellipsis={{ tooltip: data.label }} style={{ maxWidth: 140 }}>
          {data.label}
        </Text>
      </div>
      {/* 状态指示器 */}
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
        <Text type="secondary" style={{ fontSize: 12 }}>
          {data.status}
        </Text>
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
          {data.type}
        </Text>
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
        const flowNodes = convertToFlowNodes(data.nodes || []);
        const flowEdges = convertToFlowEdges(data.edges || []);
        setNodes(flowNodes);
        setEdges(flowEdges);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          message.error('权限不足，请重新登录或联系管理员');
        } else {
          message.error(`加载拓扑图失败：${error.message}`);
        }
      } else {
        message.error('加载拓扑图失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 节点和边的变更处理（支持拖拽、删除等操作）
  const onNodesChange: OnNodesChange = (changes) =>
    setNodes((nds) => applyNodeChanges(changes, nds));

  const onEdgesChange: OnEdgesChange = (changes) =>
    setEdges((eds) => applyEdgeChanges(changes, eds));

  // 节点点击事件：显示 CI 详情
  const onNodeClick = (
    _event: React.MouseEvent,
    node: Node,
  ) => {
    const topologyNode = topology?.nodes?.find((n) => n.id === node.id);
    if (topologyNode) {
      setSelectedNode(topologyNode);
      setDetailDrawerOpen(true);
    }
  };

  // 自定义节点类型注册
  const nodeTypes = {
    ciNode: CINode,
  };

  // 为所有节点使用自定义类型
  const typedNodes = nodes.map((node) => ({
    ...node,
    type: 'ciNode',
  }));

  const isInitialLoading = loading && !topology;

  return (
    <div>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton rows={6} />}

      {isInitialLoading ? null : (
        <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={4}>拓扑图</Title>
          <Text type="secondary">可视化资源配置依赖关系</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Card
        loading={loading}
        styles={{ body: { padding: 0, height: 600 } }}
      >
        {topology ? (
          <div style={{ width: '100%', height: 600 }}>
            {/* 顶部信息栏 */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${colors.neutral[200]}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Space>
                <Tag color="blue" icon={<CloudServerOutlined />}>
                  节点: {topology.nodes?.length || 0}
                </Tag>
                <Tag icon={<LinkOutlined />}>
                  连接: {topology.edges?.length || 0}
                </Tag>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                点击节点查看配置项详情 | 支持缩放、拖拽
              </Text>
            </div>
            {/* ReactFlow 画布 */}
            <ReactFlow
              nodes={typedNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
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
                color={colors.neutral[200]}
                gap={16}
                size={1}
              />
              <Controls
                style={{
                  background: colors.neutral[0],
                  border: `1px solid ${colors.neutral[200]}`,
                  borderRadius: 8,
                }}
              />
              <MiniMap
                nodeColor={(node) => {
                  const nodeData = node.data as CINodeData;
                  return typeColorMap[nodeData?.type] || colors.primary[500];
                }}
                nodeStrokeColor={colors.neutral[300]}
                nodeBorderRadius={8}
                maskColor="rgba(0, 0, 0, 0.1)"
                pannable
                zoomable
              />
            </ReactFlow>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: colors.neutral[400] }}>
            暂无拓扑数据
          </div>
        )}
      </Card>

      {/* CI 详情 Drawer */}
      <Drawer
        title="配置项详情"
        placement="right"
        width={700}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
      >
        {selectedNode && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">{selectedNode.id}</Descriptions.Item>
            <Descriptions.Item label="名称">{selectedNode.name}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Space>
                {typeIconMap[selectedNode.type] || <CloudServerOutlined />}
                <Tag color={typeColorMap[selectedNode.type] || 'blue'}>
                  {selectedNode.type}
                </Tag>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[selectedNode.status] || 'default'}>
                {selectedNode.status}
              </Tag>
            </Descriptions.Item>
            {selectedNode.data && (
              <Descriptions.Item label="扩展属性">
                <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                  {JSON.stringify(selectedNode.data, null, 2)}
                </pre>
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

// ============================================================================
// Integration Page
// ============================================================================

const IntegrationPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [k8sResources, setK8sResources] = useState<K8sResource[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hostsRes, k8sRes] = await Promise.all([
        getHosts({ pageSize: 20 }),
        getK8sResources(),
      ]);
      setHosts((hostsRes.data as any).data || []);
      setK8sResources((k8sRes.data as any).data || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          message.error('权限不足，请重新登录或联系管理员');
        } else {
          message.error(`加载集成数据失败：${error.message}`);
        }
      } else {
        message.error('加载集成数据失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await startK8sSync();
      message.success('K8s 同步已启动');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`同步启动失败：${error.message}`);
      } else {
        message.error('同步启动失败');
      }
    } finally {
      setSyncing(false);
    }
  };

  const hostColumns = [
    { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
    { title: 'IP', dataIndex: 'ip', key: 'ip' },
    { title: 'OS', dataIndex: 'os', key: 'os' },
    {
      title: 'CPU',
      dataIndex: 'cpu',
      key: 'cpu',
      render: (v: number) => `${v} Core`,
    },
    {
      title: '内存',
      dataIndex: 'memory',
      key: 'memory',
      render: (v: number) => `${(v / 1024).toFixed(1)} GB`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'running' ? 'green' : 'default'}>{s}</Tag>,
    },
  ];

  const k8sColumns = [
    { title: '类型', dataIndex: 'kind', key: 'kind', render: (k: string) => <Tag>{k}</Tag> },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'Namespace', dataIndex: 'namespace', key: 'namespace' },
    {
      title: '副本',
      dataIndex: 'replicas',
      key: 'replicas',
      render: (r: any) => r ? `${r.current}/${r.desired}` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'Running' ? 'green' : 'default'}>{s}</Tag>,
    },
  ];

  const isInitialLoading = loading && hosts.length === 0 && k8sResources.length === 0;

  return (
    <div>
      {/* Page loading skeleton (initial load) */}
      {isInitialLoading && <PageSkeleton cards={3} rows={8} />}

      {isInitialLoading ? null : (
        <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={4}>集成资源</Title>
          <Text type="secondary">主机、K8s、CI/CD 资源同步状态</Text>
        </div>
        <Button icon={<SyncOutlined spin={syncing} />} onClick={handleSync} loading={syncing}>
          K8s 同步
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="主机数量" value={hosts.length} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="K8s 资源" value={k8sResources.length} prefix={<ClusterOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="运行中主机"
              value={hosts.filter((h) => h.status === 'running').length}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="主机列表" style={{ marginBottom: 16 }} loading={loading}>
        <Table
          columns={hostColumns}
          dataSource={hosts}
          rowKey="ci_id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Card title="K8s 资源" loading={loading}>
        <Table
          columns={k8sColumns}
          dataSource={k8sResources}
          rowKey={(r) => `${r.kind}-${r.namespace}-${r.name}`}
          pagination={{ pageSize: 10 }}
        />
      </Card>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Main CMDB Page
// ============================================================================

const CMDBPage: React.FC = () => {
  const tabItems = [
    {
      key: 'cis',
      label: '配置项',
      children: <CITablePage />,
    },
    {
      key: 'topology',
      label: '拓扑图',
      children: <TopologyPage />,
    },
    {
      key: 'integration',
      label: '集成资源',
      children: <IntegrationPage />,
    },
  ];

  return <Tabs defaultActiveKey="cis" items={tabItems} size="large" />;
};

export default CMDBPage;
