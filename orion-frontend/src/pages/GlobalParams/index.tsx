/**
 * Global Param Management Page
 * Cross-pipeline shared parameters with tenant/global scope
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, message, Table, Modal, Form, Input, Select,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  ApiOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getGlobalParams, createGlobalParam, updateGlobalParam, deleteGlobalParam, resolveGlobalParams,
  type GlobalParam, type CreateGlobalParamInput, type UpdateGlobalParamInput,
} from '@/api/global-params';

const { Title, Text } = Typography;

const GlobalParamsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalParam[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<GlobalParam | null>(null);
  const [resolveVisible, setResolveVisible] = useState(false);
  const [resolveResult, setResolveResult] = useState<Record<string, string>>({});
  const [form] = Form.useForm();
  const [resolveForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getGlobalParams();
      setData(res.data || []);
    } catch {
      message.error('加载全局参数失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ scope: 'tenant', isSecret: false });
    setModalVisible(true);
  };

  const handleEdit = (record: GlobalParam) => {
    setEditingItem(record);
    form.setFieldsValue({
      key: record.key,
      value: record.value,
      description: record.description,
      isSecret: record.isSecret,
      scope: record.scope,
      expiresAt: record.expiresAt,
    });
    setModalVisible(true);
  };

  const handleDelete = (record: GlobalParam) => {
    Modal.confirm({
      title: '确认删除',
      content: `删除参数 "${record.key}" ?`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteGlobalParam(record.id);
          message.success('删除成功');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await updateGlobalParam(editingItem.id, values as UpdateGlobalParamInput);
        message.success('更新成功');
      } else {
        await createGlobalParam(values as CreateGlobalParamInput);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch {
      // validation failed
    }
  };

  const handleResolve = async () => {
    try {
      const values = await resolveForm.validateFields();
      let keys: Record<string, string> = {};
      if (values.keys) {
        try {
          keys = typeof values.keys === 'string' ? JSON.parse(values.keys) : values.keys;
          if (typeof keys !== 'object' || Array.isArray(keys)) {
            message.error('Keys 必须是合法的 JSON 对象');
            return;
          }
          const keyCount = Object.keys(keys).length;
          if (keyCount > 100) {
            message.error('Keys 最多支持 100 个');
            return;
          }
        } catch {
          message.error('Keys 必须是合法 JSON');
          return;
        }
      }
      const res = await resolveGlobalParams({ keys });
      setResolveResult(res.data || {});
      message.success('解析完成');
    } catch {
      // validation failed
    }
  };

  const scopeColor: Record<string, string> = {
    tenant: 'blue',
    pipeline: 'green',
    global: 'purple',
  };

  const columns = [
    {
      title: 'Key',
      dataIndex: 'key',
      width: 200,
      render: (v: string) => <Text code strong>{v}</Text>,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      ellipsis: true,
      render: (v: string, r: GlobalParam) => r.isSecret ? '••••••••' : v,
    },
    {
      title: 'Scope',
      dataIndex: 'scope',
      width: 100,
      render: (s: string) => <Tag color={scopeColor[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, r: GlobalParam) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
            编辑
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
            <ApiOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            全局参数管理
          </Title>
          <Text type="secondary">跨 Pipeline 共享的参数配置，支持 tenant / pipeline / global 三级作用域</Text>
        </div>
        <Space>
          <Button icon={<PlayCircleOutlined />} onClick={() => { setResolveVisible(true); setResolveResult({}); resolveForm.resetFields(); }}>
            批量解析
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleCreate}>
            创建参数
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
        title={editingItem ? '编辑参数' : '创建参数'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText={editingItem ? '保存' : '创建'}
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item name="key" label="Key" rules={[{ required: true, message: '请输入 Key' }]}>
            <Input placeholder="参数键名" disabled={!!editingItem} />
          </Form.Item>
          <Form.Item name="value" label="Value" rules={[{ required: true, message: '请输入 Value' }]}>
            <Input.TextArea rows={3} placeholder="参数值" />
          </Form.Item>
          <Form.Item name="scope" label="Scope" rules={[{ required: true }]}>
            <Select options={[
              { value: 'tenant', label: 'Tenant' },
              { value: 'pipeline', label: 'Pipeline' },
              { value: 'global', label: 'Global' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="参数描述（可选）" />
          </Form.Item>
          <Form.Item name="isSecret" label="是否加密" valuePropName="checked">
            <Select options={[
              { value: true, label: '是' },
              { value: false, label: '否' },
            ]} />
          </Form.Item>
          <Form.Item name="expiresAt" label="过期时间">
            <Input placeholder="ISO 8601 格式，留空表示永不过期" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        title="批量解析参数"
        open={resolveVisible}
        onCancel={() => setResolveVisible(false)}
        onOk={handleResolve}
        okText="解析"
        width={600}
      >
        <Form form={resolveForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item name="keys" label="Keys (JSON)" rules={[{ required: true, message: '请输入 keys JSON' }]}>
            <Input.TextArea
              rows={4}
              placeholder='{"DB_HOST": "prod-db", "DB_PORT": "5432"}'
            />
          </Form.Item>
        </Form>
        {Object.keys(resolveResult).length > 0 && (
          <div style={{ marginTop: spacing.md }}>
            <Text strong>解析结果：</Text>
            <pre style={{ background: colors.neutral[200], padding: spacing.md, borderRadius: 6, marginTop: spacing.sm }}>
              {JSON.stringify(resolveResult, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GlobalParamsPage;
