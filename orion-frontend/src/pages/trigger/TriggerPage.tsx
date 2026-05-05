/**
 * Multi-Modal Trigger Page
 * Phase 3 - Webhook management, event triggers, and trigger rules
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Tabs,
} from 'antd';
import {
  ThunderboltOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  type Webhook,
  type WebhookInput,
} from '@/api/webhook';

const { Title, Text } = Typography;

interface TriggerRule {
  id: string;
  name: string;
  eventType: string;
  condition: string;
  action: string;
  enabled: boolean;
  createdAt: string;
}

const mockRules: TriggerRule[] = [
  { id: 'tr1', name: 'Auto-deploy on Merge', eventType: 'git.push', condition: 'branch == main', action: 'trigger:deploy', enabled: true, createdAt: '2025-06-15' },
  { id: 'tr2', name: 'Alert on Build Fail', eventType: 'build.failed', condition: 'always', action: 'alert:team', enabled: true, createdAt: '2025-07-20' },
  { id: 'tr3', name: 'Rollback on High Error', eventType: 'monitor.threshold', condition: 'error_rate > 5%', action: 'action:rollback', enabled: false, createdAt: '2025-08-10' },
];

const TriggerPage: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [rules, setRules] = useState<TriggerRule[]>(mockRules);
  const [loading, setLoading] = useState(false);
  const [createWebhookModal, setCreateWebhookModal] = useState(false);
  const [webhookForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const webhookRes = await getWebhooks();
      setWebhooks((webhookRes.data as any)?.webhooks || []);
    } catch {
      message.error('Failed to load webhook data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async (values: WebhookInput) => {
    try {
      await createWebhook(values);
      message.success('Webhook created');
      setCreateWebhookModal(false);
      webhookForm.resetFields();
      loadData();
    } catch {
      message.error('Failed to create webhook');
    }
  };

  const handleToggleWebhook = async (id: string, currentEnabled: boolean) => {
    try {
      await updateWebhook(id, { enabled: !currentEnabled });
      message.success(currentEnabled ? 'Webhook disabled' : 'Webhook enabled');
      loadData();
    } catch {
      message.error('Failed to update webhook');
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      await testWebhook(id);
      message.success('Webhook test sent');
    } catch {
      message.error('Webhook test failed');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await deleteWebhook(id);
      message.success('Webhook deleted');
      loadData();
    } catch {
      message.error('Failed to delete webhook');
    }
  };

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    message.success('Rule toggled');
  };

  const webhookColumns = [
    { title: 'URL', dataIndex: 'url', key: 'url', ellipsis: true },
    {
      title: 'Events',
      dataIndex: 'events',
      key: 'events',
      render: (v: string[]) => v.map((e) => <Tag key={e}>{e}</Tag>),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: Webhook) => (
        <Tag color={record.enabled ? 'green' : 'default'}>{record.enabled ? 'Active' : 'Disabled'}</Tag>
      ),
    },
    {
      title: 'Last Status',
      dataIndex: 'lastStatus',
      key: 'lastStatus',
      render: (v: number) => v != null ? <Tag color={v < 300 ? 'green' : 'red'}>{v}</Tag> : '-',
    },
    { title: 'Failures', dataIndex: 'failureCount', key: 'failureCount' },
    { title: 'Last Triggered', dataIndex: 'lastTriggeredAt', key: 'lastTriggeredAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Webhook) => (
        <Space>
          <Button size="small" onClick={() => handleTestWebhook(record.id)}>Test</Button>
          <Button size="small" onClick={() => handleToggleWebhook(record.id, record.enabled)}>
            {record.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button size="small" danger onClick={() => handleDeleteWebhook(record.id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  const ruleColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Event', dataIndex: 'eventType', key: 'eventType', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Condition', dataIndex: 'condition', key: 'condition', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Action', dataIndex: 'action', key: 'action', render: (v: string) => <Tag color="green">{v}</Tag> },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: TriggerRule) => (
        <Button size="small" onClick={() => toggleRule(record.id)}>
          {record.enabled ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ];

  const totalTriggers = webhooks.reduce((s, w) => s + w.failureCount, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ThunderboltOutlined /> Multi-Modal Triggers
          </Title>
          <Text type="secondary">Webhooks, event triggers, and automation rules</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateWebhookModal(true)}>
            Add Webhook
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Webhooks" value={webhooks.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Active Webhooks" value={webhooks.filter((w) => w.enabled).length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Trigger Rules" value={rules.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Failures" value={totalTriggers} /></Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          defaultActiveKey="webhooks"
          items={[
            {
              key: 'webhooks',
              label: `Webhooks (${webhooks.length})`,
              children: (
                <Table columns={webhookColumns} dataSource={webhooks} rowKey="id" loading={loading} pagination={false} />
              ),
            },
            {
              key: 'rules',
              label: `Trigger Rules (${rules.length})`,
              children: (
                <Table columns={ruleColumns} dataSource={rules} rowKey="id" loading={loading} pagination={false} />
              ),
            },
          ]}
        />
      </Card>

      {/* Create Webhook Modal */}
      <Modal
        title="Create Webhook"
        open={createWebhookModal}
        onCancel={() => setCreateWebhookModal(false)}
        onOk={() => webhookForm.submit()}
        width={600}
      >
        <Form form={webhookForm} layout="vertical" onFinish={handleCreateWebhook}>
          <Form.Item label="URL" name="url" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://example.com/webhook" />
          </Form.Item>
          <Form.Item label="Events" name="events" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              placeholder="Select events"
              options={[
                { value: 'git.push', label: 'Git Push' },
                { value: 'git.pull_request', label: 'Pull Request' },
                { value: 'build.completed', label: 'Build Completed' },
                { value: 'build.failed', label: 'Build Failed' },
                { value: 'deploy.started', label: 'Deploy Started' },
                { value: 'deploy.completed', label: 'Deploy Completed' },
                { value: 'alert.triggered', label: 'Alert Triggered' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Secret (optional)" name="secret">
            <Input.Password placeholder="Webhook secret for HMAC verification" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TriggerPage;
