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
  RocketOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  getCanaryRuns,
  getCanaryConfigs,
  triggerCanaryAnalysis,
  forcePromote,
  forceRollback,
  updateCanaryConfig,
  deleteCanaryConfig,
  type CanaryAnalysisRun,
  type CanaryAnalysisConfig,
} from '@/api/canary-analysis';

const { Title, Text } = Typography;

const CanaryTrafficPage: React.FC = () => {
  const [runs, setRuns] = useState<CanaryAnalysisRun[]>([]);
  const [configs, setConfigs] = useState<CanaryAnalysisConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editConfigModalOpen, setEditConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CanaryAnalysisConfig | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [runRes, configRes] = await Promise.all([getCanaryRuns(), getCanaryConfigs()]);
      setRuns(
        ((runRes.data as { data?: { data?: unknown[] } })?.data?.data ?? []) as CanaryAnalysisRun[]
      );
      setConfigs(
        ((configRes.data as { data?: { data?: unknown[] } })?.data?.data ??
          []) as CanaryAnalysisConfig[]
      );
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
    Modal.confirm({
      title: '确认提升金丝雀发布？',
      content: '将提升当前金丝雀分析到生产环境，此操作将影响线上流量。',
      okText: '确认提升',
      cancelText: '取消',
      okButtonProps: { type: 'primary' },
      onOk: async () => {
        try {
          await forcePromote({ runId, reason: 'Manual promote' });
          message.success('金丝雀发布已提升');
          loadData();
        } catch {
          message.error('提升失败');
        }
      },
    });
  };

  const handleRollback = async (runId: string) => {
    Modal.confirm({
      title: '确认回滚金丝雀发布？',
      content: '将回滚当前金丝雀分析到稳定版本，流量将恢复到基线。',
      okText: '确认回滚',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await forceRollback({ runId, reason: 'Manual rollback' });
          message.success('金丝雀发布已回滚');
          loadData();
        } catch {
          message.error('回滚失败');
        }
      },
    });
  };

  const handleEditConfig = (config: CanaryAnalysisConfig) => {
    setEditingConfig(config);
    editForm.setFieldsValue({
      serviceName: config.serviceName,
      environment: config.environment,
      analysisIntervalSec: config.analysisIntervalSec,
      maxRounds: config.maxRounds,
      promoteThreshold: config.promoteThreshold,
    });
    setEditConfigModalOpen(true);
  };

  const handleEditConfigSubmit = async (values: any) => {
    if (!editingConfig) return;
    try {
      await updateCanaryConfig(editingConfig.id, {
        serviceName: values.serviceName,
        environment: values.environment,
        analysisIntervalSec: values.analysisIntervalSec,
        maxRounds: values.maxRounds,
        promoteThreshold: values.promoteThreshold,
      });
      message.success('配置已更新');
      setEditConfigModalOpen(false);
      setEditingConfig(null);
      loadData();
    } catch {
      message.error('更新失败');
    }
  };

  const handleDeleteConfig = (config: CanaryAnalysisConfig) => {
    Modal.confirm({
      title: '确认删除分析配置？',
      content: `确定要删除服务 "${config.serviceName}" 的分析配置吗？此操作不可撤销。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCanaryConfig(config.id);
          message.success('配置已删除');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
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
      render: (v: number) =>
        v != null ? <Progress percent={Math.round(v * 100)} size="small" /> : '-',
    },
    { title: 'Started', dataIndex: 'startedAt', key: 'startedAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: CanaryAnalysisRun) => (
        <Space>
          {record.status === 'running' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<ArrowUpOutlined />}
                onClick={() => handlePromote(record.id)}
              >
                提升
              </Button>
              <Button
                size="small"
                danger
                icon={<ArrowDownOutlined />}
                onClick={() => handleRollback(record.id)}
              >
                回滚
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
    {
      title: 'Promote Threshold',
      dataIndex: 'promoteThreshold',
      key: 'promoteThreshold',
      render: (v: number) => `${(v * 100).toFixed(0)}%`,
    },
    { title: 'Updated', dataIndex: 'updatedAt', key: 'updatedAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: CanaryAnalysisConfig) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditConfig(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteConfig(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const runningCount = runs.filter((r) => r.status === 'running').length;
  const avgConfidence =
    runs.length > 0 ? runs.reduce((s, r) => s + (r.confidence || 0), 0) / runs.length : 0;

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
          <Card>
            <Statistic title="Total Runs" value={runs.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Running" value={runningCount} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Avg Confidence" value={(avgConfidence * 100).toFixed(1)} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Configs" value={configs.length} />
          </Card>
        </Col>
      </Row>

      {/* Analysis Runs */}
      <Card title="Canary Analysis Runs" style={{ marginBottom: spacing.lg }}>
        <Table
          columns={runColumns}
          dataSource={runs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Configs */}
      <Card title="Analysis Configurations">
        <Table
          columns={configColumns}
          dataSource={configs}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
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

      {/* Edit Config Modal */}
      <Modal
        title="编辑分析配置"
        open={editConfigModalOpen}
        onCancel={() => {
          setEditConfigModalOpen(false);
          setEditingConfig(null);
        }}
        onOk={() => editForm.submit()}
        width={500}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditConfigSubmit}>
          <Form.Item label="服务名" name="serviceName" rules={[{ required: true }]}>
            <Input placeholder="服务名" />
          </Form.Item>
          <Form.Item label="环境" name="environment" rules={[{ required: true }]}>
            <Input placeholder="环境" />
          </Form.Item>
          <Form.Item label="分析间隔（秒）" name="analysisIntervalSec" rules={[{ required: true }]}>
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item label="最大轮数" name="maxRounds" rules={[{ required: true }]}>
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item label="提升阈值" name="promoteThreshold" rules={[{ required: true }]}>
            <Input type="number" min={0} max={1} step={0.01} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CanaryTrafficPage;
