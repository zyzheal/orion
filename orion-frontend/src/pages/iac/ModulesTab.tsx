/**
 * ModulesTab.tsx - IaC 模块注册表
 * 抽取自 IacPage.tsx (P2-9 Phase 49)
 * 状态+loadData+5 handler+2 Modal(Create/Edit)
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
  Popconfirm,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  FileTextOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  getModules,
  createModule,
  updateModule,
  deleteModule,
  type IaCModule,
} from '@/api/iac';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

const ModulesTab: React.FC = () => {
  const [modules, setModules] = useState<IaCModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<IaCModule | null>(null);
  const [editForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getModules();
      setModules((res.data as { data?: IaCModule[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载模块失败');
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

  const openEdit = (record: IaCModule) => {
    setEditingModule(record);
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      provider: record.provider,
      source: record.source,
      versions: record.versions?.join(', ') || '',
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: any) => {
    if (!editingModule) return;
    try {
      await updateModule(editingModule.id, {
        name: values.name,
        description: values.description,
        provider: values.provider,
        source: values.source,
        version: values.versions,
      });
      message.success('模块更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      setEditingModule(null);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteModule(id);
      message.success('模块已删除');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (p: string) => <Tag>{p}</Tag>,
    },
    {
      title: '版本',
      dataIndex: 'versions',
      key: 'versions',
      render: (v: string[]) => v?.join(', ') || '-',
    },
    { title: '来源', dataIndex: 'source', key: 'source', ellipsis: true },
    { title: '下载次数', dataIndex: 'downloadCount', key: 'downloadCount' },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: IaCModule) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此模块？" onConfirm={() => handleDelete(record.id)}>
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
            <FileTextOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            模块注册表
          </Title>
          <Text type="secondary">可复用的 IaC 模块库</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            注册模块
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={modules}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: <Empty description="暂无 IaC 模块，点击「注册模块」开始添加" />,
        }}
      />

      <Modal
        title="注册 IaC 模块"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="模块名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="提供商" name="provider" rules={[{ required: true }]}>
            <Input placeholder="如: aws, gcp, alicloud" />
          </Form.Item>
          <Form.Item label="版本" name="version" rules={[{ required: true }]}>
            <Input placeholder="如: 1.0.0" />
          </Form.Item>
          <Form.Item label="来源" name="source" rules={[{ required: true }]}>
            <Input placeholder="如: git::https://..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑 IaC 模块"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="模块名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="提供商" name="provider" rules={[{ required: true }]}>
            <Input placeholder="如: aws, gcp, alicloud" />
          </Form.Item>
          <Form.Item label="来源" name="source" rules={[{ required: true }]}>
            <Input placeholder="如: git::https://..." />
          </Form.Item>
          <Form.Item label="版本" name="versions">
            <Input placeholder="如: 1.0.0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModulesTab;
