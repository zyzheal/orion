/**
 * Data Pipeline Page
 * Phase 3 - ETL pipeline management, data flow monitoring, and transformation rules
 */
import React, { useState, useEffect } from 'react';
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
} from 'antd';
import {
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface DataPipeline {
  id: string;
  name: string;
  source: string;
  destination: string;
  type: 'etl' | 'streaming' | 'batch' | 'sync';
  status: 'running' | 'paused' | 'failed' | 'completed' | 'scheduled';
  schedule: string;
  lastRunAt?: string;
  recordsProcessed: number;
  errorRate: number;
  createdAt: string;
}

interface TransformRule {
  id: string;
  pipelineId: string;
  name: string;
  type: 'filter' | 'map' | 'aggregate' | 'join';
  enabled: boolean;
}

const mockPipelines: DataPipeline[] = [
  { id: 'dp1', name: 'User Analytics ETL', source: 'MySQL/Users', destination: 'ClickHouse/Analytics', type: 'etl', status: 'running', schedule: '0 */4 * * *', lastRunAt: '2026-05-05 08:00', recordsProcessed: 1250000, errorRate: 0.02, createdAt: '2025-06-15' },
  { id: 'dp2', name: 'Log Aggregation', source: 'Kafka/Logs', destination: 'Elasticsearch/Logs', type: 'streaming', status: 'running', schedule: 'continuous', lastRunAt: '2026-05-05 10:30', recordsProcessed: 8500000, errorRate: 0.001, createdAt: '2025-07-20' },
  { id: 'dp3', name: 'Daily Report Sync', source: 'PostgreSQL/Reports', destination: 'S3/Reports', type: 'batch', status: 'completed', schedule: '0 2 * * *', lastRunAt: '2026-05-05 02:00', recordsProcessed: 45000, errorRate: 0, createdAt: '2025-08-10' },
  { id: 'dp4', name: 'Audit Log Archive', source: 'ES/Audit', destination: 'S3/Archive', type: 'sync', status: 'paused', schedule: '0 0 * * 0', lastRunAt: '2026-05-04 00:00', recordsProcessed: 320000, errorRate: 0.05, createdAt: '2025-09-01' },
];

const mockRules: TransformRule[] = [
  { id: 'r1', pipelineId: 'dp1', name: 'Filter Active Users', type: 'filter', enabled: true },
  { id: 'r2', pipelineId: 'dp1', name: 'Aggregate Daily Stats', type: 'aggregate', enabled: true },
  { id: 'r3', pipelineId: 'dp2', name: 'Log Level Filter', type: 'filter', enabled: true },
  { id: 'r4', pipelineId: 'dp2', name: 'Parse JSON Fields', type: 'map', enabled: false },
];

const DataPipelinePage: React.FC = () => {
  const [pipelines, setPipelines] = useState<DataPipeline[]>(mockPipelines);
  const [rules] = useState<TransformRule[]>(mockRules);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      message.error('Failed to load data pipeline information');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    const newPipeline: DataPipeline = {
      id: `dp${Date.now()}`,
      name: values.name,
      source: values.source,
      destination: values.destination,
      type: values.type,
      status: 'scheduled',
      schedule: values.schedule || 'manual',
      recordsProcessed: 0,
      errorRate: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setPipelines([...pipelines, newPipeline]);
    message.success('Pipeline created');
    setCreateModalOpen(false);
    form.resetFields();
  };

  const togglePipeline = (id: string) => {
    setPipelines(pipelines.map((p) => {
      if (p.id === id) {
        const nextStatus = p.status === 'running' ? 'paused' : 'running';
        return { ...p, status: nextStatus as DataPipeline['status'] };
      }
      return p;
    }));
    message.success('Pipeline status toggled');
  };

  const typeColor: Record<string, string> = {
    etl: 'blue',
    streaming: 'green',
    batch: 'orange',
    sync: 'purple',
  };

  const statusColor: Record<string, string> = {
    running: 'green',
    paused: 'gold',
    failed: 'red',
    completed: 'blue',
    scheduled: 'cyan',
  };

  const pipelineColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Source', dataIndex: 'source', key: 'source' },
    { title: 'Destination', dataIndex: 'destination', key: 'destination' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color={typeColor[v]}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    { title: 'Schedule', dataIndex: 'schedule', key: 'schedule' },
    { title: 'Records', dataIndex: 'recordsProcessed', key: 'recordsProcessed', render: (v: number) => v.toLocaleString() },
    { title: 'Error Rate', dataIndex: 'errorRate', key: 'errorRate', render: (v: number) => `${(v * 100).toFixed(2)}%` },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: DataPipeline) => (
        <Space>
          <Button
            size="small"
            icon={record.status === 'running' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => togglePipeline(record.id)}
          >
            {record.status === 'running' ? 'Pause' : 'Start'}
          </Button>
        </Space>
      ),
    },
  ];

  const ruleColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Pipeline', dataIndex: 'pipelineId', key: 'pipelineId' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
  ];

  const totalRecords = pipelines.reduce((s, p) => s + p.recordsProcessed, 0);
  const runningCount = pipelines.filter((p) => p.status === 'running').length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DatabaseOutlined /> Data Pipelines
          </Title>
          <Text type="secondary">ETL pipeline management, data flow monitoring, and transformation rules</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Create Pipeline
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Pipelines" value={pipelines.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Running" value={runningCount} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Records" value={totalRecords.toLocaleString()} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Transform Rules" value={rules.length} /></Card>
        </Col>
      </Row>

      {/* Pipeline List */}
      <Card title="Data Pipelines" style={{ marginBottom: 24 }}>
        <Table columns={pipelineColumns} dataSource={pipelines} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Transform Rules */}
      <Card title="Transform Rules">
        <Table columns={ruleColumns} dataSource={rules} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Data Pipeline"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="Pipeline name" />
          </Form.Item>
          <Form.Item label="Source" name="source" rules={[{ required: true }]}>
            <Input placeholder="e.g. MySQL/Users" />
          </Form.Item>
          <Form.Item label="Destination" name="destination" rules={[{ required: true }]}>
            <Input placeholder="e.g. ClickHouse/Analytics" />
          </Form.Item>
          <Form.Item label="Type" name="type" initialValue="etl" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'etl', label: 'ETL' },
                { value: 'streaming', label: 'Streaming' },
                { value: 'batch', label: 'Batch' },
                { value: 'sync', label: 'Sync' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Schedule" name="schedule">
            <Input placeholder="Cron expression or 'manual'" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DataPipelinePage;
