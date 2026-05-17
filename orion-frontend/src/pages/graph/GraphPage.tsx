/**
 * Graph Service Page
 * Neo4j graph database query service for service dependency visualization,
 * infrastructure topology, and impact analysis.
 * Four-tab layout: Service Dependencies | Infrastructure Topology | Impact Analysis | Cypher Query
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Spin,
  Badge,
  Statistic,
  Row,
  Col,
  Tree,
  Descriptions,
  Alert,
  Table as AntTable,
} from 'antd';
import {
  ReloadOutlined,
  ShareAltOutlined,
  DeploymentUnitOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getHealth,
  executeQuery,
  getServiceDependencies,
  getServiceDetail,
  getInfrastructureTopology,
  getImpactAnalysis,
  type GraphHealth,
  type ServiceDependency,
  type ServiceDetail,
  type InfrastructureNode,
  type InfrastructureTopology,
  type ImpactAnalysis,
  type ImpactNode,
  type GraphEdge,
} from '@/api/graph';
import { colors } from '@/tokens/colors';

const { Title, Text, Paragraph } = Typography;

// ---- Color Maps ----

const serviceStatusColorMap: Record<ServiceDependency['status'], string> = {
  running: 'green',
  stopped: 'red',
  degraded: 'orange',
  unknown: 'default',
};

const serviceStatusLabelMap: Record<ServiceDependency['status'], string> = {
  running: '运行中',
  stopped: '已停止',
  degraded: '降级',
  unknown: '未知',
};

const infraTypeLabelMap: Record<InfrastructureNode['type'], string> = {
  host: '主机',
  network: '网络',
  storage: '存储',
  database: '数据库',
  cache: '缓存',
  load_balancer: '负载均衡',
};

const infraStatusColorMap: Record<InfrastructureNode['status'], string> = {
  online: 'green',
  offline: 'red',
  degraded: 'orange',
};

const impactLevelColorMap: Record<ImpactNode['impactLevel'], string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'blue',
};

const impactLevelLabelMap: Record<ImpactNode['impactLevel'], string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

// ---- Main Component ----

const GraphPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dependencies');
  const [health, setHealth] = useState<GraphHealth | null>(null);

  // Service Dependencies state
  const [services, setServices] = useState<ServiceDependency[]>([]);
  const [svcLoading, setSvcLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);
  const [serviceDetailLoading, setServiceDetailLoading] = useState(false);

  // Infrastructure Topology state
  const [infraTopology, setInfraTopology] = useState<InfrastructureTopology>({ nodes: [], edges: [] });
  const [infraLoading, setInfraLoading] = useState(false);

  // Impact Analysis state
  const [impactData, setImpactData] = useState<ImpactAnalysis | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactServiceId, setImpactServiceId] = useState<string>('');

  // Cypher Query state
  const [queryForm] = Form.useForm();
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // ---- Data Loading ----

  const loadHealth = async () => {
    try {
      const res = await getHealth();
      setHealth(res.data?.data ?? null);
    } catch {
      setHealth(null);
    }
  };

  const loadServices = async () => {
    setSvcLoading(true);
    try {
      const res = await getServiceDependencies({ tenantId: 'default' });
      const list = res.data?.data;
      setServices(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setServices([]);
      message.error(`加载服务依赖失败: ${(error as Error).message}`);
    } finally {
      setSvcLoading(false);
    }
  };

  const loadInfrastructure = async () => {
    setInfraLoading(true);
    try {
      const res = await getInfrastructureTopology({ tenantId: 'default' });
      const data = res.data?.data;
      setInfraTopology(data ?? { nodes: [], edges: [] });
    } catch (error: unknown) {
      setInfraTopology({ nodes: [], edges: [] });
      message.error(`加载基础设施拓扑失败: ${(error as Error).message}`);
    } finally {
      setInfraLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadHealth(), loadServices(), loadInfrastructure()]).finally(() =>
      setLoading(false)
    );
  }, []);

  // ---- Service Dependency Handlers ----

  const handleSelectService = async (id: string) => {
    setServiceDetailLoading(true);
    try {
      const res = await getServiceDetail(id);
      setSelectedService(res.data?.data ?? null);
    } catch (error: unknown) {
      setSelectedService(null);
      message.error(`加载服务详情失败: ${(error as Error).message}`);
    } finally {
      setServiceDetailLoading(false);
    }
  };

  // ---- Impact Analysis Handler ----

  const handleAnalyzeImpact = async () => {
    if (!impactServiceId) {
      message.warning('请选择要分析的服务');
      return;
    }
    setImpactLoading(true);
    try {
      const res = await getImpactAnalysis(impactServiceId);
      setImpactData(res.data?.data ?? null);
    } catch (error: unknown) {
      setImpactData(null);
      message.error(`影响分析失败: ${(error as Error).message}`);
    } finally {
      setImpactLoading(false);
    }
  };

  // ---- Cypher Query Handler ----

  const handleExecuteQuery = async () => {
    try {
      const values = await queryForm.validateFields();
      setQueryLoading(true);
      setQueryError(null);
      const res = await executeQuery({ query: values.cypherQuery, parameters: {} });
      const data = res.data?.data;
      setQueryResult({
        columns: data?.columns ?? [],
        rows: data?.rows ?? [],
      });
      message.success('查询执行成功');
    } catch (error: unknown) {
      setQueryResult(null);
      setQueryError((error as Error).message);
      message.error(`查询失败: ${(error as Error).message}`);
    } finally {
      setQueryLoading(false);
    }
  };

  // ---- Build Tree Data for Service Dependencies ----

  const buildTreeData = () => {
    const rootNodes = services.filter((s) => s.dependencies.length === 0 || s.dependents.length === 0);
    const seen = new Set<string>();

    const buildChildren = (serviceId: string, depth: number): Array<{ key: string; title: React.ReactNode; children?: Array<{ key: string; title: React.ReactNode }> }> => {
      if (depth > 2 || seen.has(serviceId)) return [];
      seen.add(serviceId);
      const svc = services.find((s) => s.id === serviceId);
      if (!svc) return [];

      return svc.dependencies.map((depId) => {
        const dep = services.find((s) => s.id === depId);
        return {
          key: `${serviceId}->${depId}`,
          title: (
            <Space>
              <Tag color={dep ? serviceStatusColorMap[dep.status] : 'default'}>
                {dep ? serviceStatusLabelMap[dep.status] : '未知'}
              </Tag>
              <Text>{dep?.name ?? depId}</Text>
            </Space>
          ),
          children: buildChildren(depId, depth + 1),
        };
      });
    };

    return rootNodes.slice(0, 10).map((svc) => ({
      key: svc.id,
      title: (
        <Space>
          <DeploymentUnitOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{svc.name}</Text>
          <Tag color={serviceStatusColorMap[svc.status]}>
            {serviceStatusLabelMap[svc.status]}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            依赖: {svc.dependencies.length} | 被依赖: {svc.dependents.length}
          </Text>
        </Space>
      ),
      children: buildChildren(svc.id, 0),
    }));
  };

  // ---- Columns ----

  const serviceColumns: TableColumn<ServiceDependency>[] = [
    {
      key: 'id',
      title: '服务ID',
      dataIndex: 'id',
      width: 120,
      render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
    },
    {
      key: 'name',
      title: '服务名称',
      dataIndex: 'name',
      width: 180,
      render: (v: unknown) => (
        <Space>
          <DeploymentUnitOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{String(v)}</Text>
        </Space>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (v: unknown) => <Text type="secondary">{v ? String(v) : '-'}</Text>,
    },
    {
      key: 'dependencies',
      title: '依赖数',
      dataIndex: 'dependencies',
      width: 80,
      render: (v: unknown) => <Text>{Array.isArray(v) ? v.length : 0}</Text>,
    },
    {
      key: 'dependents',
      title: '被依赖数',
      dataIndex: 'dependents',
      width: 80,
      render: (v: unknown) => <Text>{Array.isArray(v) ? v.length : 0}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => (
        <Badge
          status={
            v === 'running' ? 'success' : v === 'stopped' ? 'error' : v === 'degraded' ? 'warning' : 'default'
          }
          text={serviceStatusLabelMap[v as ServiceDependency['status']]}
        />
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: ServiceDependency) => (
        <Button
          type="link"
          size="small"
          onClick={() => handleSelectService(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  const infraColumns: TableColumn<InfrastructureNode>[] = [
    {
      key: 'id',
      title: '节点ID',
      dataIndex: 'id',
      width: 120,
      render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 120,
      render: (v: unknown) => {
        const type = v as InfrastructureNode['type'];
        return <Tag color="blue">{infraTypeLabelMap[type] ?? type}</Tag>;
      },
    },
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 180,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => {
        const status = v as InfrastructureNode['status'];
        return (
          <Badge
            status={status === 'online' ? 'success' : status === 'offline' ? 'error' : 'warning'}
            text={status}
          />
        );
      },
    },
  ];

  const impactColumns: TableColumn<ImpactNode>[] = [
    {
      key: 'service',
      title: '受影响服务',
      dataIndex: 'service',
      width: 200,
      render: (v: unknown) => {
        const svc = v as ServiceDependency;
        return <Text strong>{svc?.name ?? 'Unknown'}</Text>;
      },
    },
    {
      key: 'impactLevel',
      title: '影响级别',
      dataIndex: 'impactLevel',
      width: 100,
      render: (v: unknown) => {
        const level = v as ImpactNode['impactLevel'];
        return <Tag color={impactLevelColorMap[level]}>{impactLevelLabelMap[level]}</Tag>;
      },
    },
    {
      key: 'status',
      title: '当前状态',
      dataIndex: ['service', 'status'],
      width: 100,
      render: (v: unknown) => (
        <Tag color={serviceStatusColorMap[v as ServiceDependency['status']]}>
          {serviceStatusLabelMap[v as ServiceDependency['status']]}
        </Tag>
      ),
    },
    {
      key: 'description',
      title: '影响描述',
      dataIndex: 'description',
      render: (v: unknown) => <Text type="secondary">{v ? String(v) : '-'}</Text>,
    },
  ];

  // ---- Service Detail View ----

  const serviceDetailView = selectedService ? (
    <Card
      title={
        <Space>
          <DeploymentUnitOutlined style={{ color: colors.primary[500] }} />
          <Text>{selectedService.name}</Text>
          <Tag color={serviceStatusColorMap[selectedService.status]}>
            {serviceStatusLabelMap[selectedService.status]}
          </Tag>
        </Space>
      }
      size="small"
      extra={
        <Button type="link" size="small" onClick={() => setSelectedService(null)}>
          关闭
        </Button>
      }
      style={{ marginBottom: 16 }}
    >
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="服务ID">{selectedService.id}</Descriptions.Item>
        <Descriptions.Item label="版本">{selectedService.version ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {selectedService.description ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="负责人">{selectedService.owner ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="上游依赖数">{selectedService.upstreamDependencies.length}</Descriptions.Item>
        <Descriptions.Item label="下游依赖数">{selectedService.downstreamDependencies.length}</Descriptions.Item>
        <Descriptions.Item label="基础设施节点" span={2}>
          {selectedService.infrastructureNodes.length}
        </Descriptions.Item>
      </Descriptions>

      {selectedService.upstreamDependencies.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong>上游依赖:</Text>
          <div style={{ marginTop: 8 }}>
            {selectedService.upstreamDependencies.map((dep) => (
              <Tag key={dep.id} color={serviceStatusColorMap[dep.status]} style={{ marginBottom: 4 }}>
                {dep.name}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {selectedService.downstreamDependencies.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong>下游依赖:</Text>
          <div style={{ marginTop: 8 }}>
            {selectedService.downstreamDependencies.map((dep) => (
              <Tag key={dep.id} color={serviceStatusColorMap[dep.status]} style={{ marginBottom: 4 }}>
                {dep.name}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  ) : null;

  // ---- Tab Contents ----

  const dependenciesTab = (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="服务总数" value={services.length} prefix={<DeploymentUnitOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="运行中"
              value={services.filter((s) => s.status === 'running').length}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="降级"
              value={services.filter((s) => s.status === 'degraded').length}
              valueStyle={{ color: colors.warning[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已停止"
              value={services.filter((s) => s.status === 'stopped').length}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Service Detail */}
      {serviceDetailView}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text type="secondary">服务依赖关系概览</Text>
        <Button icon={<ReloadOutlined />} onClick={loadServices} loading={svcLoading}>
          刷新
        </Button>
      </div>

      {/* Table + Tree */}
      <Row gutter={16}>
        <Col span={14}>
          <Spin spinning={svcLoading}>
            <Table
              columns={serviceColumns}
              dataSource={services}
              loading={svcLoading}
              rowKey="id"
              size="middle"
              striped
            />
          </Spin>
        </Col>
        <Col span={10}>
          <Card title="依赖树" size="small" style={{ maxHeight: 500, overflow: 'auto' }}>
            <Spin spinning={svcLoading}>
              {services.length === 0 ? (
                <Text type="secondary">暂无数据</Text>
              ) : (
                <Tree
                  treeData={buildTreeData()}
                  defaultExpandAll={false}
                  showLine
                  selectable
                  onSelect={(keys) => {
                    if (keys.length > 0) {
                      const key = String(keys[0]);
                      // If it's a root node (service ID), show detail
                      if (!key.includes('->')) {
                        handleSelectService(key);
                      }
                    }
                  }}
                />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const infrastructureTab = (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="节点总数" value={infraTopology.nodes.length} prefix={<ShareAltOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="在线"
              value={infraTopology.nodes.filter((n) => n.status === 'online').length}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="离线"
              value={infraTopology.nodes.filter((n) => n.status === 'offline').length}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="连接数"
              value={infraTopology.edges.length}
              prefix={<ShareAltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={loadInfrastructure} loading={infraLoading}>
          刷新
        </Button>
      </div>

      {/* Topology Table */}
      <Spin spinning={infraLoading}>
        {infraTopology.nodes.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <ShareAltOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
            <p style={{ marginTop: 16, color: colors.neutral[500] }}>暂无基础设施数据</p>
          </Card>
        ) : (
          <>
            <Table
              columns={infraColumns}
              dataSource={infraTopology.nodes}
              loading={infraLoading}
              rowKey="id"
              size="middle"
              striped
            />

            {/* Edge List */}
            {infraTopology.edges.length > 0 && (
              <Card title="连接关系" size="small" style={{ marginTop: 16 }}>
                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                  {infraTopology.edges.map((edge: GraphEdge) => {
                    const sourceNode = infraTopology.nodes.find((n) => n.id === edge.source);
                    const targetNode = infraTopology.nodes.find((n) => n.id === edge.target);
                    return (
                      <div
                        key={edge.id}
                        style={{
                          padding: '6px 0',
                          borderBottom: `1px solid ${colors.neutral[100]}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
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
            )}
          </>
        )}
      </Spin>
    </div>
  );

  const impactTab = (
    <div>
      {/* Service Selector */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>选择要分析的服务:</Text>
          <Select
            style={{ width: 280 }}
            value={impactServiceId || undefined}
            onChange={setImpactServiceId}
            placeholder="请选择服务"
            options={services.map((s) => ({ label: s.name, value: s.id }))}
            allowClear
          />
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleAnalyzeImpact}
            loading={impactLoading}
            disabled={!impactServiceId}
          >
            分析影响
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setImpactData(null); setImpactServiceId(''); }}>
            重置
          </Button>
        </Space>
      </Card>

      {/* Impact Result */}
      <Spin spinning={impactLoading}>
        {impactData && (
          <>
            {/* Summary */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="总影响服务" value={impactData.summary.totalImpacted} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="严重影响"
                    value={impactData.summary.criticalCount}
                    valueStyle={{ color: colors.error[500] }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="高影响"
                    value={impactData.summary.highCount}
                    valueStyle={{ color: colors.warning[500] }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="基础设施影响"
                    value={impactData.infrastructureImpacted.length}
                    prefix={<ShareAltOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {/* Warning Alert for Critical Impacts */}
            {impactData.summary.criticalCount > 0 && (
              <Alert
                message="严重警告"
                description={`该服务故障将导致 ${impactData.summary.criticalCount} 个关键服务受到严重影响`}
                type="error"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Directly Impacted */}
            <Card
              title={
                <Space>
                  <WarningOutlined style={{ color: colors.error[500] }} />
                  <Text>直接影响 ({impactData.directlyImpacted.length})</Text>
                </Space>
              }
              size="small"
              style={{ marginBottom: 16 }}
            >
              {impactData.directlyImpacted.length === 0 ? (
                <Text type="secondary">无直接影响</Text>
              ) : (
                <Table
                  columns={impactColumns}
                  dataSource={impactData.directlyImpacted}
                  rowKey={(record) => (record.service as ServiceDependency).id}
                  size="small"
                  pagination={false}
                />
              )}
            </Card>

            {/* Transitively Impacted */}
            <Card
              title={
                <Space>
                  <ShareAltOutlined style={{ color: colors.warning[500] }} />
                  <Text>间接影响 ({impactData.transitivelyImpacted.length})</Text>
                </Space>
              }
              size="small"
            >
              {impactData.transitivelyImpacted.length === 0 ? (
                <Text type="secondary">无间接影响</Text>
              ) : (
                <Table
                  columns={impactColumns}
                  dataSource={impactData.transitivelyImpacted}
                  rowKey={(record) => (record.service as ServiceDependency).id}
                  size="small"
                  pagination={false}
                />
              )}
            </Card>
          </>
        )}

        {!impactData && !impactLoading && (
          <Card style={{ textAlign: 'center', padding: 60 }}>
            <ThunderboltOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
            <p style={{ marginTop: 16, color: colors.neutral[500] }}>
              请选择一个服务并点击"分析影响"来查看故障影响范围
            </p>
          </Card>
        )}
      </Spin>
    </div>
  );

  const cypherTab = (
    <div>
      {/* Query Form */}
      <Card title="Cypher 查询" size="small" style={{ marginBottom: 16 }}>
        <Form form={queryForm} layout="vertical">
          <Form.Item
            name="cypherQuery"
            rules={[{ required: true, message: '请输入 Cypher 查询语句' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder={`MATCH (s:Service)-[:DEPENDS_ON]->(d:Service)\nRETURN s.name, d.name, s.status, d.status\nLIMIT 25`}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecuteQuery}
              loading={queryLoading}
            >
              执行查询
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Error Display */}
      {queryError && (
        <Alert
          message="查询错误"
          description={queryError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Query Results */}
      {queryResult && (
        <Card
          title={
            <Space>
              <CodeOutlined />
              <Text>查询结果</Text>
              <Tag color="blue">{queryResult.rows.length} 行</Tag>
            </Space>
          }
          size="small"
        >
          {queryResult.rows.length === 0 ? (
            <Text type="secondary">查询成功，但无返回数据</Text>
          ) : (
            <AntTable
              dataSource={queryResult.rows}
              rowKey={(_, index) => String(index)}
              size="small"
              scroll={{ x: true }}
              columns={queryResult.columns.map((col) => ({
                title: col,
                dataIndex: col,
                key: col,
                ellipsis: true,
                render: (v: unknown) => {
                  if (v === null || v === undefined) return <Text type="secondary">null</Text>;
                  if (typeof v === 'object') return <Text code>{JSON.stringify(v)}</Text>;
                  return <Text>{String(v)}</Text>;
                },
              }))}
            />
          )}
        </Card>
      )}

      {!queryResult && !queryError && (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <CodeOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
          <Paragraph type="secondary" style={{ marginTop: 16 }}>
            输入 Cypher 查询语句并执行
          </Paragraph>
          <Text type="secondary" style={{ fontSize: 12 }}>
            示例: MATCH (n) RETURN n LIMIT 10
          </Text>
        </Card>
      )}
    </div>
  );

  // ---- Tab Items ----

  const tabItems = [
    {
      key: 'dependencies',
      label: (
        <span>
          <DeploymentUnitOutlined /> 服务依赖图
        </span>
      ),
      children: dependenciesTab,
    },
    {
      key: 'infrastructure',
      label: (
        <span>
          <ShareAltOutlined /> 基础设施拓扑
        </span>
      ),
      children: infrastructureTab,
    },
    {
      key: 'impact',
      label: (
        <span>
          <ThunderboltOutlined /> 影响分析
        </span>
      ),
      children: impactTab,
    },
    {
      key: 'cypher',
      label: (
        <span>
          <CodeOutlined /> Cypher 查询
        </span>
      ),
      children: cypherTab,
    },
  ];

  const isInitialLoading =
    loading && services.length === 0 && infraTopology.nodes.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <PageSkeleton cards={4} rows={8} />
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <Title level={3} style={{ margin: 0 }}>
              <ShareAltOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              图数据库服务
            </Title>
            <Text type="secondary">
              服务依赖可视化、基础设施拓扑与影响分析 (Neo4j)
            </Text>
            {health && (
              <div style={{ marginTop: 8 }}>
                <Tag color={health.status === 'healthy' ? 'green' : health.status === 'degraded' ? 'orange' : 'red'}>
                  {health.status}
                </Tag>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  节点: {health.nodeCount} | 边: {health.edgeCount}
                  {health.lastChecked && ` | 最后检查: ${health.lastChecked}`}
                </Text>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
        </>
      )}
    </div>
  );
};

export default GraphPage;
