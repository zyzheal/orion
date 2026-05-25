/**
 * IaC (Infrastructure as Code) Management Page (Phase 4 - Multi-Cloud)
 * Workspace management, plan/apply, resource state, module registry
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Table, Button, Tag, Space, Tabs, message,
  Modal, Form, Input, Select, Popconfirm, Descriptions, Card,
} from 'antd';
import {
  CloudOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import {
  getWorkspaces, createWorkspace, updateWorkspace,
  planWorkspace, applyWorkspace,
  getWorkspacePlans, getWorkspaceResources,
  getModules, createModule,
  type IaCWorkspace, type IaCPlan, type IaCResourceChange, type IaCModule,
} from '@/api/iac';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// ============================================================================
// Workspace Tab
// ============================================================================

const WorkspaceTab: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<IaCWorkspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [planningIds, setPlanningIds] = useState<Set<string>>(new Set());
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getWorkspaces();
      setWorkspaces((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载工作区失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createWorkspace({
        name: values.name,
        projectId: values.projectId,
        environment: values.environment,
        provider: values.provider,
      });
      message.success('工作区创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handlePlan = async (id: string) => {
    setPlanningIds((prev) => new Set(prev).add(id));
    try {
      await planWorkspace(id);
      message.success('Plan 生成成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Plan 失败');
    } finally {
      setPlanningIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleApply = async (id: string) => {
    setApplyingIds((prev) => new Set(prev).add(id));
    try {
      await applyWorkspace(id, { autoApprove: false });
      message.success('Apply 执行成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : 'Apply 失败');
    } finally {
      setApplyingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const statusColorMap: Record<string, string> = {
    idle: colors.success[500],
    planning: colors.info[500],
    applying: colors.warning[500],
    error: colors.error[500],
    locked: colors.neutral[400],
  };

  const envColorMap: Record<string, string> = {
    development: colors.info[500],
    staging: colors.warning[500],
    production: colors.error[500],
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '项目', dataIndex: 'projectId', key: 'projectId' },
    {
      title: '环境', dataIndex: 'environment', key: 'environment',
      render: (e: string) => <Tag color={envColorMap[e]}>{e}</Tag>,
    },
    {
      title: '提供商', dataIndex: 'provider', key: 'provider',
      render: (p: string) => <Tag>{p}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    { title: '最后应用', dataIndex: 'lastAppliedAt', key: 'lastAppliedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '更新时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: IaCWorkspace) => (
        <Space size="small">
          <Button size="small" type="link" icon={<ThunderboltOutlined />} loading={planningIds.has(record.id)} onClick={() => handlePlan(record.id)}>Plan</Button>
          <Popconfirm title="确认 Apply？" onConfirm={() => handleApply(record.id)}>
            <Button size="small" type="link" danger loading={applyingIds.has(record.id)}>Apply</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <CloudOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            IaC 工作区
          </Title>
          <Text type="secondary">管理基础设施即代码工作区，支持 Terraform/Pulumi/CloudFormation</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>创建工作区</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={workspaces} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="创建 IaC 工作区" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input placeholder="工作区名称" /></Form.Item>
          <Form.Item label="项目 ID" name="projectId" rules={[{ required: true }]}><Input placeholder="项目 ID" /></Form.Item>
          <Form.Item label="环境" name="environment" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="development">Development</Select.Option>
              <Select.Option value="staging">Staging</Select.Option>
              <Select.Option value="production">Production</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="提供商" name="provider" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="terraform">Terraform</Select.Option>
              <Select.Option value="pulumi">Pulumi</Select.Option>
              <Select.Option value="cloudformation">CloudFormation</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Resources Tab
// ============================================================================

const ResourcesTab: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<IaCWorkspace[]>([]);
  const [resources, setResources] = useState<IaCResourceChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | undefined>(undefined);

  const loadWorkspaces = async () => {
    try {
      const res = await getWorkspaces();
      setWorkspaces((res.data as any).data || []);
    } catch { /* ignore */ }
  };

  const loadResources = async (workspaceId: string) => {
    setLoading(true);
    try {
      const res = await getWorkspaceResources(workspaceId);
      setResources((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载资源失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadWorkspaces(); }, []);

  const handleWorkspaceChange = (id: string) => {
    setSelectedWorkspace(id);
    loadResources(id);
  };

  const actionColorMap: Record<string, string> = {
    create: colors.success[500],
    update: colors.warning[500],
    delete: colors.error[500],
    replace: colors.purple[500],
    read: colors.neutral[400],
  };

  const columns = [
    { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '操作', dataIndex: 'action', key: 'action',
      render: (a: string) => <Tag color={actionColorMap[a]}>{a}</Tag>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <DeploymentUnitOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            基础设施资源
          </Title>
          <Text type="secondary">查看工作区管理的基础设施资源</Text>
        </div>
        <Select placeholder="选择工作区" style={{ width: 240 }} onChange={handleWorkspaceChange} value={selectedWorkspace}>
          {workspaces.map((w) => <Select.Option key={w.id} value={w.id}>{w.name} ({w.environment})</Select.Option>)}
        </Select>
      </div>
      <Table columns={columns} dataSource={resources} rowKey="address" loading={loading} pagination={{ pageSize: 15 }} />
    </div>
  );
};

// ============================================================================
// Modules Tab
// ============================================================================

const ModulesTab: React.FC = () => {
  const [modules, setModules] = useState<IaCModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getModules();
      setModules((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载模块失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createModule({
        name: values.name,
        description: values.description,
        provider: values.provider,
        version: values.version,
        source: values.source,
      });
      message.success('模块注册成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注册失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '提供商', dataIndex: 'provider', key: 'provider', render: (p: string) => <Tag>{p}</Tag> },
    { title: '版本', dataIndex: 'versions', key: 'versions', render: (v: string[]) => v?.join(', ') || '-' },
    { title: '来源', dataIndex: 'source', key: 'source', ellipsis: true },
    { title: '下载次数', dataIndex: 'downloadCount', key: 'downloadCount' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            模块注册表
          </Title>
          <Text type="secondary">可复用的 IaC 模块库</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>注册模块</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={modules} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="注册 IaC 模块" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input placeholder="模块名称" /></Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="提供商" name="provider" rules={[{ required: true }]}><Input placeholder="如: aws, gcp, alicloud" /></Form.Item>
          <Form.Item label="版本" name="version" rules={[{ required: true }]}><Input placeholder="如: 1.0.0" /></Form.Item>
          <Form.Item label="来源" name="source" rules={[{ required: true }]}><Input placeholder="如: git::https://..." /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Plans Tab
// ============================================================================

const PlansTab: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<IaCWorkspace[]>([]);
  const [plans, setPlans] = useState<IaCPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | undefined>(undefined);

  const loadWorkspaces = async () => {
    try {
      const res = await getWorkspaces();
      setWorkspaces((res.data as any).data || []);
    } catch { /* ignore */ }
  };

  const loadPlans = async (workspaceId: string) => {
    setLoading(true);
    try {
      const res = await getWorkspacePlans(workspaceId);
      setPlans((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载计划失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadWorkspaces(); }, []);

  const handleWorkspaceChange = (id: string) => {
    setSelectedWorkspace(id);
    loadPlans(id);
  };

  const statusColorMap: Record<string, string> = {
    pending: colors.warning[500],
    applied: colors.success[500],
    discarded: colors.neutral[400],
  };

  const columns = [
    { title: 'Plan ID', dataIndex: 'id', key: 'id', ellipsis: true, render: (v: string) => <code style={{ fontSize: 12 }}>{v.slice(0, 12)}...</code> },
    { title: '工作区', dataIndex: 'workspaceId', key: 'workspaceId', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    { title: '变更数', dataIndex: 'resourceChanges', key: 'resourceChanges', render: (changes: IaCResourceChange[]) => changes?.length || 0 },
    { title: '预估费用', dataIndex: 'costEstimate', key: 'costEstimate', render: (v: number) => v ? `$${v.toFixed(2)}` : '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            变更计划
          </Title>
          <Text type="secondary">基础设施变更计划与资源预览</Text>
        </div>
        <Select placeholder="选择工作区" style={{ width: 240 }} onChange={handleWorkspaceChange} value={selectedWorkspace}>
          {workspaces.map((w) => <Select.Option key={w.id} value={w.id}>{w.name} ({w.environment})</Select.Option>)}
        </Select>
      </div>
      <Table columns={columns} dataSource={plans} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const IacPage: React.FC = () => {
  const tabItems = [
    { key: 'workspaces', label: '工作区管理', children: <WorkspaceTab /> },
    { key: 'plans', label: '变更计划', children: <PlansTab /> },
    { key: 'resources', label: '资源列表', children: <ResourcesTab /> },
    { key: 'modules', label: '模块注册表', children: <ModulesTab /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs defaultActiveKey="workspaces" items={tabItems} size="large" />
    </div>
  );
};

export default IacPage;
