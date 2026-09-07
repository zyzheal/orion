/**
 * Monitoring Channels Page
 * Manage notification channels (email, webhook, slack) and escalation policies
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tabs,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, MailOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import {
  getChannels,
  createChannel,
  toggleChannel,
  getEscalationPolicies,
  createEscalationPolicy,
} from '@/api/monitoring';
import type { NotificationChannel, EscalationPolicy } from '@/api/monitoring';
import { useQuery } from '@/providers/QueryProvider';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const typeConfig: Record<string, { color: string; label: string; icon: string }> = {
  email: { color: 'blue', label: 'Email', icon: '📧' },
  webhook: { color: 'green', label: 'Webhook', icon: '🔗' },
  slack: { color: 'purple', label: 'Slack', icon: '💬' },
};

const MonitoringChannels: React.FC = () => {
  const [channelModalVisible, setChannelModalVisible] = useState(false);
  const [escalationModalVisible, setEscalationModalVisible] = useState(false);
  const [channelForm] = Form.useForm();
  const [escalationForm] = Form.useForm();

  const {
    data: channelData = { channels: [], escalationPolicies: [] } as {
      channels: NotificationChannel[];
      escalationPolicies: EscalationPolicy[];
    },
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['monitoring-channels'],
    queryFn: () =>
      Promise.all([getChannels(), getEscalationPolicies()]).then(([chRes, escRes]) => ({
        channels: Array.isArray(chRes.data) ? chRes.data : [],
        escalationPolicies: Array.isArray(escRes.data) ? escRes.data : [],
      })),
    staleTime: 30_000,
  });
  const channels = channelData.channels;
  const escalationPolicies = channelData.escalationPolicies;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError)
      message.error(
        queryError instanceof Error
          ? `加载通知渠道失败：${queryError.message}`
          : '加载通知渠道失败，请稍后重试'
      );
  }, [isError, queryError]);

  const handleCreateChannel = async (values: any) => {
    try {
      let config: Record<string, string> = {};
      if (typeof values.config === 'string') {
        config = JSON.parse(values.config);
      } else if (values.config) {
        config = values.config;
      }
      await createChannel({ ...values, config, enabled: values.enabled ?? true });
      message.success('通知渠道已创建');
      setChannelModalVisible(false);
      channelForm.resetFields();
      refetch();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建通知渠道失败：${error.message}`);
      } else {
        message.error('创建通知渠道失败，请稍后重试');
      }
    }
  };

  const handleToggleChannel = async (id: string) => {
    try {
      await toggleChannel(id);
      message.success('渠道状态已切换');
      refetch();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`切换渠道状态失败：${error.message}`);
      } else {
        message.error('切换渠道状态失败，请稍后重试');
      }
    }
  };

  const handleCreateEscalation = async (values: any) => {
    try {
      let steps: any[] = [];
      if (typeof values.steps === 'string') {
        steps = JSON.parse(values.steps);
      } else if (values.steps) {
        steps = values.steps;
      }
      await createEscalationPolicy({ ...values, steps, enabled: values.enabled ?? true });
      message.success('升级策略已创建');
      setEscalationModalVisible(false);
      escalationForm.resetFields();
      refetch();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建升级策略失败：${error.message}`);
      } else {
        message.error('创建升级策略失败，请稍后重试');
      }
    }
  };

  const channelColumns: TableColumn<NotificationChannel>[] = useMemo<
    TableColumn<NotificationChannel>[]
  >(
    () => [
      {
        key: 'name',
        title: '渠道名称',
        dataIndex: 'name',
        sortable: true,
        filterable: true,
        render: (v: unknown) => <Text strong>{String(v)}</Text>,
      },
      {
        key: 'type',
        title: '类型',
        dataIndex: 'type',
        width: 100,
        render: (v: unknown) => {
          const cfg = typeConfig[String(v)];
          return (
            <Tag color={cfg.color}>
              {cfg.icon} {cfg.label}
            </Tag>
          );
        },
      },
      {
        key: 'config',
        title: '配置',
        dataIndex: 'config',
        render: (v: unknown) => (
          <Text
            code
            style={{
              fontSize: spacing[2],
              maxWidth: 300,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {JSON.stringify(v)}
          </Text>
        ),
      },
      {
        key: 'enabled',
        title: '状态',
        dataIndex: 'enabled',
        width: 80,
        render: (v: unknown) => (
          <Tag color={v ? 'green' : 'default'}>{v ? '已启用' : '已禁用'}</Tag>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: 100,
        render: (_, record: NotificationChannel) => (
          <Switch
            checked={record.enabled}
            onChange={() => handleToggleChannel(record.id)}
            checkedChildren="开"
            unCheckedChildren="关"
            size="small"
          />
        ),
      },
    ],
    []
  );

  const escalationColumns: TableColumn<EscalationPolicy>[] = useMemo<
    TableColumn<EscalationPolicy>[]
  >(
    () => [
      {
        key: 'name',
        title: '策略名称',
        dataIndex: 'name',
        sortable: true,
        render: (v: unknown) => <Text strong>{String(v)}</Text>,
      },
      {
        key: 'steps',
        title: '升级步骤',
        dataIndex: 'steps',
        render: (v: unknown) => (
          <Space>
            {(v as Array<unknown>).map((step: any, idx) => (
              <Tag key={String(idx)} color="blue">
                #{step.order} → {step.channel} ({step.delayMs}ms)
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        key: 'enabled',
        title: '状态',
        dataIndex: 'enabled',
        width: 80,
        render: (v: unknown) => (
          <Tag color={v ? 'green' : 'default'}>{v ? '已启用' : '已禁用'}</Tag>
        ),
      },
    ],
    []
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <MailOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            通知渠道
          </Title>
          <Text type="secondary">管理告警通知渠道与升级策略</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={loading}>
          刷新
        </Button>
      </div>

      <Tabs defaultActiveKey="channels">
        <TabPane tab={`通知渠道 (${channels.length})`} key="channels">
          <div style={{ marginBottom: spacing.md, textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setChannelModalVisible(true)}
            >
              创建渠道
            </Button>
          </div>
          <Table
            columns={channelColumns}
            dataSource={channels}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
          />
        </TabPane>
        <TabPane tab={`升级策略 (${escalationPolicies.length})`} key="escalation">
          <div style={{ marginBottom: spacing.md, textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setEscalationModalVisible(true)}
            >
              创建策略
            </Button>
          </div>
          <Table
            columns={escalationColumns}
            dataSource={escalationPolicies}
            loading={loading}
            rowKey="id"
            size="middle"
            striped
          />
        </TabPane>
      </Tabs>

      {/* Channel Modal */}
      <Modal
        title="创建通知渠道"
        open={channelModalVisible}
        onCancel={() => setChannelModalVisible(false)}
        footer={null}
        width={480}
      >
        <Form form={channelForm} layout="vertical" onFinish={handleCreateChannel}>
          <Form.Item
            name="name"
            label="渠道名称"
            rules={[{ required: true, message: '请输入渠道名称' }]}
          >
            <Input placeholder="例如：team-email" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={[
                { label: 'Email', value: 'email' },
                { label: 'Webhook', value: 'webhook' },
                { label: 'Slack', value: 'slack' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="config"
            label="配置 (JSON)"
            rules={[{ required: true, message: '请输入配置' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder='email: {"to": "team@example.com"}\nwebhook: {"url": "https://hooks..."}\nslack: {"channel": "#alerts", "webhook_url": "..."}'
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Escalation Policy Modal */}
      <Modal
        title="创建升级策略"
        open={escalationModalVisible}
        onCancel={() => setEscalationModalVisible(false)}
        footer={null}
        width={560}
      >
        <Form form={escalationForm} layout="vertical" onFinish={handleCreateEscalation}>
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="例如：critical-escalation" />
          </Form.Item>
          <Form.Item
            name="steps"
            label="升级步骤 (JSON)"
            rules={[{ required: true, message: '请输入升级步骤' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder='[{"order": 1, "channel": "email-alerts", "delayMs": 300000}, {"order": 2, "channel": "slack-oncall", "delayMs": 900000}]'
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MonitoringChannels;
