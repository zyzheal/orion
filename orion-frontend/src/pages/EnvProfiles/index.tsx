/**
 * EnvProfile Management Page
 * Environment-specific configuration profiles with variable resolution
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, message, Table, Modal, Form, Input, Select,
  Descriptions,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import {
  getEnvProfiles, createEnvProfile, updateEnvProfile, deleteEnvProfile,
  getEnvironmentsForProfile, resolveEnvVariables,
  type EnvProfile, type CreateEnvProfileInput, type UpdateEnvProfileInput,
} from '@/api/env-profiles';

const { Title, Text } = Typography;

const EnvProfilesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EnvProfile[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<EnvProfile | null>(null);
  const [resolveVisible, setResolveVisible] = useState(false);
  const [resolveResult, setResolveResult] = useState<Record<string, string>>({});
  const [selectedProfile, setSelectedProfile] = useState<EnvProfile | null>(null);
  const [environments, setEnvironments] = useState<string[]>([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [form] = Form.useForm();
  const [resolveForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getEnvProfiles();
      setData(res.data || []);
    } catch {
      message.error('加载环境配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: EnvProfile) => {
    setEditingItem(record);
    form.setFieldsValue({
      name: record.name,
      environment: record.environment,
      variables: JSON.stringify(record.variables, null, 2),
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleDelete = (record: EnvProfile) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除配置 "${record.name}/${record.environment}" ?`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteEnvProfile(record.id);
          message.success('删除成功');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleViewEnvironments = async (record: EnvProfile) => {
    setSelectedProfile(record);
    setEnvLoading(true);
    try {
      const res = await getEnvironmentsForProfile(record.name);
      setEnvironments(res.data || []);
    } catch {
      message.error('加载环境列表失败');
    } finally {
      setEnvLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let variables: Record<string, string> = {};
      if (values.variables) {
        try {
          variables = typeof values.variables === 'string'
            ? JSON.parse(values.variables)
            : values.variables;
        } catch {
          message.error('Variables 必须是合法 JSON');
          return;
        }
      }
      if (editingItem) {
        await updateEnvProfile(editingItem.id, { ...values, variables } as UpdateEnvProfileInput);
        message.success('更新成功');
      } else {
        await createEnvProfile({ ...values, variables } as CreateEnvProfileInput);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch {
      // validation failed
    }
  };

  const handleResolve = async () => {
    if (!selectedProfile) return;
    try {
      const values = await resolveForm.validateFields();
      const overrides = values.overrides ? JSON.parse(values.overrides) : undefined;
      const res = await resolveEnvVariables({
        name: selectedProfile.name,
        environment: selectedProfile.environment,
        overrides,
      });
      setResolveResult(res.data || {});
      message.success('解析完成');
    } catch {
      // validation failed
    }
  };

  const envColor: Record<string, string> = {
    development: 'green',
    staging: 'orange',
    production: 'red',
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      width: 180,
      render: (v: string, r: EnvProfile) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Tag color={envColor[r.environment] || 'default'}>{r.environment}</Tag>
        </Space>
      ),
    },
    {
      title: 'Variables',
      dataIndex: 'variables',
      ellipsis: true,
      render: (v: Record<string, string>) => {
        const keys = Object.keys(v);
        return keys.length > 0 ? `${keys.length} keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}` : '-';
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      width: 250,
      render: (_: unknown, r: EnvProfile) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => { setSelectedProfile(r); setResolveVisible(true); setResolveResult({}); resolveForm.resetFields(); }}>
            解析变量
          </Button>
          <Button type="link" size="small" onClick={() => handleViewEnvironments(r)} loading={envLoading && selectedProfile?.id === r.id}>
            环境列表
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <SettingOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            环境配置管理
          </Title>
          <Text type="secondary">按环境管理变量配置，支持变量解析与覆盖</Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleCreate}>
            创建配置
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 20 }}
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingItem ? '编辑环境配置' : '创建环境配置'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText={editingItem ? '保存' : '创建'}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: '请输入 Name' }]}>
            <Input placeholder="配置名称（如 default）" />
          </Form.Item>
          <Form.Item name="environment" label="Environment" rules={[{ required: true, message: '请选择环境' }]}>
            <Select options={[
              { value: 'development', label: 'Development' },
              { value: 'staging', label: 'Staging' },
              { value: 'production', label: 'Production' },
            ]} />
          </Form.Item>
          <Form.Item name="variables" label="Variables (JSON)" rules={[{ required: true, message: '请输入 Variables JSON' }]}>
            <Input.TextArea rows={6} placeholder='{"DB_HOST": "localhost", "DB_PORT": "5432"}' />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="配置描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Resolve Variables Modal */}
      <Modal
        title={`解析变量 — ${selectedProfile?.name}/${selectedProfile?.environment}`}
        open={resolveVisible}
        onCancel={() => setResolveVisible(false)}
        onOk={handleResolve}
        okText="解析"
        width={700}
      >
        <Form form={resolveForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item name="overrides" label="Overrides (JSON，可选)">
            <Input.TextArea rows={3} placeholder='{"DB_HOST": "new-host"}' />
          </Form.Item>
        </Form>
        {Object.keys(resolveResult).length > 0 && (
          <div style={{ marginTop: spacing.md }}>
            <Text strong>解析结果：</Text>
            <Descriptions bordered size="small" column={1} style={{ marginTop: 8 }}>
              {Object.entries(resolveResult).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>{value}</Descriptions.Item>
              ))}
            </Descriptions>
          </div>
        )}
      </Modal>

      {/* Environment List Modal */}
      <Modal
        title={`${selectedProfile?.name} — 环境列表`}
        open={!!selectedProfile && envLoading === false && environments.length > 0}
        onCancel={() => { setSelectedProfile(null); setEnvironments([]); }}
        footer={null}
      >
        <Space wrap>
          {environments.map(env => (
            <Tag key={env} color="blue">{env}</Tag>
          ))}
        </Space>
      </Modal>
    </div>
  );
};

export default EnvProfilesPage;
