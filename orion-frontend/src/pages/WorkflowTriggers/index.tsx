/**
 * Workflow Trigger Management Page
 *
 * Admin page for workflow trigger CRUD: create, edit, delete, enable/disable triggers.
 * Uses api/workflow-trigger.ts for all data operations.
 *
 * Route: /console/triggers
 * Access: admin, platform_admin
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Tag, Space, message, Modal, Form, Input, Select, Switch, Tooltip, Popconfirm, Typography,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  ThunderboltOutlined, ClockCircleOutlined, ApiOutlined, GlobalOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import DataState from '@/components/DataState';
import { colors, spacing } from '@/tokens';
import {
  getTriggers, createTrigger, updateTrigger,
  deleteTrigger, enableTrigger, disableTrigger,
  type WorkflowTrigger, type WorkflowTriggerType, type CreateWorkflowTriggerInput,
} from '@/api/workflow-trigger';
import { getWorkflowList, type WorkflowDefinition } from '@/api/workflow';

const { Text } = Typography;

// Type configuration
const TRIGGER_TYPE_CONFIG: Record<WorkflowTriggerType, { color: string; label: string; icon: React.ReactNode }> = {
  event:    { color: 'blue',      label: '事件触发',   icon: <ThunderboltOutlined /> },
  cron:     { color: 'orange',   label: '定时触发',   icon: <ClockCircleOutlined /> },
  webhook:  { color: 'purple',   label: 'Webhook',    icon: <ApiOutlined /> },
  manual:   { color: 'default',  label: '手动触发',   icon: <GlobalOutlined /> },
};

const WorkflowTriggers: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<WorkflowTrigger | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [form] = Form.useForm();

  // Load triggers
  const loadTriggers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTriggers({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setTriggers(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载触发器失败'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  // Load workflows for dropdown
  const loadWorkflows = useCallback(async () => {
    try {
      const list = await getWorkflowList({ limit: 100 });
      setWorkflows(list);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    }
  }, []);

  useEffect(() => {
    loadTriggers();
  }, [loadTriggers]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // Handle create
  const handleCreate = async (values: CreateWorkflowTriggerInput) => {
    try {
      await createTrigger(values);
      message.success('触发器已创建');
      setModalVisible(false);
      form.resetFields();
      loadTriggers();
    } catch (err) {
      message.error('创建失败');
    }
  };

  // Handle update
  const handleUpdate = async (values: CreateWorkflowTriggerInput) => {
    if (!editingTrigger) return;
    try {
      await updateTrigger(editingTrigger.id, values);
      message.success('触发器已更新');
      setModalVisible(false);
      setEditingTrigger(null);
      form.resetFields();
      loadTriggers();
    } catch (err) {
      message.error('更新失败');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await deleteTrigger(id);
      message.success('触发器已删除');
      loadTriggers();
    } catch (err) {
      message.error('删除失败');
    }
  };

  // Handle enable/disable
  const handleToggle = async (trigger: WorkflowTrigger) => {
    try {
      if (trigger.enabled) {
        await disableTrigger(trigger.id);
        message.success('触发器已禁用');
      } else {
        await enableTrigger(trigger.id);
        message.success('触发器已启用');
      }
      loadTriggers();
    } catch (err) {
      message.error('操作失败');
    }
  };

  // Open edit modal
  const openEdit = (trigger: WorkflowTrigger) => {
    setEditingTrigger(trigger);
    form.setFieldsValue({
      name: trigger.name,
      type: trigger.type,
      workflowId: trigger.workflowId,
      eventType: trigger.eventType,
      cronExpression: trigger.cronExpression,
      enabled: trigger.enabled,
      description: trigger.description,
    });
    setModalVisible(true);
  };

  // Open create modal
  const openCreate = () => {
    setEditingTrigger(null);
    form.resetFields();
    setModalVisible(true);
  };

  // Table columns
  const columns: TableColumn<WorkflowTrigger>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 180,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 120,
      render: (v: unknown) => {
        const cfg = TRIGGER_TYPE_CONFIG[v as WorkflowTriggerType] ?? { color: 'default', label: String(v), icon: null };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      key: 'workflowId',
      title: '关联工作流',
      dataIndex: 'workflowId',
      width: 150,
      render: (v: unknown) => {
        const wf = workflows.find(w => w.id === v);
        return wf ? <Text ellipsis style={{ maxWidth: 130 }}>{wf.name}</Text> : String(v);
      },
    },
    {
      key: 'condition',
      title: '触发条件',
      width: 200,
      render: (_: unknown, record: WorkflowTrigger) => {
        if (record.type === 'cron' && record.cronExpression) {
          return <Text code style={{ fontSize: 12 }}>{record.cronExpression}</Text>;
        }
        if (record.type === 'event' && record.eventType) {
          return <Tag>{record.eventType}</Tag>;
        }
        if (record.type === 'webhook' && record.webhookPath) {
          return <Text code style={{ fontSize: 11 }}>{record.webhookPath}</Text>;
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (v: unknown) => v ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>,
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (v: unknown) => v ? new Date(String(v)).toLocaleString('zh-CN') : '-',
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: WorkflowTrigger) => (
        <Space size="small">
          <Tooltip title={record.enabled ? '禁用' : '启用'}>
            <Switch
              size="small"
              checked={record.enabled}
              onChange={() => handleToggle(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除该触发器?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
            <ThunderboltOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
            工作流触发器
          </h2>
          <Text type="secondary">Workflow Trigger Management</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadTriggers} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建触发器</Button>
        </Space>
      </div>

      <DataState
        loading={loading && triggers.length === 0}
        error={error}
        empty={triggers.length === 0 && !loading}
        emptyText="暂无触发器"
        loadingText="加载触发器..."
        retry={loadTriggers}
      >
        <Card>
          <Table
            columns={columns}
            dataSource={triggers}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
            pagination={{
              current: page,
              pageSize: pageSize,
              total: total,
            }}
            onChange={(pagination) => {
              setPage(pagination.current ?? 1);
              setPageSize(pagination.pageSize ?? 20);
            }}
          />
        </Card>
      </DataState>

      {/* Create/Edit Modal */}
      <Modal
        title={editingTrigger ? '编辑触发器' : '新建触发器'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingTrigger(null); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingTrigger ? handleUpdate : handleCreate}
          initialValues={{ type: 'event', enabled: true, timezone: 'Asia/Shanghai' }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入触发器名称' }]}>
            <Input placeholder="e.g. daily-trigger" />
          </Form.Item>

          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择触发器类型' }]}>
            <Select placeholder="选择触发器类型">
              <Select.Option value="event">
                <Tag color="blue"><ThunderboltOutlined /> 事件触发</Tag>
              </Select.Option>
              <Select.Option value="cron">
                <Tag color="orange"><ClockCircleOutlined /> 定时触发</Tag>
              </Select.Option>
              <Select.Option value="webhook">
                <Tag color="purple"><ApiOutlined /> Webhook</Tag>
              </Select.Option>
              <Select.Option value="manual">
                <Tag><GlobalOutlined /> 手动触发</Tag>
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="workflowId" label="关联工作流" rules={[{ required: true, message: '请选择关联工作流' }]}>
            <Select
              placeholder="选择工作流"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {workflows.map(wf => (
                <Select.Option key={wf.id} value={wf.id} label={wf.name}>
                  {wf.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item noStyle dependencies={['type']}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              return (
                <>
                  {type === 'event' && (
                    <Form.Item name="eventType" label="事件类型" rules={[{ required: true, message: '请输入事件类型' }]}>
                      <Input placeholder="e.g. pipeline.completed, deployment.success" />
                    </Form.Item>
                  )}
                  {type === 'cron' && (
                    <Form.Item name="cronExpression" label="Cron 表达式" rules={[{ required: true, message: '请输入 Cron 表达式' }]}>
                      <Input placeholder="e.g. 0 0 * * * (每天零点)" />
                    </Form.Item>
                  )}
                  {type === 'webhook' && (
                    <Form.Item name="webhookPath" label="Webhook 路径">
                      <Input placeholder="e.g. /webhook/trigger-xxx" />
                    </Form.Item>
                  )}
                </>
              );
            }}
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选描述信息" />
          </Form.Item>

          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkflowTriggers;