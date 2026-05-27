/**
 * MLOps Page (Phase 4 P0)
 * Experiment tracking, model registry, training job management
 *
 * Implements full CRUD with:
 * - Experiments: Create, Read, Update, Delete, Status Management, Runs
 * - Models: Register, Read, Deploy, Status Management
 * - Training Jobs: Create, Read, Status Management
 * - Metrics dashboard
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Table, Button, Tag, Space, Tabs, message,
  Modal, Form, Input, Select, Popconfirm, Statistic, Row, Col, Card,
  Descriptions, Empty, Drawer,
} from 'antd';
import {
  ExperimentOutlined,
  CloudUploadOutlined,
  SyncOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  BarChartOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import {
  listExperiments, createExperiment, updateExperiment, deleteExperiment,
  updateExperimentStatus, getExperimentRuns,
  listModels, registerModel, deployModel, updateModelStatus,
  listTrainingJobs, createTrainingJob, updateJobStatus,
  getMLOpsMetrics,
  type MLExperiment, type MLModel, type TrainingJob, type MLOpsMetrics, type MLExperimentRun,
} from '@/api/mlops';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// ============================================================================
// Status color maps
// ============================================================================

const experimentStatusColor: Record<string, string> = {
  draft: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
};

const modelStatusColor: Record<string, string> = {
  draft: colors.neutral[400],
  staging: colors.warning[500],
  production: colors.success[500],
  archived: colors.neutral[300],
};

const jobStatusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
};

// ============================================================================
// Metrics Dashboard (Overview Tab)
// ============================================================================

const MetricsTab: React.FC = () => {
  const [metrics, setMetrics] = useState<MLOpsMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getMLOpsMetrics();
      setMetrics((res.data as { data?: MLOpsMetrics })?.data ?? null);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载 MLOps 指标失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  if (!metrics) {
    return (
      <Empty description="暂无 MLOps 指标数据" />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            MLOps 概览
          </Title>
          <Text type="secondary">实验、模型和训练任务的汇总指标</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总实验数" value={metrics.totalExperiments} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行中实验" value={metrics.runningExperiments} valueStyle={{ color: colors.primary[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总模型数" value={metrics.totalModels} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="生产中模型" value={metrics.productionModels} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="训练任务总数" value={metrics.totalJobs} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行中任务" value={metrics.runningJobs} valueStyle={{ color: colors.primary[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="失败实验" value={metrics.failedExperiments} valueStyle={{ color: colors.error[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="失败任务" value={metrics.failedJobs} valueStyle={{ color: colors.error[500] }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ============================================================================
// Experiments Tab
// ============================================================================

const ExperimentsTab: React.FC = () => {
  const [experiments, setExperiments] = useState<MLExperiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [runsDrawerOpen, setRunsDrawerOpen] = useState(false);
  const [currentRuns, setCurrentRuns] = useState<MLExperimentRun[]>([]);
  const [currentRunsLoading, setCurrentRunsLoading] = useState(false);
  const [currentExperimentId, setCurrentExperimentId] = useState<string>('');
  const [currentExperiment, setCurrentExperiment] = useState<MLExperiment | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listExperiments();
      setExperiments((res.data as { data?: MLExperiment[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载实验失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createExperiment({
        name: values.name, project: values.project,
        modelType: values.modelType, description: values.description,
      });
      message.success('实验创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleEdit = async (record: MLExperiment) => {
    setCurrentExperiment(record);
    editForm.setFieldsValue({
      name: record.name, project: record.project,
      modelType: record.modelType, description: record.description,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (values: any) => {
    if (!currentExperiment) return;
    try {
      await updateExperiment(currentExperiment.id, {
        name: values.name, project: values.project,
        modelType: values.modelType, description: values.description,
      });
      message.success('实验更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExperiment(id);
      message.success('实验已删除');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleStatusChange = async (id: string, status: MLExperiment['status']) => {
    try {
      await updateExperimentStatus(id, status);
      message.success(`实验状态已更新为 ${status}`);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const handleViewRuns = async (id: string) => {
    setCurrentExperimentId(id);
    setRunsDrawerOpen(true);
    setCurrentRunsLoading(true);
    try {
      const res = await getExperimentRuns(id);
      setCurrentRuns((res.data as { data?: MLExperimentRun[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载运行记录失败');
    } finally { setCurrentRunsLoading(false); }
  };

  const columns = [
    { title: '实验名称', dataIndex: 'name', key: 'name' },
    { title: '项目', dataIndex: 'project', key: 'project', render: (v: string) => v || '-' },
    { title: '模型类型', dataIndex: 'modelType', key: 'modelType', render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={experimentStatusColor[s]}>{s}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: MLExperiment) => (
        <Space>
          <Button size="small" type="link" icon={<FileSearchOutlined />} onClick={() => handleViewRuns(record.id)}>运行记录</Button>
          <Button size="small" type="link" onClick={() => handleEdit(record)}>编辑</Button>
          {record.status === 'draft' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'running')}>运行</Button>}
          {record.status === 'running' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'completed')}>完成</Button>}
          {record.status === 'running' && <Button size="small" type="link" danger onClick={() => handleStatusChange(record.id, 'failed')}>终止</Button>}
          <Popconfirm title="确定要删除此实验吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const runsColumns = [
    { title: '迭代', dataIndex: 'iteration', key: 'iteration' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={jobStatusColor[s]}>{s}</Tag>,
    },
    { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', render: (v: string) => new Date(v).toLocaleString() },
    { title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <ExperimentOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            实验管理
          </Title>
          <Text type="secondary">跟踪和管理 ML 实验</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>创建实验</Button>
        </Space>
      </div>

      {experiments.length === 0 && !loading ? (
        <Empty description="暂无实验数据">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建第一个实验
          </Button>
        </Empty>
      ) : (
        <Table columns={columns} dataSource={experiments} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      )}

      {/* Create Modal */}
      <Modal title="创建实验" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => createForm.submit()}>
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入实验名称' }]}><Input placeholder="实验名称" /></Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} placeholder="实验描述" /></Form.Item>
          <Form.Item label="项目" name="project"><Input placeholder="所属项目" /></Form.Item>
          <Form.Item label="模型类型" name="modelType">
            <Select placeholder="选择模型类型">
              <Select.Option value="llm">LLM</Select.Option>
              <Select.Option value="classification">Classification</Select.Option>
              <Select.Option value="regression">Regression</Select.Option>
              <Select.Option value="clustering">Clustering</Select.Option>
              <Select.Option value="neural-network">Neural Network</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal title="编辑实验" open={editModalOpen} onCancel={() => setEditModalOpen(false)} onOk={() => editForm.submit()}>
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入实验名称' }]}><Input placeholder="实验名称" /></Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} placeholder="实验描述" /></Form.Item>
          <Form.Item label="项目" name="project"><Input placeholder="所属项目" /></Form.Item>
          <Form.Item label="模型类型" name="modelType">
            <Select placeholder="选择模型类型">
              <Select.Option value="llm">LLM</Select.Option>
              <Select.Option value="classification">Classification</Select.Option>
              <Select.Option value="regression">Regression</Select.Option>
              <Select.Option value="clustering">Clustering</Select.Option>
              <Select.Option value="neural-network">Neural Network</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Runs Drawer */}
      <Drawer
        title="实验运行记录"
        placement="right"
        width={600}
        open={runsDrawerOpen}
        onClose={() => setRunsDrawerOpen(false)}
      >
        <Table
          columns={runsColumns}
          dataSource={currentRuns}
          rowKey="id"
          loading={currentRunsLoading}
          pagination={false}
          locale={{ emptyText: '暂无运行记录' }}
        />
      </Drawer>
    </div>
  );
};

// ============================================================================
// Model Registry Tab
// ============================================================================

const ModelRegistryTab: React.FC = () => {
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listModels();
      setModels((res.data as { data?: MLModel[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载模型失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleRegister = async (values: any) => {
    try {
      await registerModel({
        name: values.name, artifactPath: values.artifactPath,
        experimentId: values.experimentId, description: values.description,
      });
      message.success('模型注册成功');
      setRegisterModalOpen(false);
      registerForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注册失败');
    }
  };

  const handleDeploy = async (id: string) => {
    try {
      await deployModel(id);
      message.success('模型部署成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '部署失败');
    }
  };

  const handleStatusChange = async (id: string, status: MLModel['status']) => {
    try {
      await updateModelStatus(id, status);
      message.success(`模型状态已更新为 ${status}`);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const columns = [
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version', render: (v: number) => `v${v}` },
    { title: 'Artifact', dataIndex: 'artifactPath', key: 'artifactPath', render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={modelStatusColor[s]}>{s}</Tag>,
    },
    { title: '部署端点', dataIndex: 'deployedEndpoint', key: 'deployedEndpoint', render: (v: string) => v || '-' },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: MLModel) => (
        <Space>
          {record.status === 'draft' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'staging')}>发布</Button>}
          {record.status === 'staging' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'production')}>上线</Button>}
          {record.status === 'production' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'archived')}>归档</Button>}
          {record.status !== 'production' && (
            <Button size="small" type="link" icon={<RocketOutlined />} onClick={() => handleDeploy(record.id)}>部署</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <CloudUploadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            模型注册
          </Title>
          <Text type="secondary">管理 ML 模型版本和生命周期</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterModalOpen(true)}>注册模型</Button>
        </Space>
      </div>

      {models.length === 0 && !loading ? (
        <Empty description="暂无模型数据">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterModalOpen(true)}>
            注册第一个模型
          </Button>
        </Empty>
      ) : (
        <Table columns={columns} dataSource={models} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      )}

      <Modal title="注册模型" open={registerModalOpen} onCancel={() => setRegisterModalOpen(false)} onOk={() => registerForm.submit()}>
        <Form form={registerForm} layout="vertical" onFinish={handleRegister}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入模型名称' }]}><Input placeholder="模型名称" /></Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} placeholder="模型描述" /></Form.Item>
          <Form.Item label="Artifact 的路径" name="artifactPath"><Input placeholder="模型存储路径" /></Form.Item>
          <Form.Item label="实验 ID" name="experimentId"><Input placeholder="关联的实验 ID" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Training Jobs Tab
// ============================================================================

const TrainingJobsTab: React.FC = () => {
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listTrainingJobs();
      setJobs((res.data as { data?: TrainingJob[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载训练任务失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createTrainingJob({
        dataset: values.dataset, experimentId: values.experimentId,
      });
      message.success('训练任务创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleStatusChange = async (id: string, status: TrainingJob['status']) => {
    try {
      await updateJobStatus(id, status);
      message.success(`任务状态已更新为 ${status}`);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const columns = [
    { title: '数据集', dataIndex: 'dataset', key: 'dataset', render: (v: string) => v || '-' },
    { title: '实验 ID', dataIndex: 'experimentId', key: 'experimentId', render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => (
        <Tag color={jobStatusColor[s]}>{s}</Tag>
      ),
    },
    { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: TrainingJob) => (
        <Space>
          {record.status === 'pending' && (
            <Button size="small" type="link" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange(record.id, 'running')}>启动</Button>
          )}
          {record.status === 'running' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'completed')}>完成</Button>}
          {record.status === 'running' && <Button size="small" type="link" danger onClick={() => handleStatusChange(record.id, 'failed')}>终止</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <SyncOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            训练任务
          </Title>
          <Text type="secondary">管理 ML 模型训练任务</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>创建任务</Button>
        </Space>
      </div>

      {jobs.length === 0 && !loading ? (
        <Empty description="暂无训练任务">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建第一个训练任务
          </Button>
        </Empty>
      ) : (
        <Table columns={columns} dataSource={jobs} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      )}

      <Modal title="创建训练任务" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => createForm.submit()}>
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="数据集" name="dataset" rules={[{ required: true, message: '请输入数据集名称' }]}><Input placeholder="数据集名称或路径" /></Form.Item>
          <Form.Item label="实验 ID" name="experimentId"><Input placeholder="关联的实验 ID" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const MLOpsPage: React.FC = () => {
  const tabItems = [
    { key: 'overview', label: '概览', children: <MetricsTab /> },
    { key: 'experiments', label: '实验管理', children: <ExperimentsTab /> },
    { key: 'models', label: '模型注册', children: <ModelRegistryTab /> },
    { key: 'jobs', label: '训练任务', children: <TrainingJobsTab /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 16, color: colors.neutral[900] }}>
        <ExperimentOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        MLOps 平台
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        管理 ML 模型的全生命周期：实验跟踪、模型注册、训练调度和模型部署
      </Text>
      <Tabs defaultActiveKey="overview" items={tabItems} size="large" />
    </div>
  );
};

export default MLOpsPage;
