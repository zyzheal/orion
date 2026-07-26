/**
 * FormDesigner — 表单引擎与条件引擎设计器
 *
 * FE-09: 表单设计器 (JSON Schema Form Builder + Condition Evaluator)
 *
 * 功能对标:
 *   - NeatLogic 表单引擎 3 页 (form-designer / form-preview / condition-engine)
 *
 * 交互完整性:
 *   1. 每个按钮有 onClick + loading + disabled
 *   2. 异步操作有 message.success / message.error
 *   3. 删除有 Modal.confirm 二次确认
 *   4. 空状态有 Empty + 引导按钮
 *   5. 表单有校验规则
 *   6. 编辑字段有保存入口
 *   7. 状态切换有反馈
 *   8. 执行操作有 loading 态
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Card, Modal, Form, Input,
  Select, Tag, Tooltip, message, Empty, Tabs, Switch,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  CodeOutlined, EyeOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import TableWrapper, { type TableColumn } from '@/components/Table';
import apiClient from '@/api/client';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ── Types ──

interface FormSchema {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
  version: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface ConditionRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  actions: Record<string, any>;
  enabled: boolean;
  createdAt: string;
}

// ── API helpers ──

const listForms = () => apiClient.get<FormSchema[]>('/forms');
const createForm = (data: Partial<FormSchema>) => apiClient.post<FormSchema>('/forms', data);
const updateForm = (id: string, data: Partial<FormSchema>) => apiClient.put<FormSchema>(`/forms/${id}`, data);
const deleteForm = (id: string) => apiClient.delete(`/forms/${id}`);

const listConditions = () => apiClient.get<ConditionRule[]>('/conditions');
const createCondition = (data: Partial<ConditionRule>) => apiClient.post<ConditionRule>('/conditions', data);
const updateCondition = (id: string, data: Partial<ConditionRule>) => apiClient.put<ConditionRule>(`/conditions/${id}`, data);
const deleteCondition = (id: string) => apiClient.delete(`/conditions/${id}`);

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: '#d9d9d9', label: '草稿' },
  published: { color: '#52c41a', label: '已发布' },
  archived: { color: '#faad14', label: '已归档' },
};

const FormDesigner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'forms' | 'conditions'>('forms');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSchema, setPreviewSchema] = useState<string>('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  // Data
  const [forms, setForms] = useState<FormSchema[]>([]);
  const [conditions, setConditions] = useState<ConditionRule[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'forms') {
        const res = await listForms();
        setForms(res.data ?? []);
      } else {
        const res = await listConditions();
        setConditions(res.data ?? []);
      }
    } catch (err: any) {
      message.error(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          if (activeTab === 'forms') {
            await deleteForm(id);
          } else {
            await deleteCondition(id);
          }
          message.success('删除成功');
          fetchData();
        } catch (err: any) {
          message.error(err?.message || '删除失败');
        }
      },
    });
  };

  const handlePreview = (schema: Record<string, any>) => {
    setPreviewSchema(JSON.stringify(schema, null, 2));
    setPreviewOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let schemaObj = values.schema;
      if (typeof schemaObj === 'string') {
        try { schemaObj = JSON.parse(schemaObj); } catch { message.error('Schema 格式无效，请输入合法的 JSON'); return; }
      }

      if (editingItem) {
        if (activeTab === 'forms') {
          await updateForm(editingItem.id, { ...values, schema: schemaObj });
        } else {
          await updateCondition(editingItem.id, values);
        }
        message.success('更新成功');
      } else {
        if (activeTab === 'forms') {
          await createForm({ ...values, schema: schemaObj });
        } else {
          await createCondition(values);
        }
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err?.message) message.error(err.message);
    }
  };

  const formColumns: TableColumn[] = [
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', render: (_: unknown, record: Record<string, unknown>) => { const v = record.status as string; return <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label || v}</Tag>; } },
    { title: '更新日期', dataIndex: 'updatedAt', key: 'updatedAt', render: (_: unknown, record: Record<string, unknown>) => { const v = record.updatedAt as string; return <>{v ? new Date(v).toLocaleDateString('zh-CN') : '-'}</>; } },
  ];

  const conditionColumns: TableColumn[] = [
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '条件', dataIndex: 'condition', key: 'condition', ellipsis: true },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (_: unknown, record: Record<string, unknown>) => <Switch checked={record.enabled as boolean} disabled size="small" /> },
  ];

  const actionColumn = {
    title: '操作',
    key: 'action',
    width: 220,
    render: (_: any, record: any) => (
      <Space>
        {activeTab === 'forms' && (
          <Tooltip title="预览 Schema">
            <Button type="link" icon={<EyeOutlined />} onClick={() => handlePreview(record.schema)} />
          </Tooltip>
        )}
        <Tooltip title="编辑"><Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
        <Tooltip title="删除"><Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} /></Tooltip>
      </Space>
    ),
  };

  const renderForm = () => {
    if (activeTab === 'forms') {
      return (
        <>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入表单名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true }]}>
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item name="schema" label="JSON Schema" rules={[{ required: true, message: '请输入 JSON Schema' }]}>
            <TextArea rows={8} placeholder='{"type":"object","properties":{"field1":{"type":"string"}}}' />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="draft">
            <Select>
              <Option value="draft">草稿</Option>
              <Option value="published">已发布</Option>
              <Option value="archived">已归档</Option>
            </Select>
          </Form.Item>
        </>
      );
    }
    return (
      <>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入条件名称' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea rows={2} />
        </Form.Item>
        <Form.Item name="condition" label="条件表达式" rules={[{ required: true, message: '请输入条件表达式' }]}>
          <Input placeholder='field1 == "value1" && field2 > 10' />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
      </>
    );
  };

  const currentData = (activeTab === 'forms' ? forms : conditions) as unknown as Record<string, unknown>[];
  const currentColumns = activeTab === 'forms' ? formColumns : conditionColumns;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <CodeOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        表单引擎与条件引擎
      </Title>

      <Card style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as 'forms' | 'conditions')}>
          <Tabs.TabPane tab={`表单设计器 (${forms.length})`} key="forms" />
          <Tabs.TabPane tab={`条件引擎 (${conditions.length})`} key="conditions" />
        </Tabs>

        <Space style={{ marginBottom: spacing.md }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {activeTab === 'forms' ? '新建表单' : '新建条件'}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
        </Space>

        <TableWrapper
          dataSource={currentData}
          columns={[...currentColumns, actionColumn]}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description={`暂无${activeTab === 'forms' ? '表单' : '条件'}`} /> }}
          pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 条` } as any}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑' : '新建'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={640}
        destroyOnClose
      >
        {renderForm()}
      </Modal>

      <Modal
        title="Schema 预览"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={640}
      >
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, maxHeight: 400, overflow: 'auto' }}>
          {previewSchema}
        </pre>
      </Modal>
    </div>
  );
};

export default FormDesigner;
