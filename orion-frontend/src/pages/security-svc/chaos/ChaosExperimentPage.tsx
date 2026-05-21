/**
 * Chaos Experiment Page
 * Phase 3 - Chaos experiment management with experiment list, create, run, and rollback
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
  Progress,
  message,
  Typography,
} from 'antd';
import {
  ThunderboltOutlined,
  SafetyOutlined,
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ExperimentOutlined,} from '@ant-design/icons';
import { chaosApi, resilienceApi, type ChaosExperiment } from '@/api/chaos';

const { Title, Text } = Typography;

const ChaosExperimentPage: React.FC = () => {
  const [experiments, setExperiments] = useState<ChaosExperiment[]>([]);
  const [score, setScore] = useState<{ score: number; mttr_ms: number; success_rate: number; trend: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expRes, scoreData] = await Promise.all([
        chaosApi.listExperiments(),
        resilienceApi.getScore(),
      ]);
      setExperiments(expRes.data || []);
      setScore(scoreData);
    } catch {
      message.error('Failed to load chaos experiment data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await chaosApi.createExperiment({
        name: values.name,
        scope: { tenant_id: 'default', environment: values.environment || 'staging' },
        faults: values.faults || [],
      });
      message.success('Experiment created');
      setCreateModalOpen(false);
      loadData();
    } catch {
      message.error('Failed to create experiment');
    }
  };

  const handleRun = async (id: string) => {
    try {
      await chaosApi.runExperiment(id);
      message.success('Experiment started');
      loadData();
    } catch {
      message.error('Failed to start experiment');
    }
  };

  const statusColor: Record<string, string> = {
    draft: 'default',
    active: 'green',
    completed: 'blue',
    archived: 'gold',
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Environment',
      dataIndex: ['scope', 'environment'],
      key: 'environment',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColor[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Faults',
      dataIndex: 'faults',
      key: 'faults',
      render: (faults: any[]) =>
        faults?.map((f, i) => <Tag key={i}>{f.type}</Tag>) || '-',
    },
    {
      title: 'Auto Rollback',
      dataIndex: 'auto_rollback',
      key: 'auto_rollback',
      render: (v: boolean) => (v ? <Tag color="green">Enabled</Tag> : <Tag>Disabled</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ChaosExperiment) => (
        <Space>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRun(record.id)}
            disabled={record.status === 'active'}
          >
            Run
          </Button>
          {record.status === 'active' && (
            <Button size="small" danger icon={<StopOutlined />}>
              Stop
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ExperimentOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <ThunderboltOutlined /> Chaos Experiments
          </Title>
          <Text type="secondary">Manage chaos experiments and resilience scoring</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Create Experiment
          </Button>
        </Space>
      </div>

      {/* Resilience Score Card */}
      <Card title={<><SafetyOutlined /> Resilience Score</>} style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={6}>
            <Statistic title="Score" value={score?.score ?? 0} suffix="/ 100" />
            <Progress
              percent={score?.score ?? 0}
              status={
                (score?.score ?? 0) >= 80
                  ? 'success'
                  : (score?.score ?? 0) >= 60
                    ? 'normal'
                    : 'exception'
              }
            />
          </Col>
          <Col span={6}>
            <Statistic title="MTTR" value={score?.mttr_ms ?? 0} suffix="ms" />
          </Col>
          <Col span={6}>
            <Statistic
              title="Success Rate"
              value={((score?.success_rate ?? 0) * 100).toFixed(1)}
              suffix="%"
            />
          </Col>
          <Col span={6}>
            <Statistic title="Trend" value={score?.trend ?? 'N/A'} />
          </Col>
        </Row>
      </Card>

      {/* Experiment List */}
      <Card title="Experiments">
        <Table
          columns={columns}
          dataSource={experiments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Chaos Experiment"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="Experiment name" />
          </Form.Item>
          <Form.Item label="Environment" name="environment" initialValue="staging">
            <Select
              options={[
                { value: 'staging', label: 'Staging' },
                { value: 'production', label: 'Production' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Experiment description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ChaosExperimentPage;
