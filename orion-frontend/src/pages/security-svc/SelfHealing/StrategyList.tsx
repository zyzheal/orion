/**
 * Self-Healing - Strategy List
 * Strategy management with CRUD and toggle
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Switch,
} from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, ThunderboltOutlined,} from '@ant-design/icons';
import { getStrategies, createStrategy, toggleStrategy } from '@/api/self-healing';
import type { SelfHealingStrategy } from '@/api/self-healing';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ---- Form value interface ----

interface StrategyFormValues {
  name: string;
  triggerType: string;
  actions: string;
  confidence?: string;
  description?: string;
}

const StrategyList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SelfHealingStrategy[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<SelfHealingStrategy | null>(null);
  const [form] = Form.useForm();
  const [formLoading, setFormLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getStrategies();
      setData((res.data as any).items || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载策略列表失败：${error.message}`);
      } else {
        message.error('加载策略列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      await toggleStrategy(id);
      message.success('策略状态已切换');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`切换策略状态失败：${error.message}`);
      } else {
        message.error('切换策略状态失败，请稍后重试');
      }
    }
  };

  const openCreateModal = () => {
    setEditingStrategy(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (strategy: SelfHealingStrategy) => {
    setEditingStrategy(strategy);
    form.setFieldsValue({
      ...strategy,
      actions: strategy.actions.join(', '),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: StrategyFormValues) => {
    setFormLoading(true);
    try {
      const payload = {
        ...values,
        actions:
          typeof values.actions === 'string'
            ? values.actions
                .split(',')
                .map((a: string) => a.trim())
                .filter(Boolean)
            : values.actions,
        enabled: editingStrategy?.enabled ?? true,
        confidence: values.confidence ? Number(values.confidence) : undefined,
      };
      if (editingStrategy) {
        // Update via create API since no explicit update endpoint
        message.info('更新功能需要后端支持');
      } else {
        await createStrategy(payload);
        message.success('策略已创建');
      }
      setModalOpen(false);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(
          editingStrategy ? `更新策略失败：${error.message}` : `创建策略失败：${error.message}`
        );
      } else {
        message.error(editingStrategy ? '更新策略失败，请稍后重试' : '创建策略失败，请稍后重试');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const columns = [
    { title: '策略 ID', dataIndex: 'id', key: 'id', width: 120, ellipsis: true },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    { title: '触发类型', dataIndex: 'triggerType', key: 'triggerType', width: 140 },
    {
      title: '操作',
      dataIndex: 'actions',
      key: 'actions',
      render: (actions: string[]) => (
        <Space wrap>
          {actions.slice(0, 3).map((a, i) => (
            <Tag key={i}>{a}</Tag>
          ))}
          {actions.length > 3 && <Tag>+{actions.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (confidence?: number) => (confidence ? `${Math.round(confidence * 100)}%` : '-'),
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: SelfHealingStrategy) => (
        <Switch checked={enabled} onChange={() => handleToggle(record.id)} size="small" />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: SelfHealingStrategy) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const tableData = data.map((r) => ({ ...r, key: r.id }));

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            策略列表
          </Title>
          <Text type="secondary">管理自愈合策略</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          添加策略
        </Button>
      </div>

      <Card style={{ marginBottom: spacing.md }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={tableData}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          size="small"
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingStrategy ? '编辑策略' : '添加策略'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="例如：auto-restart-pod" />
          </Form.Item>
          <Form.Item
            name="triggerType"
            label="触发类型"
            rules={[{ required: true, message: '请输入触发类型' }]}
          >
            <Select>
              <Select.Option value="metric">指标触发</Select.Option>
              <Select.Option value="alert">告警触发</Select.Option>
              <Select.Option value="schedule">定时触发</Select.Option>
              <Select.Option value="manual">手动触发</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="actions"
            label="操作列表"
            rules={[{ required: true, message: '请输入操作列表' }]}
          >
            <TextArea
              rows={4}
              placeholder="每行一个操作，用逗号分隔，例如：restart-pod, scale-up, notify"
            />
          </Form.Item>
          <Form.Item name="confidence" label="置信度">
            <Input type="number" min={0} max={1} step={0.1} placeholder="0.0 - 1.0" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="策略描述..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={formLoading} block>
              {editingStrategy ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StrategyList;
