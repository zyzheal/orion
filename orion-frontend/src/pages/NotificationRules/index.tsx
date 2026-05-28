/**
 * Notification Rules Management Page
 *
 * Tab-based interface for managing platform notification destinations:
 *   - Webhooks tab: Generic HTTP webhook endpoints (existing functionality)
 *   - IM Notifications tab: IM bot webhooks (DingTalk, WeCom, Feishu)
 *
 * Route: /console/notification-rules
 * Access: admin, platform_admin
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Tag, Modal, Form, Input,
  Switch, message, Popconfirm, Tooltip, Select, Tabs,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, BellOutlined, LinkOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import DataState from '@/components/DataState';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

// IM notification rule APIs
import {
  getIMNotificationRules,
  createIMNotificationRule,
  updateIMNotificationRule,
  deleteIMNotificationRule,
  toggleIMNotificationRule,
  testIMNotificationRule,
  type IMNotificationRule,
  type IMNotificationRuleInput,
} from '@/api/notificationRules';

// Reuse existing WebhookManagement as the Webhooks tab content
import WebhookManagement from '@/pages/WebhookManagement';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// ============================================================================
// Constants
// ============================================================================

/** IM platform options */
const PLATFORM_OPTIONS = [
  { label: '钉钉 (DingTalk)', value: 'dingtalk' as const },
  { label: '企业微信 (WeCom)', value: 'wecom' as const },
  { label: '飞书 (Feishu)', value: 'feishu' as const },
];

/** Platform display config */
const PLATFORM_CONFIG: Record<string, { color: string; label: string }> = {
  dingtalk: { color: colors.primary[500], label: '钉钉' },
  wecom: { color: '#2BAE67', label: '企业微信' },
  feishu: { color: colors.primary[500], label: '飞书' },
};

/** Pipeline events available for IM notification subscription */
const IM_EVENT_OPTIONS = [
  'pipeline.complete',
  'pipeline.failed',
  'pipeline.cancelled',
  'deployment.success',
  'deployment.failed',
  'alert.triggered',
  'alert.resolved',
  'selfhealing.triggered',
  'cost.anomaly',
];

// ============================================================================
// IM Notifications Tab Component
// ============================================================================

const IMNotificationsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [rules, setRules] = useState<IMNotificationRule[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<IMNotificationRule | null>(null);
  const [form] = Form.useForm();

  /** Load IM notification rules */
  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getIMNotificationRules();
      setRules(data);
    } catch (err) {
      console.warn('IM notification rules API unavailable, showing empty state:', err);
      // Backend endpoint not yet implemented — show empty state gracefully
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  /** Open create modal */
  const openCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true });
    setModalVisible(true);
  };

  /** Open edit modal */
  const openEdit = (rule: IMNotificationRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      platform: rule.platform,
      name: rule.name,
      webhookUrl: rule.webhookUrl,
      events: rule.events,
      enabled: rule.enabled,
    });
    setModalVisible(true);
  };

  /** Handle form submission (create or update) */
  const handleSubmit = async (values: IMNotificationRuleInput) => {
    try {
      if (editingRule) {
        await updateIMNotificationRule(editingRule.id, values);
        message.success('IM 通知规则已更新');
      } else {
        await createIMNotificationRule(values);
        message.success('IM 通知规则已创建');
      }
      setModalVisible(false);
      setEditingRule(null);
      form.resetFields();
      loadRules();
    } catch (err) {
      message.error(editingRule ? '更新失败' : '创建失败');
    }
  };

  /** Delete a rule */
  const handleDelete = async (id: string) => {
    try {
      await deleteIMNotificationRule(id);
      message.success('IM 通知规则已删除');
      loadRules();
    } catch (err) {
      message.error('删除失败');
    }
  };

  /** Toggle enabled/disabled */
  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleIMNotificationRule(id, enabled);
      message.success(enabled ? '已启用' : '已禁用');
      loadRules();
    } catch (err) {
      message.error('操作失败');
    }
  };

  /** Send test notification */
  const handleTest = async (id: string) => {
    try {
      const result = await testIMNotificationRule(id);
      if (result.success) {
        message.success('测试通知已发送');
      } else {
        message.warning(`测试通知发送失败: ${result.message}`);
      }
    } catch (err) {
      message.error('测试通知发送失败');
    }
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: TableColumn<IMNotificationRule>[] = [
    {
      key: 'platform',
      title: '平台',
      dataIndex: 'platform',
      width: 130,
      render: (v: unknown) => {
        const platform = String(v) as string;
        const cfg = PLATFORM_CONFIG[platform] ?? { color: 'default', label: platform };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'webhookUrl',
      title: 'Webhook URL',
      dataIndex: 'webhookUrl',
      ellipsis: true,
      render: (v: unknown) => (
        <Text code style={{ fontSize: 12 }}>{String(v)}</Text>
      ),
    },
    {
      key: 'events',
      title: '订阅事件',
      dataIndex: 'events',
      width: 280,
      render: (v: unknown) => (
        <Space wrap>
          {(v as string[]).map((e) => (
            <Tag key={e} color="blue" style={{ fontSize: 11 }}>{e}</Tag>
          ))}
        </Space>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (v: unknown) =>
        v ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (v: unknown) => (v ? dayjs(String(v)).format('MM-DD HH:mm') : '—'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: IMNotificationRule) => (
        <Space size="small">
          <Tooltip title="测试">
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleTest(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.enabled ? '禁用' : '启用'}>
            <Switch
              size="small"
              checked={record.enabled}
              onChange={(checked) => handleToggle(record.id, checked)}
            />
          </Tooltip>
          <Popconfirm title="确认删除该 IM 通知规则?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建 IM 通知
        </Button>
      </div>

      <DataState
        loading={loading && rules.length === 0}
        error={error}
        empty={rules.length === 0 && !loading}
        emptyText="暂无 IM 通知规则"
        loadingText="加载 IM 通知规则..."
        retry={loadRules}
      >
        <Table columns={columns} dataSource={rules} loading={loading} rowKey="id" size="middle" striped />
      </DataState>

      {/* Create/Edit Modal */}
      <Modal
        title={editingRule ? '编辑 IM 通知规则' : '新建 IM 通知规则'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingRule(null); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="platform"
            label="IM 平台"
            rules={[{ required: true, message: '请选择 IM 平台' }]}
          >
            <Select options={PLATFORM_OPTIONS} placeholder="选择 IM 平台" />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如：研发群通知" />
          </Form.Item>
          <Form.Item
            name="webhookUrl"
            label="Webhook URL"
            rules={[{ required: true, message: '请输入 Webhook URL' }, { type: 'url' }]}
          >
            <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
          </Form.Item>
          <Form.Item
            name="events"
            label="订阅事件"
            rules={[{ required: true, message: '请选择至少一个事件' }]}
          >
            <Select
              mode="multiple"
              options={IM_EVENT_OPTIONS.map((e) => ({ label: e, value: e }))}
              placeholder="选择订阅事件"
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const NotificationRules: React.FC = () => {
  return (
    <div style={{ padding: 0 }}>
      {/* Header - always visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <BellOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            通知规则管理
          </Title>
          <Text type="secondary">管理平台 Webhook 与 IM 通知规则</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
          刷新
        </Button>
      </div>

      <Tabs defaultActiveKey="webhooks">
        <TabPane
          tab={
            <span>
              <LinkOutlined /> Webhooks
            </span>
          }
          key="webhooks"
        >
          <WebhookManagement />
        </TabPane>
        <TabPane
          tab={
            <span>
              <BellOutlined /> IM 通知
            </span>
          }
          key="im-notifications"
        >
          <IMNotificationsTab />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default NotificationRules;
