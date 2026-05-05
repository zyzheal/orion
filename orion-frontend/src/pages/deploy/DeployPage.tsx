/**
 * Deploy Page
 * Deployment list, deployment windows, progressive deployment, emergency deploy
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Table as AntTable,
  Descriptions,
  Drawer,
  Row,
  Col,
  Statistic,
  Steps,
  Timeline,
  Tooltip,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  RocketOutlined,
  PauseCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api/client';
import type { Deployment, HealthCheckResult } from '@/api/deployments';
import { getDeployments, cancelDeployment, rollbackDeployment } from '@/api/deployments';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ---- Color / label maps ----

const statusColorMap: Record<string, string> = {
  pending: 'default',
  deploying: 'blue',
  success: 'green',
  failed: 'red',
  rolled_back: 'gold',
  cancelled: 'default',
};

const statusLabelMap: Record<string, string> = {
  pending: '等待中',
  deploying: '部署中',
  success: '成功',
  failed: '失败',
  rolled_back: '已回滚',
  cancelled: '已取消',
};

const statusIconMap: Record<string, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  deploying: <SyncOutlined spin />,
  success: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  rolled_back: <PauseCircleOutlined />,
  cancelled: <StopOutlined />,
};

const strategyColorMap: Record<string, string> = {
  'blue-green': 'cyan',
  canary: 'orange',
  rolling: 'blue',
  recreate: 'purple',
};

const strategyLabelMap: Record<string, string> = {
  'blue-green': '蓝绿部署',
  canary: '金丝雀',
  rolling: '滚动部署',
  recreate: '重建部署',
};

const envColorMap: Record<string, string> = {
  dev: 'blue',
  staging: 'orange',
  prod: 'red',
};

const envLabelMap: Record<string, string> = {
  dev: '开发',
  staging: '预发',
  prod: '生产',
};

// ---- Stat Card ----

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, icon, color }) => (
  <Card size="small">
    <Statistic
      title={<Text type="secondary">{title}</Text>}
      value={value}
      prefix={icon}
      valueStyle={{ color }}
    />
  </Card>
);

// ---- Main Component ----

const DeployPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  // Create modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Emergency deploy modal
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [emergencyForm] = Form.useForm();
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getDeployments({ page: 1, pageSize: 100 });
      const raw = res.data?.data;
      setDeployments(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      setDeployments([]);
      message.error(`加载部署列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return deployments.filter((d) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !d.appName.toLowerCase().includes(q) &&
          !(d.version && d.version.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.environment && filters.environment !== 'all' && d.environment !== filters.environment) return false;
      if (filters.status && filters.status !== 'all' && d.status !== filters.status) return false;
      if (filters.strategy && filters.strategy !== 'all' && d.strategy !== filters.strategy) return false;
      return true;
    });
  }, [searchQuery, filters, deployments]);

  // Stats
  const stats = useMemo(() => {
    const total = deployments.length;
    const success = deployments.filter((d) => d.status === 'success').length;
    const deploying = deployments.filter((d) => d.status === 'deploying').length;
    const failed = deployments.filter((d) => d.status === 'failed').length;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';
    return { total, success, deploying, failed, successRate };
  }, [deployments]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload = {
        appName: values.appName,
        version: values.version,
        environment: values.environment,
        strategy: values.strategy,
        pipelineRunId: values.pipelineRunId,
        commit: values.commit,
      };
      await api.post('/v1/deploy', payload);
      message.success('部署任务创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmergencyDeploy = async () => {
    try {
      const values = await emergencyForm.validateFields();
      setEmergencyLoading(true);
      await api.post('/v1/deploy', {
        appName: values.appName,
        version: values.version,
        environment: 'prod',
        strategy: 'rolling',
        commit: values.commit,
        pipelineRunId: values.pipelineRunId,
        isEmergency: true,
        reason: values.reason,
      });
      message.success('紧急部署任务已提交');
      setEmergencyModalVisible(false);
      emergencyForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`紧急部署失败: ${(error as Error).message}`);
      }
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await api.post(`/v1/deploy/${id}/execute`);
      message.success('部署已启动');
      loadData();
    } catch (error: unknown) {
      message.error(`启动失败: ${(error as Error).message}`);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelDeployment(id);
      message.success('部署已取消');
      loadData();
    } catch (error: unknown) {
      message.error(`取消失败: ${(error as Error).message}`);
    }
  };

  const handleRollback = async (id: string) => {
    try {
      await rollbackDeployment(id);
      message.success('回滚已启动');
      loadData();
    } catch (error: unknown) {
      message.error(`回滚失败: ${(error as Error).message}`);
    }
  };

  const openDetail = (d: Deployment) => {
    setSelectedDeployment(d);
    setDetailDrawerVisible(true);
  };

  // ---- Table columns ----

  const columns: ColumnsType<Deployment> = [
    {
      title: '应用',
      dataIndex: 'appName',
      key: 'appName',
      width: 160,
      sorter: (a, b) => a.appName.localeCompare(b.appName),
      render: (v: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            {v}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>v{record.version}</Text>
        </Space>
      ),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 80,
      render: (v: string) => (
        <Tag color={envColorMap[v] || 'default'}>{envLabelMap[v] || v}</Tag>
      ),
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 120,
      render: (v: string) => (
        <Tag color={strategyColorMap[v] || 'default'}>
          {strategyLabelMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => (
        <Tag color={statusColorMap[v] || 'default'} icon={statusIconMap[v]}>
          {statusLabelMap[v] || v}
        </Tag>
      ),
    },
    {
      title: '触发人',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      width: 120,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: 'Commit',
      dataIndex: 'commit',
      key: 'commit',
      width: 100,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
          {v ? v.slice(0, 7) : '-'}
        </Text>
      ),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 100,
      render: (_, record) => {
        if (record.duration) {
          const mins = Math.floor(record.duration / 60);
          const secs = record.duration % 60;
          return <Text>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</Text>;
        }
        if (record.startTime && record.endTime) {
          const diff = dayjs(record.endTime).diff(dayjs(record.startTime), 'second');
          const mins = Math.floor(diff / 60);
          const secs = diff % 60;
          return <Text>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</Text>;
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="启动部署">
              <Button
                type="link"
                size="small"
                icon={<RocketOutlined />}
                onClick={() => handleExecute(record.id)}
              >
                启动
              </Button>
            </Tooltip>
          )}
          {record.status === 'deploying' && (
            <Tooltip title="取消部署">
              <Button
                type="link"
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => handleCancel(record.id)}
              >
                取消
              </Button>
            </Tooltip>
          )}
          {record.status === 'success' && (
            <Tooltip title="回滚">
              <Button
                type="link"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handleRollback(record.id)}
              >
                回滚
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            部署发布
          </Title>
          <Text type="secondary">管理部署任务、部署窗口、渐进式部署和紧急部署</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            danger
            onClick={() => {
              emergencyForm.resetFields();
              setEmergencyModalVisible(true);
            }}
          >
            紧急部署
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建部署
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={5}>
          <StatCard title="总部署数" value={stats.total} icon={<RocketOutlined />} />
        </Col>
        <Col span={5}>
          <StatCard title="部署中" value={stats.deploying} icon={<SyncOutlined spin />} color="#1890ff" />
        </Col>
        <Col span={5}>
          <StatCard title="成功" value={stats.success} icon={<CheckCircleOutlined />} color="#52c41a" />
        </Col>
        <Col span={5}>
          <StatCard title="失败" value={stats.failed} icon={<CloseCircleOutlined />} color="#ff4d4f" />
        </Col>
        <Col span={4}>
          <Statistic
            title={<Text type="secondary">成功率</Text>}
            value={stats.successRate}
            suffix="%"
            valueStyle={{ color: parseFloat(stats.successRate) >= 90 ? '#52c41a' : '#faad14' }}
          />
        </Col>
      </Row>

      {/* Deployment Windows */}
      <Card title={<><ClockCircleOutlined style={{ marginRight: 8 }} />部署窗口</>} style={{ marginBottom: 24 }}>
        <Alert
          message="部署窗口配置"
          description="生产环境仅允许在部署窗口内执行部署（工作日 10:00-16:00）。紧急部署可绕过窗口限制，但需要审批。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Row gutter={16}>
          <Col span={8}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="环境"><Tag color="blue">开发</Tag></Descriptions.Item>
              <Descriptions.Item label="窗口">无限制</Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={8}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="环境"><Tag color="orange">预发</Tag></Descriptions.Item>
              <Descriptions.Item label="窗口">工作日 09:00-18:00</Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={8}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="环境"><Tag color="red">生产</Tag></Descriptions.Item>
              <Descriptions.Item label="窗口">工作日 10:00-16:00</Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Deployment List */}
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
          <Input.Search
            placeholder="搜索应用、版本..."
            onSearch={setSearchQuery}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            placeholder="环境"
            style={{ width: 120 }}
            allowClear
            onChange={(v) => setFilters((prev) => ({ ...prev, environment: v || 'all' }))}
            options={[
              { label: '全部', value: 'all' },
              { label: '开发', value: 'dev' },
              { label: '预发', value: 'staging' },
              { label: '生产', value: 'prod' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            onChange={(v) => setFilters((prev) => ({ ...prev, status: v || 'all' }))}
            options={[
              { label: '全部', value: 'all' },
              { label: '等待中', value: 'pending' },
              { label: '部署中', value: 'deploying' },
              { label: '成功', value: 'success' },
              { label: '失败', value: 'failed' },
              { label: '已回滚', value: 'rolled_back' },
            ]}
          />
          <Select
            placeholder="策略"
            style={{ width: 140 }}
            allowClear
            onChange={(v) => setFilters((prev) => ({ ...prev, strategy: v || 'all' }))}
            options={[
              { label: '全部', value: 'all' },
              { label: '蓝绿部署', value: 'blue-green' },
              { label: '金丝雀', value: 'canary' },
              { label: '滚动部署', value: 'rolling' },
              { label: '重建部署', value: 'recreate' },
            ]}
          />
        </div>
        <AntTable<Deployment>
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true }}
        />
      </Card>

      {/* Create Deployment Modal */}
      <Modal
        title="创建部署任务"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="appName" label="应用名称" rules={[{ required: true, message: '请输入应用名称' }]}>
            <Input placeholder="如: orion-platform" />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="如: 1.2.3" />
          </Form.Item>
          <Form.Item name="environment" label="目标环境" rules={[{ required: true, message: '请选择环境' }]}>
            <Select options={[
              { label: '开发', value: 'dev' },
              { label: '预发', value: 'staging' },
              { label: '生产', value: 'prod' },
            ]} />
          </Form.Item>
          <Form.Item name="strategy" label="部署策略" rules={[{ required: true, message: '请选择策略' }]}>
            <Select options={[
              { label: '蓝绿部署', value: 'blue-green' },
              { label: '金丝雀', value: 'canary' },
              { label: '滚动部署', value: 'rolling' },
              { label: '重建部署', value: 'recreate' },
            ]} />
          </Form.Item>
          <Form.Item name="pipelineRunId" label="Pipeline Run ID">
            <Input placeholder="可选，关联的流水线运行 ID" />
          </Form.Item>
          <Form.Item name="commit" label="Commit SHA">
            <Input placeholder="可选，Git commit hash" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Emergency Deploy Modal */}
      <Modal
        title={<><ThunderboltOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />紧急部署</>}
        open={emergencyModalVisible}
        onCancel={() => setEmergencyModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Alert
          message="紧急部署将绕过部署窗口限制"
          description="此操作需要审批并记录审计日志，请确认紧急部署的必要性"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={emergencyForm} layout="vertical">
          <Form.Item name="appName" label="应用名称" rules={[{ required: true, message: '请输入应用名称' }]}>
            <Input placeholder="如: orion-platform" />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="如: 1.2.4-hotfix" />
          </Form.Item>
          <Form.Item name="pipelineRunId" label="Pipeline Run ID" rules={[{ required: true, message: '请输入 Pipeline Run ID' }]}>
            <Input placeholder="关联的流水线运行 ID" />
          </Form.Item>
          <Form.Item name="commit" label="Commit SHA">
            <Input placeholder="Git commit hash" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="紧急原因"
            rules={[{ required: true, message: '请说明紧急部署原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请详细说明紧急部署原因..." />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              danger
              block
              onClick={handleEmergencyDeploy}
              loading={emergencyLoading}
            >
              确认提交紧急部署
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedDeployment ? `${selectedDeployment.appName} v${selectedDeployment.version}` : '部署详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={800}
        destroyOnClose
      >
        {selectedDeployment && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="应用">{selectedDeployment.appName}</Descriptions.Item>
              <Descriptions.Item label="版本">v{selectedDeployment.version}</Descriptions.Item>
              <Descriptions.Item label="环境">
                <Tag color={envColorMap[selectedDeployment.environment]}>
                  {envLabelMap[selectedDeployment.environment] || selectedDeployment.environment}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="策略">
                <Tag color={strategyColorMap[selectedDeployment.strategy]}>
                  {strategyLabelMap[selectedDeployment.strategy] || selectedDeployment.strategy}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedDeployment.status]} icon={statusIconMap[selectedDeployment.status]}>
                  {statusLabelMap[selectedDeployment.status] || selectedDeployment.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发人">{selectedDeployment.triggeredBy || '-'}</Descriptions.Item>
              <Descriptions.Item label="Commit">
                {selectedDeployment.commit ? (
                  <Text copyable style={{ fontFamily: 'monospace' }}>
                    {selectedDeployment.commit}
                  </Text>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Pipeline Run">
                {selectedDeployment.pipelineRunId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {selectedDeployment.startTime ? dayjs(selectedDeployment.startTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {selectedDeployment.endTime ? dayjs(selectedDeployment.endTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Deployment Stages */}
            {selectedDeployment.stages && selectedDeployment.stages.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>部署阶段</Title>
                <Steps
                  direction="vertical"
                  current={
                    selectedDeployment.status === 'success'
                      ? selectedDeployment.stages.length
                      : selectedDeployment.stages.findIndex((s) => s.status === 'failed') >= 0
                        ? selectedDeployment.stages.findIndex((s) => s.status === 'failed')
                        : selectedDeployment.stages.findIndex((s) => s.status === 'running')
                  }
                  items={selectedDeployment.stages.map((stage) => ({
                    title: stage.name,
                    description: (
                      <div>
                        <Tag color={statusColorMap[stage.status] || 'default'}>
                          {statusLabelMap[stage.status] || stage.status}
                        </Tag>
                        {stage.duration && (
                          <Text type="secondary" style={{ marginLeft: 8 }}>
                            {stage.duration}s
                          </Text>
                        )}
                        {stage.details && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{stage.details}</Text>
                          </div>
                        )}
                      </div>
                    ),
                    status: stage.status === 'success' ? 'finish' : stage.status === 'failed' ? 'error' : 'process',
                  }))}
                />
              </div>
            )}

            {/* Health Checks */}
            {selectedDeployment.healthChecks && selectedDeployment.healthChecks.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>健康检查</Title>
                <Timeline>
                  {selectedDeployment.healthChecks.map((check: HealthCheckResult, idx: number) => (
                    <Timeline.Item
                      key={idx}
                      color={check.status === 'healthy' ? 'green' : check.status === 'unhealthy' ? 'red' : 'orange'}
                    >
                      <Text strong>{check.name}</Text>
                      <Tag color={check.status === 'healthy' ? 'green' : 'orange'} style={{ marginLeft: 8 }}>
                        {check.status}
                      </Tag>
                      {check.message && (
                        <div>
                          <Text type="secondary">{check.message}</Text>
                        </div>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default DeployPage;
