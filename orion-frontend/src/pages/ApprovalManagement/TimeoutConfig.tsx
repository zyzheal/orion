/**
 * 超时配置面板
 *
 * 管理审批超时自动处理策略：
 * - 超时时间设置
 * - 超时自动拒绝/升级
 * - 提醒间隔
 */
import React, { useState } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  Space,
  Table,
  Tag,
  message,
  Modal,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BellOutlined,
} from '@ant-design/icons';
import {
  type ApprovalTimeoutConfig,
  createTimeoutConfig,
  updateTimeoutConfig,
  deleteTimeoutConfig,
} from '@/api/approval';
import { colors } from '@/tokens/colors';

interface TimeoutConfigProps {
  configs: ApprovalTimeoutConfig[];
  loading: boolean;
  onRefresh: () => void;
}

/**
 * 超时配置管理面板
 */
const TimeoutConfig: React.FC<TimeoutConfigProps> = ({ configs, loading, onRefresh }) => {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApprovalTimeoutConfig | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // ---- 创建 ----
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      await createTimeoutConfig({
        resourceType: values.resourceType || undefined,
        defaultTimeoutHours: values.defaultTimeoutHours,
        escalationEnabled: values.escalationEnabled ?? false,
        escalationTarget: values.escalationTarget || undefined,
        autoRejectOnTimeout: values.autoRejectOnTimeout ?? false,
        reminderIntervalHours: values.reminderIntervalHours,
      });
      message.success('超时配置创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      onRefresh();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  // ---- 编辑 ----
  const handleEdit = async () => {
    if (!editingConfig) return;
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      await updateTimeoutConfig(editingConfig.id!, {
        defaultTimeoutHours: values.defaultTimeoutHours,
        escalationEnabled: values.escalationEnabled,
        escalationTarget: values.escalationTarget || undefined,
        autoRejectOnTimeout: values.autoRejectOnTimeout,
        reminderIntervalHours: values.reminderIntervalHours,
      });
      message.success('超时配置更新成功');
      setEditModalVisible(false);
      setEditingConfig(null);
      onRefresh();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    } finally {
      setEditLoading(false);
    }
  };

  // ---- 删除 ----
  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteTimeoutConfig(id);
          message.success('超时配置已删除');
          onRefresh();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  // ---- 打开编辑 ----
  const openEdit = (config: ApprovalTimeoutConfig) => {
    setEditingConfig(config);
    editForm.setFieldsValue({
      resourceType: config.resourceType,
      defaultTimeoutHours: config.defaultTimeoutHours,
      escalationEnabled: config.escalationEnabled,
      escalationTarget: config.escalationTarget,
      autoRejectOnTimeout: config.autoRejectOnTimeout,
      reminderIntervalHours: config.reminderIntervalHours,
    });
    setEditModalVisible(true);
  };

  // ---- 表格列 ----
  const columns = [
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 160,
      render: (v: string | undefined) =>
        v ? <Tag color="blue">{v}</Tag> : <Tag>全局默认</Tag>,
    },
    {
      title: '超时时间',
      dataIndex: 'defaultTimeoutHours',
      key: 'defaultTimeoutHours',
      width: 120,
      render: (v: number) => `${v} 小时`,
    },
    {
      title: '自动拒绝',
      dataIndex: 'autoRejectOnTimeout',
      key: 'autoRejectOnTimeout',
      width: 100,
      render: (v: boolean) => (
        <Tag color={v ? colors.error[400] : colors.neutral[400]}>
          {v ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '超时升级',
      key: 'escalation',
      width: 180,
      render: (_v: unknown, record: ApprovalTimeoutConfig) => (
        <Space>
          <Tag color={record.escalationEnabled ? colors.warning[500] : colors.neutral[300]}>
            {record.escalationEnabled ? '已启用' : '未启用'}
          </Tag>
          {record.escalationTarget && (
            <Tooltip title="升级目标">
              <Tag>{record.escalationTarget}</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '提醒间隔',
      dataIndex: 'reminderIntervalHours',
      key: 'reminderIntervalHours',
      width: 120,
      render: (v: number) => (
        <Space>
          <BellOutlined style={{ color: colors.warning[500], fontSize: 12 }} />
          <span>{v} 小时</span>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_v: unknown, record: ApprovalTimeoutConfig) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id!)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ color: colors.neutral[500], fontSize: 13 }}>
          共 {configs.length} 个超时配置
        </span>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          新建配置
        </Button>
      </div>

      {/* 配置表格 */}
      <Table
        columns={columns}
        dataSource={configs}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 10 }}
      />

      {/* 创建弹窗 */}
      <Modal
        title="新建超时配置"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        confirmLoading={createLoading}
        width={560}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="resourceType" label="资源类型">
            <Select
              placeholder="留空为全局默认配置"
              allowClear
              options={[
                { label: '部署 (deployment)', value: 'deployment' },
                { label: '数据库 (database)', value: 'database' },
                { label: '服务 (service)', value: 'service' },
                { label: '安全 (security)', value: 'security' },
                { label: '基础设施 (infrastructure)', value: 'infrastructure' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="defaultTimeoutHours"
            label="默认超时时间 (小时)"
            rules={[{ required: true, message: '请输入超时时间' }]}
          >
            <InputNumber min={1} max={720} style={{ width: '100%' }} placeholder="如: 24" />
          </Form.Item>
          <Form.Item
            name="autoRejectOnTimeout"
            label="超时自动拒绝"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch
              checkedChildren="是"
              unCheckedChildren="否"
            />
          </Form.Item>
          <Form.Item
            name="escalationEnabled"
            label="启用超时升级"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item name="escalationTarget" label="升级目标">
            <Input placeholder="升级通知的用户/组 ID" />
          </Form.Item>
          <Form.Item
            name="reminderIntervalHours"
            label="提醒间隔 (小时)"
            initialValue={4}
          >
            <InputNumber min={1} max={24} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑超时配置"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingConfig(null);
        }}
        onOk={handleEdit}
        confirmLoading={editLoading}
        width={560}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="defaultTimeoutHours"
            label="默认超时时间 (小时)"
            rules={[{ required: true, message: '请输入超时时间' }]}
          >
            <InputNumber min={1} max={720} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="autoRejectOnTimeout"
            label="超时自动拒绝"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item
            name="escalationEnabled"
            label="启用超时升级"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item name="escalationTarget" label="升级目标">
            <Input placeholder="升级通知的用户/组 ID" />
          </Form.Item>
          <Form.Item name="reminderIntervalHours" label="提醒间隔 (小时)">
            <InputNumber min={1} max={24} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TimeoutConfig;
