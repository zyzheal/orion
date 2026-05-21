/**
 * Data Pipeline Page
 * Phase 4 - ETL pipeline management, data flow monitoring, and transformation rules
 *
 * Features:
 * - Data pipeline list with status, source, destination
 * - Create new data pipelines
 * - Execute/schedule pipelines
 * - Pipeline status monitoring
 * - Data lineage visualization
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Descriptions,
  Drawer,
} from 'antd';
import {
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ApiOutlined,
  ShareAltOutlined,
  ApartmentOutlined,} from '@ant-design/icons';
import {
  dataPipelineApi,
  type DataPipeline,
  type PipelineStatus,
  type DataLineage,
} from '@/api/data-pipeline';

const { Title, Text } = Typography;

// Type configuration
const typeConfig: Record<string, { color: string; label: string }> = {
  mysql: { color: 'blue', label: 'MySQL' },
  postgresql: { color: 'blue', label: 'PostgreSQL' },
  kafka: { color: 'green', label: 'Kafka' },
  elasticsearch: { color: 'orange', label: 'Elasticsearch' },
  clickhouse: { color: 'purple', label: 'ClickHouse' },
  s3: { color: 'cyan', label: 'S3' },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '活跃' },
  inactive: { color: 'default', label: '未激活' },
  running: { color: 'processing', label: '运行中' },
  failed: { color: 'red', label: '失败' },
};

const sourceTypeOptions = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'kafka', label: 'Kafka' },
  { value: 'elasticsearch', label: 'Elasticsearch' },
];

const destTypeOptions = [
  { value: 'clickhouse', label: 'ClickHouse' },
  { value: 'elasticsearch', label: 'Elasticsearch' },
  { value: 's3', label: 'S3' },
  { value: 'postgresql', label: 'PostgreSQL' },
];

const DataPipelinePage: React.FC = () => {
  const [pipelines, setPipelines] = useState<DataPipeline[]>([]);
  const [pipelineStatuses, setPipelineStatuses] = useState<Record<string, PipelineStatus>>({});
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [lineageDrawerOpen, setLineageDrawerOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<DataPipeline | null>(null);
  const [lineageData, setLineageData] = useState<DataLineage | null>(null);
  const [lineageLoading, setLineageLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await dataPipelineApi.listPipelines();
      const pipelineList = Array.isArray(data) ? data : [];
      setPipelines(pipelineList);

      // Load status for each pipeline
      const statuses: Record<string, PipelineStatus> = {};
      await Promise.all(
        pipelineList.map(async (p) => {
          try {
            const status = await dataPipelineApi.getPipelineStatus(p.id);
            statuses[p.id] = status;
          } catch {
            // Ignore individual status failures
          }
        })
      );
      setPipelineStatuses(statuses);
    } catch (error: unknown) {
      message.error(`加载数据管道失败: ${(error as Error).message}`);
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await dataPipelineApi.createPipeline({
        name: values.name,
        description: values.description || '',
        source: {
          type: values.sourceType,
          config: {
            connection: values.sourceConnection || '',
            database: values.sourceDatabase || '',
            table: values.sourceTable || '',
          },
        },
        destination: {
          type: values.destType,
          config: {
            connection: values.destConnection || '',
            database: values.destDatabase || '',
            table: values.destTable || '',
          },
        },
        transforms: values.transforms ? values.transforms.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      });
      message.success('数据管道创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建数据管道失败: ${(error as Error).message}`);
    }
  };

  const handleExecute = async (id: string) => {
    setActionLoading(id);
    try {
      await dataPipelineApi.executePipeline(id);
      message.success('管道执行成功');
      loadData();
    } catch (error: unknown) {
      message.error(`执行管道失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSchedule = async (id: string) => {
    const schedule = pipelineStatuses[id]?.nextRunAt ? '' : '0 */4 * * *';
    if (!schedule) {
      message.info('管道已配置定时执行');
      return;
    }
    setActionLoading(id);
    try {
      await dataPipelineApi.schedulePipeline(id, { schedule });
      message.success('管道定时执行已配置');
      loadData();
    } catch (error: unknown) {
      message.error(`配置定时执行失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewLineage = async (pipeline: DataPipeline) => {
    setSelectedPipeline(pipeline);
    setLineageDrawerOpen(true);
    setLineageLoading(true);
    try {
      const lineage = await dataPipelineApi.getDataLineage(pipeline.id);
      setLineageData(lineage);
    } catch (error: unknown) {
      message.error(`加载数据血缘失败: ${(error as Error).message}`);
      setLineageData(null);
    } finally {
      setLineageLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: pipelines.length,
    running: pipelines.filter((p) => p.status === 'running').length,
    active: pipelines.filter((p) => p.status === 'active').length,
    failed: pipelines.filter((p) => p.status === 'failed').length,
  }), [pipelines]);

  // Pipeline table columns
  const pipelineColumns = [
    {
      title: '管道名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (v: string, record: DataPipeline) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: record.description }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: '数据源',
      key: 'source',
      width: 140,
      render: (_: unknown, record: DataPipeline) => {
        const cfg = typeConfig[record.source?.type] || { color: 'default', label: record.source?.type || '-' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '目标',
      key: 'destination',
      width: 140,
      render: (_: unknown, record: DataPipeline) => {
        const cfg = typeConfig[record.destination?.type] || { color: 'default', label: record.destination?.type || '-' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const cfg = statusConfig[v] || statusConfig.inactive;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '调度',
      key: 'schedule',
      width: 120,
      render: (_: unknown, record: DataPipeline) => record.schedule || '手动',
    },
    {
      title: '上次执行',
      key: 'lastRun',
      width: 160,
      render: (_: unknown, record: DataPipeline) => {
        const status = pipelineStatuses[record.id];
        return status?.lastRunAt ? new Date(status.lastRunAt).toLocaleString('zh-CN') : '-';
      },
    },
    {
      title: '成功率',
      key: 'successRate',
      width: 100,
      render: (_: unknown, record: DataPipeline) => {
        const status = pipelineStatuses[record.id];
        return status ? `${(status.successRate * 100).toFixed(1)}%` : '-';
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: DataPipeline) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={actionLoading === record.id}
            onClick={() => handleExecute(record.id)}
          >
            执行
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ShareAltOutlined />}
            onClick={() => handleViewLineage(record)}
          >
            血缘
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PauseCircleOutlined />}
            loading={actionLoading === record.id}
            onClick={() => handleSchedule(record.id)}
          >
            调度
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ApartmentOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <DatabaseOutlined style={{ marginRight: 8 }} />
            数据管道
          </Title>
          <Text type="secondary">ETL 管道管理、数据流监控和转换规则</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建管道
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="管道总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行中" value={stats.running} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃" value={stats.active} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败"
              value={stats.failed}
              valueStyle={{ color: stats.failed > 0 ? '#ff4d4f' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {/* Pipeline List */}
      <Card title="数据管道列表">
        <Table
          columns={pipelineColumns}
          dataSource={pipelines}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建数据管道"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="管道名称"
            name="name"
            rules={[{ required: true, message: '请输入管道名称' }]}
          >
            <Input placeholder="如: User Analytics ETL" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="管道描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="数据源类型"
                name="sourceType"
                rules={[{ required: true, message: '请选择数据源类型' }]}
              >
                <Select placeholder="选择数据源" options={sourceTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="连接地址" name="sourceConnection">
                <Input placeholder="host:port" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="数据库/Topic" name="sourceDatabase">
                <Input placeholder="数据库或 Topic 名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="目标类型"
                name="destType"
                rules={[{ required: true, message: '请选择目标类型' }]}
              >
                <Select placeholder="选择目标" options={destTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="连接地址" name="destConnection">
                <Input placeholder="host:port" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="数据库/表" name="destDatabase">
                <Input placeholder="数据库或表名称" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="转换规则 (逗号分隔)" name="transforms">
            <Input placeholder="如: filter, map, aggregate" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Lineage Drawer */}
      <Drawer
        title="数据血缘"
        open={lineageDrawerOpen}
        onClose={() => {
          setLineageDrawerOpen(false);
          setLineageData(null);
        }}
        width={600}
      >
        {selectedPipeline && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="管道名称">{selectedPipeline.name}</Descriptions.Item>
              <Descriptions.Item label="数据源">{selectedPipeline.source?.type}</Descriptions.Item>
              <Descriptions.Item label="目标">{selectedPipeline.destination?.type}</Descriptions.Item>
            </Descriptions>

            <Card title="血缘关系" size="small" style={{ marginTop: 16 }}>
              {lineageLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>加载中...</div>
              ) : lineageData ? (
                <div>
                  {/* Source Node */}
                  <Card size="small" style={{ marginBottom: 8, borderColor: '#1677ff' }}>
                    <Space>
                      <DatabaseOutlined style={{ color: '#1677ff' }} />
                      <Text strong>Source: {lineageData.nodes.find((n) => n.type === 'source')?.name || '-'}</Text>
                    </Space>
                  </Card>

                  {/* Transform Nodes */}
                  {lineageData.nodes.filter((n) => n.type === 'transform').length > 0 && (
                    <>
                      <div style={{ textAlign: 'center', margin: '8px 0' }}>
                        <ApiOutlined style={{ color: '#faad14' }} />
                      </div>
                      {lineageData.nodes.filter((n) => n.type === 'transform').map((node) => (
                        <Card key={node.id} size="small" style={{ marginBottom: 8, marginLeft: 24, borderColor: '#faad14' }}>
                          <Space>
                            <ApiOutlined style={{ color: '#faad14' }} />
                            <Text>{node.name}</Text>
                          </Space>
                        </Card>
                      ))}
                    </>
                  )}

                  {/* Destination Node */}
                  <div style={{ textAlign: 'center', margin: '8px 0' }}>
                    <ApiOutlined style={{ color: '#52c41a' }} />
                  </div>
                  <Card size="small" style={{ borderColor: '#52c41a' }}>
                    <Space>
                      <DatabaseOutlined style={{ color: '#52c41a' }} />
                      <Text strong>Destination: {lineageData.nodes.find((n) => n.type === 'destination')?.name || '-'}</Text>
                    </Space>
                  </Card>

                  {/* Edges */}
                  {lineageData.edges.length > 0 && (
                    <Card title="连接关系" size="small" style={{ marginTop: 16 }}>
                      {lineageData.edges.map((edge, idx) => (
                        <div key={idx} style={{ marginBottom: 4 }}>
                          <Text type="secondary">
                            {edge.from} → {edge.to}
                            <Tag style={{ marginLeft: 8 }}>{edge.dataType}</Tag>
                          </Text>
                        </div>
                      ))}
                    </Card>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <Text type="secondary">暂无血缘数据</Text>
                </div>
              )}
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default DataPipelinePage;
