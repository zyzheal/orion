import { colors, spacing } from '@/tokens';

/**
 * Canary Traffic Page
 * Phase 3 - Gradual traffic shifting, canary analysis, and promotion/rollback decisions
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Progress,
} from 'antd';
import {
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  RocketOutlined,} from '@ant-design/icons';
import {
  getCanaryRuns,
  getCanaryConfigs,
  triggerCanaryAnalysis,
  forcePromote,
  forceRollback,
  type CanaryAnalysisRun,
  type CanaryAnalysisConfig,
} from '@/api/canary-analysis';

const { Title, Text } = Typography;

const CanaryTrafficPage: React.FC = () => {
  const [runs, setRuns] = useState<CanaryAnalysisRun[]>([]);
  const [configs, setConfigs] = useState<CanaryAnalysisConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [runRes, configRes] = await Promise.all([
        getCanaryRuns(),
        getCanaryConfigs(),
      ]);
      setRuns(((runRes.data as { data?: unknown[] })?.data ?? []) as CanaryAnalysisRun[]);
      setConfigs(((configRes.data as { data?: unknown[] })?.data ?? []) as CanaryAnalysisConfig[]);
    } catch {
      message.error('Failed to load canary data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await triggerCanaryAnalysis({
        deploymentId: values.deploymentId,
        roundNumber: values.roundNumber || 1,
      });
      message.success('Canary analysis triggered');
      setCreateModalOpen(false);
      loadData();
    } catch {
      message.error('Failed to trigger canary analysis');
    }
  };

  const handlePromote = async (runId: string) => {
    try {
      await forcePromote({ runId, reason: 'Manual promote' });
      message.success('Canary promoted');
      loadData();
    } catch {
      message.error('Failed to promote');
    }
  };

  const handleRollback = async (runId: string) => {
    try {
      await forceRollback({ runId, reason: 'Manual rollback' });
      message.success('Canary rolled back');
      loadData();
    } catch {
      message.error('Failed to rollback');
    }
  };

  const statusColor: Record<string, string> = {
    running: 'blue',
    promote: 'green',
    rollback: 'red',
    inconclusive: 'orange',
  };

  const runColumns = [
    { title: 'Deployment', dataIndex: 'deploymentId', key: 'deploymentId' },
    { title: 'Run #', dataIndex: 'runNumber', key: 'runNumber' },
    {
      title: 'Traffic Split',
      dataIndex: 'trafficSplit',
      key: 'trafficSplit',
      render: (v: { canary: number; baseline: number }) => (
        <Space>
          <Tag color="green">Canary: {v.canary}%</Tag>
          <Tag color="blue">Baseline: {v.baseline}%</Tag>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (v: number) => v != null ? <Progress percent={Math.round(v * 100)} size="small" /> : '-',
    },
    { title: 'Started', dataIndex: 'startedAt', key: 'startedAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: CanaryAnalysisRun) => (
        <Space>
          {record.status === 'running' && (
            <>
              <Button size="small" type="primary" icon={<ArrowUpOutlined />} onClick={() => handlePromote(record.id)}>
                Promote
              </Button>
              <Button size="small" danger icon={<ArrowDownOutlined />} onClick={() => handleRollback(record.id)}>
                Rollback
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const configColumns = [
    { title: 'Service', dataIndex: 'serviceName', key: 'serviceName' },
    { title: 'Environment', dataIndex: 'environment', key: 'environment' },
    { title: 'Interval (s)', dataIndex: 'analysisIntervalSec', key: 'analysisIntervalSec' },
    { title: 'Max Rounds', dataIndex: 'maxRounds', key: 'maxRounds' },
    { title: 'Promote Threshold', dataIndex: 'promoteThreshold', key: 'promoteThreshold', render: (v: number) => `${(v * 100).toFixed(0)}%` },
    { title: 'Updated', dataIndex: 'updatedAt', key: 'updatedAt' },
  ];

  const runningCount = runs.filter((r) => r.status === 'running').length;
  const avgConfidence = runs.length > 0
    ? runs.reduce((s, r) => s + (r.confidence || 0), 0) / runs.length
    : 0;

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <RocketOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            <ExperimentOutlined /> Canary Traffic
          </Title>
          <Text type="secondary">Gradual traffic shifting and canary analysis</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            New Canary
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card><Statistic title="Total Runs" value={runs.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Running" value={runningCount} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Avg Confidence" value={(avgConfidence * 100).toFixed(1)} suffix="%" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Configs" value={configs.length} /></Card>
        </Col>
      </Row>

      {/* Analysis Runs */}
      <Card title="Canary Analysis Runs" style={{ marginBottom: spacing.lg }}>
        <Table columns={runColumns} dataSource={runs} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      {/* Configs */}
      <Card title="Analysis Configurations">
        <Table columns={configColumns} dataSource={configs} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Trigger Canary Analysis"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Deployment ID" name="deploymentId" rules={[{ required: true }]}>
            <Input placeholder="Deployment ID" />
          </Form.Item>
          <Form.Item label="Round Number" name="roundNumber" initialValue={1}>
            <Input type="number" min={1} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CanaryTrafficPage;
