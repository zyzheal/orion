/**
 * MLOps Page (Phase 4 Batch 2)
 * Experiment tracking, model registry, training job management
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Table, Button, Tag, Space, Tabs, message,
  Modal, Form, Input, Select,
} from 'antd';
import {
  ExperimentOutlined,
  CloudUploadOutlined,
  SyncOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  listExperiments, createExperiment, updateExperimentStatus,
  listModels, registerModel, updateModelStatus,
  listTrainingJobs, createTrainingJob, updateJobStatus,
  type MLExperiment, type MLModel, type TrainingJob,
} from '@/api/mlops';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// ============================================================================
// Experiments Tab
// ============================================================================

const ExperimentsTab: React.FC = () => {
  const [experiments, setExperiments] = useState<MLExperiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listExperiments();
      setExperiments((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载实验失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createExperiment({ name: values.name, project: values.project, modelType: values.modelType });
      message.success('实验创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
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

  const statusColorMap: Record<string, string> = {
    draft: colors.neutral[400],
    running: colors.primary[500],
    completed: colors.success[500],
    failed: colors.error[500],
  };

  const columns = [
    { title: '实验名称', dataIndex: 'name', key: 'name' },
    { title: '项目', dataIndex: 'project', key: 'project', render: (v: string) => v || '-' },
    { title: '模型类型', dataIndex: 'modelType', key: 'modelType', render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: MLExperiment) => (
        <Space>
          {record.status === 'draft' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'running')}>运行</Button>}
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
      <Table columns={columns} dataSource={experiments} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="创建实验" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input placeholder="实验名称" /></Form.Item>
          <Form.Item label="项目" name="project"><Input placeholder="所属项目" /></Form.Item>
          <Form.Item label="模型类型" name="modelType">
            <Select placeholder="选择模型类型">
              <Select.Option value="llm">LLM</Select.Option>
              <Select.Option value="classification">Classification</Select.Option>
              <Select.Option value="regression">Regression</Select.Option>
              <Select.Option value="clustering">Clustering</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
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
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listModels();
      setModels((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载模型失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleRegister = async (values: any) => {
    try {
      await registerModel({ name: values.name, artifactPath: values.artifactPath });
      message.success('模型注册成功');
      setRegisterModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注册失败');
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

  const statusColorMap: Record<string, string> = {
    draft: colors.neutral[400],
    staging: colors.warning[500],
    production: colors.success[500],
    archived: colors.neutral[300],
  };

  const columns = [
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version', render: (v: number) => `v${v}` },
    { title: 'Artifact', dataIndex: 'artifactPath', key: 'artifactPath', render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: MLModel) => (
        <Space>
          {record.status === 'draft' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'staging')}>发布</Button>}
          {record.status === 'staging' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'production')}>上线</Button>}
          {record.status === 'production' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'archived')}>归档</Button>}
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
      <Table columns={columns} dataSource={models} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="注册模型" open={registerModalOpen} onCancel={() => setRegisterModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleRegister}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input placeholder="模型名称" /></Form.Item>
          <Form.Item label="Artifact 路径" name="artifactPath"><Input placeholder="模型存储路径" /></Form.Item>
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
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listTrainingJobs();
      setJobs((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载训练任务失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createTrainingJob({ dataset: values.dataset, experimentId: values.experimentId });
      message.success('训练任务创建成功');
      setCreateModalOpen(false);
      form.resetFields();
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

  const statusColorMap: Record<string, string> = {
    pending: colors.neutral[400],
    running: colors.primary[500],
    completed: colors.success[500],
    failed: colors.error[500],
  };

  const columns = [
    { title: '数据集', dataIndex: 'dataset', key: 'dataset', render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: TrainingJob) => (
        <Space>
          {record.status === 'pending' && <Button size="small" type="link" onClick={() => handleStatusChange(record.id, 'running')}>启动</Button>}
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
      <Table columns={columns} dataSource={jobs} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="创建训练任务" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="数据集" name="dataset" rules={[{ required: true }]}><Input placeholder="数据集名称或路径" /></Form.Item>
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
    { key: 'experiments', label: '实验管理', children: <ExperimentsTab /> },
    { key: 'models', label: '模型注册', children: <ModelRegistryTab /> },
    { key: 'jobs', label: '训练任务', children: <TrainingJobsTab /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs defaultActiveKey="experiments" items={tabItems} size="large" />
    </div>
  );
};

export default MLOpsPage;
