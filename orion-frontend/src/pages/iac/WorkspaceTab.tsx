/**
 * WorkspaceTab.tsx - IaC 工作区管理
 * 抽取自 IacPage.tsx (P2-9 Phase 49)
 * 状态+loadData+7 handler+2 Modal(Create/Edit)
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Table,
  Button,
  Tag,
  Space,
  message,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Empty,
} from 'antd';
import {
  CloudOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  planWorkspace,
  applyWorkspace,
  type IaCWorkspace,
} from '@/api/iac';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

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

const WorkspaceTab: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<IaCWorkspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [planningIds, setPlanningIds] = useState<Set<string>>(new Set());
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [form] = Form.useForm();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<IaCWorkspace | null>(null);
  const [editForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getWorkspaces();
      setWorkspaces((res.data as { data?: IaCWorkspace[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载工作区失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setPlanningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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
      setApplyingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openEdit = (record: IaCWorkspace) => {
    setEditingWorkspace(record);
    editForm.setFieldsValue({
      name: record.name,
      projectId: record.projectId,
      environment: record.environment,
      provider: record.provider,
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: any) => {
    if (!editingWorkspace) return;
    try {
      await updateWorkspace(editingWorkspace.id, {
        name: values.name,
      });
      message.success('工作区更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      setEditingWorkspace(null);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkspace(id);
      message.success('工作区已删除');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '项目', dataIndex: 'projectId', key: 'projectId' },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (e: string) => <Tag color={envColorMap[e]}>{e}</Tag>,
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (p: string) => <Tag>{p}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    {
      title: '最后应用',
      dataIndex: 'lastAppliedAt',
      key: 'lastAppliedAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '更新时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: IaCWorkspace) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            icon={<ThunderboltOutlined />}
            loading={planningIds.has(record.id)}
            onClick={() => handlePlan(record.id)}
          >
            Plan
          </Button>
          <Popconfirm title="确认 Apply？" onConfirm={() => handleApply(record.id)}>
            <Button size="small" type="link" danger loading={applyingIds.has(record.id)}>
              Apply
            </Button>
          </Popconfirm>
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此工作区？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <CloudOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            IaC 工作区
          </Title>
          <Text type="secondary">
            管理基础设施即代码工作区，支持 Terraform/Pulumi/CloudFormation
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建工作区
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={workspaces}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: <Empty description="暂无 IaC 工作区，点击「创建工作区」开始添加" />,
        }}
      />

      <Modal
        title="创建 IaC 工作区"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="工作区名称" />
          </Form.Item>
          <Form.Item label="项目 ID" name="projectId" rules={[{ required: true }]}>
            <Input placeholder="项目 ID" />
          </Form.Item>
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

      <Modal
        title="编辑 IaC 工作区"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="工作区名称" />
          </Form.Item>
          <Form.Item label="项目 ID" name="projectId" rules={[{ required: true }]}>
            <Input placeholder="项目 ID" />
          </Form.Item>
          <Form.Item label="环境" name="environment" rules={[{ required: true }]}>
            <Select disabled>
              <Select.Option value="development">Development</Select.Option>
              <Select.Option value="staging">Staging</Select.Option>
              <Select.Option value="production">Production</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="提供商" name="provider" rules={[{ required: true }]}>
            <Select disabled>
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

export default WorkspaceTab;
