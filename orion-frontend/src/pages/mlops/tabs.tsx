/**
 * MLOps Page - Inline Tab Components
 * Metrics overview, experiments, model registry and training jobs tabs.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  message,
} from 'antd';
import {
  BarChartOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  createExperiment,
  createTrainingJob,
  deleteExperiment,
  deployModel,
  getExperimentRuns,
  getMLOpsMetrics,
  listExperiments,
  listModels,
  listTrainingJobs,
  registerModel,
  updateExperiment,
  updateExperimentStatus,
  updateJobStatus,
  updateModelStatus,
  type MLExperiment,
  type MLExperimentRun,
  type MLModel,
  type MLOpsMetrics,
  type TrainingJob,
} from '@/api/mlops';
import { colors, spacing } from '@/tokens';
import {
  DATASET_RULES,
  EXPERIMENT_NAME_RULES,
  EXPERIMENT_STATUS_OPTIONS,
  filterRowStyle,
  headerRowStyle,
  MODEL_NAME_RULES,
  MODEL_STATUS_OPTIONS,
  MODEL_TYPE_OPTIONS,
  sectionTitleStyle,
} from './config';
import {
  buildExperimentColumns,
  buildModelColumns,
  buildRunsColumns,
  buildTrainingJobColumns,
  type ExperimentColumnsDeps,
  type ModelColumnsDeps,
  type TrainingJobColumnsDeps,
} from './columns';
import { ExperimentsModals, ModelRegistryModals, TrainingJobsModals } from './MLOpsModals';

const { Title, Text } = Typography;

// ============================================================================
// Metrics Dashboard (Overview Tab)
// ============================================================================

export const MetricsTab: React.FC = () => {
  const [metrics, setMetrics] = useState<MLOpsMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getMLOpsMetrics();
      setMetrics((res.data as { data?: MLOpsMetrics })?.data ?? null);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载 MLOps 指标失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!metrics) {
    return <Empty description="暂无 MLOps 指标数据" />;
  }

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <Title level={3} style={sectionTitleStyle}>
            <BarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            MLOps 概览
          </Title>
          <Text type="secondary">实验、模型和训练任务的汇总指标</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic title="总实验数" value={metrics.totalExperiments} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中实验"
              value={metrics.runningExperiments}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总模型数" value={metrics.totalModels} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="生产中模型"
              value={metrics.productionModels}
              valueStyle={{ color: colors.success[500] }}
            />
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
            <Statistic
              title="运行中任务"
              value={metrics.runningJobs}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败实验"
              value={metrics.failedExperiments}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败任务"
              value={metrics.failedJobs}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ============================================================================
// Experiments Tab
// ============================================================================

export const ExperimentsTab: React.FC = () => {
  const [experiments, setExperiments] = useState<MLExperiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [runsDrawerOpen, setRunsDrawerOpen] = useState(false);
  const [currentRuns, setCurrentRuns] = useState<MLExperimentRun[]>([]);
  const [currentRunsLoading, setCurrentRunsLoading] = useState(false);
  const [_currentExperimentId, setCurrentExperimentId] = useState<string>('');
  const [currentExperiment, setCurrentExperiment] = useState<MLExperiment | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [experimentSearchQuery, setExperimentSearchQuery] = useState('');
  const [experimentStatusFilter, setExperimentStatusFilter] = useState<string | undefined>();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listExperiments();
      setExperiments((res.data as { data?: MLExperiment[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载实验失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: any) => {
    setCreating(true);
    try {
      await createExperiment({
        name: values.name,
        project: values.project,
        modelType: values.modelType,
        description: values.description,
      });
      message.success('实验创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (record: MLExperiment) => {
    setCurrentExperiment(record);
    editForm.setFieldsValue({
      name: record.name,
      project: record.project,
      modelType: record.modelType,
      description: record.description,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (values: any) => {
    if (!currentExperiment) return;
    setEditing(true);
    try {
      await updateExperiment(currentExperiment.id, {
        name: values.name,
        project: values.project,
        modelType: values.modelType,
        description: values.description,
      });
      message.success('实验更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setEditing(false);
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
    } finally {
      setCurrentRunsLoading(false);
    }
  };

  const columns = useMemo<ExperimentColumnsDeps>(
    () => ({
      handleViewRuns,
      handleEdit,
      handleStatusChange,
      handleDelete,
    }),
    [],
  );

  const runsColumns = useMemo(() => buildRunsColumns(), []);

  // Filtered experiments
  const filteredExperiments = useMemo(() => {
    let result = experiments;
    if (experimentSearchQuery) {
      const q = experimentSearchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.project || '').toLowerCase().includes(q) ||
          (e.modelType || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q),
      );
    }
    if (experimentStatusFilter) {
      result = result.filter((e) => e.status === experimentStatusFilter);
    }
    return result;
  }, [experiments, experimentSearchQuery, experimentStatusFilter]);

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <Title level={3} style={sectionTitleStyle}>
            <ExperimentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            实验管理
          </Title>
          <Text type="secondary">跟踪和管理 ML 实验</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建实验
          </Button>
        </Space>
      </div>

      <div style={filterRowStyle}>
        <Input
          placeholder="搜索实验名称、项目、模型类型..."
          prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
          value={experimentSearchQuery}
          onChange={(e) => setExperimentSearchQuery(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
        <Select
          placeholder="状态筛选"
          value={experimentStatusFilter}
          onChange={setExperimentStatusFilter}
          allowClear
          style={{ width: 120 }}
          options={EXPERIMENT_STATUS_OPTIONS}
        />
      </div>

      {filteredExperiments.length === 0 && !loading ? (
        <Empty description="暂无实验数据">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建第一个实验
          </Button>
        </Empty>
      ) : (
        <Table
          columns={buildExperimentColumns(columns)}
          dataSource={filteredExperiments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: filteredExperiments.length === 0 ? '暂无实验数据' : undefined }}
        />
      )}

      <ExperimentsModals
        createModalOpen={createModalOpen}
        setCreateModalOpen={setCreateModalOpen}
        creating={creating}
        createForm={createForm}
        handleCreate={handleCreate}
        editModalOpen={editModalOpen}
        setEditModalOpen={setEditModalOpen}
        editing={editing}
        editForm={editForm}
        handleSaveEdit={handleSaveEdit}
        runsDrawerOpen={runsDrawerOpen}
        setRunsDrawerOpen={setRunsDrawerOpen}
        currentRuns={currentRuns}
        currentRunsLoading={currentRunsLoading}
        runsColumns={runsColumns}
        handleViewRuns={handleViewRuns}
        handleEdit={handleEdit}
        handleStatusChange={handleStatusChange}
        handleDelete={handleDelete}
      />
    </div>
  );
};

// ============================================================================
// Model Registry Tab
// ============================================================================

export const ModelRegistryTab: React.FC = () => {
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerForm] = Form.useForm();
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelStatusFilter, setModelStatusFilter] = useState<string | undefined>();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listModels();
      setModels((res.data as { data?: MLModel[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载模型失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegister = async (values: any) => {
    setRegistering(true);
    try {
      await registerModel({
        name: values.name,
        artifactPath: values.artifactPath,
        experimentId: values.experimentId,
        description: values.description,
      });
      message.success('模型注册成功');
      setRegisterModalOpen(false);
      registerForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注册失败');
    } finally {
      setRegistering(false);
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

  const columns = useMemo<ModelColumnsDeps>(
    () => ({ handleDeploy, handleStatusChange }),
    [],
  );

  // Filtered models
  const filteredModels = useMemo(() => {
    let result = models;
    if (modelSearchQuery) {
      const q = modelSearchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.artifactPath || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q),
      );
    }
    if (modelStatusFilter) {
      result = result.filter((m) => m.status === modelStatusFilter);
    }
    return result;
  }, [models, modelSearchQuery, modelStatusFilter]);

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <Title level={3} style={sectionTitleStyle}>
            <CloudUploadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            模型注册
          </Title>
          <Text type="secondary">管理 ML 模型版本和生命周期</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterModalOpen(true)}>
            注册模型
          </Button>
        </Space>
      </div>

      <div style={filterRowStyle}>
        <Input
          placeholder="搜索模型名称、Artifact..."
          prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
          value={modelSearchQuery}
          onChange={(e) => setModelSearchQuery(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
        <Select
          placeholder="状态筛选"
          value={modelStatusFilter}
          onChange={setModelStatusFilter}
          allowClear
          style={{ width: 120 }}
          options={MODEL_STATUS_OPTIONS}
        />
      </div>

      {filteredModels.length === 0 && !loading ? (
        <Empty description="暂无模型数据">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterModalOpen(true)}>
            注册第一个模型
          </Button>
        </Empty>
      ) : (
        <Table
          columns={buildModelColumns(columns)}
          dataSource={filteredModels}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      )}

      <ModelRegistryModals
        registerModalOpen={registerModalOpen}
        setRegisterModalOpen={setRegisterModalOpen}
        registering={registering}
        registerForm={registerForm}
        handleRegister={handleRegister}
      />
    </div>
  );
};

// ============================================================================
// Training Jobs Tab
// ============================================================================

export const TrainingJobsTab: React.FC = () => {
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listTrainingJobs();
      setJobs((res.data as { data?: TrainingJob[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载训练任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: any) => {
    setCreating(true);
    try {
      await createTrainingJob({
        dataset: values.dataset,
        experimentId: values.experimentId,
      });
      message.success('训练任务创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreating(false);
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

  const columns = useMemo<TrainingJobColumnsDeps>(
    () => ({ handleStatusChange }),
    [],
  );

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <Title level={3} style={sectionTitleStyle}>
            <SyncOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            训练任务
          </Title>
          <Text type="secondary">管理 ML 模型训练任务</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建任务
          </Button>
        </Space>
      </div>

      {jobs.length === 0 && !loading ? (
        <Empty description="暂无训练任务">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建第一个训练任务
          </Button>
        </Empty>
      ) : (
        <Table
          columns={buildTrainingJobColumns(columns)}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      )}

      <TrainingJobsModals
        createModalOpen={createModalOpen}
        setCreateModalOpen={setCreateModalOpen}
        creating={creating}
        createForm={createForm}
        handleCreate={handleCreate}
      />
    </div>
  );
};

// ============================================================================
// Tab registry (consumed by MLOpsPage)
// ============================================================================

export const TAB_ITEMS = [
  { key: 'overview', label: '概览', children: <MetricsTab /> },
  { key: 'experiments', label: '实验管理', children: <ExperimentsTab /> },
  { key: 'models', label: '模型注册', children: <ModelRegistryTab /> },
  { key: 'jobs', label: '训练任务', children: <TrainingJobsTab /> },
];
