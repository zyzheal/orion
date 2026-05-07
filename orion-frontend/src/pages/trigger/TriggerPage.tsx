/**
 * Multi-Modal Trigger Page
 * Phase 3 - Webhook management, event triggers, and trigger rules
 *
 * Features:
 * - Webhook CRUD with test and HMAC verification
 * - Trigger management (webhook, chat, schedule, event, manual)
 * - Trigger statistics and execution history
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
import {
  triggersApi,
  type Trigger,
  type TriggerStats,
} from '@/api/triggers';

const { Title, Text } = Typography;

const typeColorMap: Record<string, string> = {
  webhook: 'blue',
  chat: 'green',
  schedule: 'orange',
  event: 'purple',
  manual: 'default',
};

const typeLabelMap: Record<string, string> = {
  webhook: 'Webhook',
  chat: 'Chat',
  schedule: '定时',
  event: '事件',
  manual: '手动',
};

const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
};

const statusLabelMap: Record<string, string> = {
  active: '活跃',
  inactive: '未激活',
};

const TriggerPage: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [triggerStats, setTriggerStats] = useState<TriggerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [createWebhookModal, setCreateWebhookModal] = useState(false);
  const [createTriggerModal, setCreateTriggerModal] = useState(false);
  const [webhookForm] = Form.useForm();
  const [triggerForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [webhooksRes, triggersRes, statsRes] = await Promise.allSettled([
        getWebhooks(),
        triggersApi.listTriggers(),
        triggersApi.getTriggerStats(),
      ]);

      if (webhooksRes.status === 'fulfilled') {
        setWebhooks((webhooksRes.value.data as any)?.webhooks || []);
      }
      if (triggersRes.status === 'fulfilled') {
        setTriggers(Array.isArray(triggersRes.value) ? triggersRes.value : []);
      }
      if (statsRes.status === 'fulfilled') {
        setTriggerStats(statsRes.value);
      }
    } catch (error: unknown) {
      message.error(`加载触发器数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // Webhook handlers
  const handleCreateWebhook = async (values: WebhookInput) => {
    try {
      await createWebhook(values);
      message.success('Webhook 创建成功');
      setCreateWebhookModal(false);
      webhookForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建 Webhook 失败: ${(error as Error).message}`);
    }
  };

  const handleToggleWebhook = async (id: string, currentEnabled: boolean) => {
    try {
      await updateWebhook(id, { enabled: !currentEnabled });
      message.success(currentEnabled ? 'Webhook 已禁用' : 'Webhook 已启用');
      loadData();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      await testWebhook(id);
      message.success('Webhook 测试已发送');
    } catch (error: unknown) {
      message.error(`Webhook 测试失败: ${(error as Error).message}`);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await deleteWebhook(id);
      message.success('Webhook 已删除');
      loadData();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  // Trigger handlers
  const handleCreateTrigger = async (values: any) => {
    try {
      await triggersApi.registerTrigger({
        name: values.name,
        type: values.type,
        target: {
          pipelineId: values.pipelineId || undefined,
          action: values.action || undefined,
        },
        config: {
          condition: values.condition || 'always',
          ...values.config,
        },
      });
      message.success('触发器创建成功');
      setCreateTriggerModal(false);
      triggerForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建触发器失败: ${(error as Error).message}`);
    }
  };

  const handleExecuteTrigger = async (id: string) => {
    try {
      await triggersApi.executePipeline(id);
      message.success('触发器执行成功');
      loadData();
    } catch (error: unknown) {
      message.error(`执行失败: ${(error as Error).message}`);
    }
  };

  // Stats
  const successRate = triggerStats?.successRate ? `${(triggerStats.successRate * 100).toFixed(1)}%` : '-';

  // Webhook columns
  const webhookColumns = [
    { title: 'URL', dataIndex: 'url', key: 'url', ellipsis: true, width: 300 },
    {
      title: '事件',
      dataIndex: 'events',
      key: 'events',
      width: 200,
      render: (v: string[]) => (v || []).slice(0, 3).map((e: string) => <Tag key={e}>{e}</Tag>),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: Webhook) => (
        <Tag color={record.enabled ? 'green' : 'default'}>
          {record.enabled ? '活跃' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '最后状态码',
      dataIndex: 'lastStatus',
      key: 'lastStatus',
      width: 100,
      render: (v: number) => v != null ? <Tag color={v < 300 ? 'green' : 'red'}>{v}</Tag> : '-',
    },
    { title: '失败次数', dataIndex: 'failureCount', key: 'failureCount', width: 80 },
    { title: '最后触发', dataIndex: 'lastTriggeredAt', key: 'lastTriggeredAt', width: 160 },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: Webhook) => (
        <Space size="small">
          <Button size="small" onClick={() => handleTestWebhook(record.id)}>测试</Button>
          <Button size="small" onClick={() => handleToggleWebhook(record.id, record.enabled)}>
            {record.enabled ? '禁用' : '启用'}
          </Button>
          <Button size="small" danger onClick={() => handleDeleteWebhook(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  // Trigger columns
  const triggerColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => <Tag color={typeColorMap[v]}>{typeLabelMap[v]}</Tag>,
    },
    {
      title: '目标',
      key: 'target',
      width: 160,
      render: (_: unknown, record: Trigger) => {
        const parts: string[] = [];
        if (record.target?.pipelineId) parts.push(`Pipeline: ${record.target.pipelineId.slice(0, 8)}...`);
        if (record.target?.action) parts.push(record.target.action);
        return parts.join(' | ') || '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => <Tag color={statusColorMap[v]}>{statusLabelMap[v]}</Tag>,
    },
    { title: '触发次数', dataIndex: 'triggerCount', key: 'triggerCount', width: 80 },
    {
      title: '最后触发',
      dataIndex: 'lastTriggeredAt',
      key: 'lastTriggeredAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: Trigger) => (
        <Button
          size="small"
          type="primary"
          disabled={record.status === 'inactive'}
          onClick={() => handleExecuteTrigger(record.id)}
        >
          执行
        </Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'webhooks',
      label: `Webhooks (${webhooks.length})`,
      children: (
        <Table
          columns={webhookColumns}
          dataSource={webhooks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'triggers',
      label: `触发器 (${triggers.length})`,
      children: (
        <Table
          columns={triggerColumns}
          dataSource={triggers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ThunderboltOutlined style={{ marginRight: 8 }} />
            多模态触发器
          </Title>
          <Text type="secondary">Webhook 管理、事件触发器和自动化规则</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setCreateWebhookModal(true)}>
            添加 Webhook
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateTriggerModal(true)}>
            添加触发器
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Webhooks" value={webhooks.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃 Webhook"
              value={webhooks.filter((w) => w.enabled).length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="触发器" value={triggers.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功率"
              value={successRate}
              valueStyle={{
                color: triggerStats && triggerStats.successRate >= 0.9 ? '#52c41a' : '#faad14',
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* Create Webhook Modal */}
      <Modal
        title="创建 Webhook"
        open={createWebhookModal}
        onCancel={() => setCreateWebhookModal(false)}
        onOk={() => webhookForm.submit()}
        width={600}
      >
        <Form form={webhookForm} layout="vertical" onFinish={handleCreateWebhook}>
          <Form.Item label="URL" name="url" rules={[{ required: true, type: 'url', message: '请输入有效 URL' }]}>
            <Input placeholder="https://example.com/webhook" />
          </Form.Item>
          <Form.Item label="事件" name="events" rules={[{ required: true, message: '请选择事件' }]}>
            <Select
              mode="multiple"
              placeholder="选择事件"
              options={[
                { value: 'git.push', label: 'Git Push' },
                { value: 'git.pull_request', label: 'Pull Request' },
                { value: 'build.completed', label: '构建完成' },
                { value: 'build.failed', label: '构建失败' },
                { value: 'deploy.started', label: '部署开始' },
                { value: 'deploy.completed', label: '部署完成' },
                { value: 'alert.triggered', label: '告警触发' },
              ]}
            />
          </Form.Item>
          <Form.Item label="密钥 (可选)" name="secret">
            <Input.Password placeholder="用于 HMAC 验证的密钥" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Trigger Modal */}
      <Modal
        title="创建触发器"
        open={createTriggerModal}
        onCancel={() => setCreateTriggerModal(false)}
        onOk={() => triggerForm.submit()}
        width={600}
      >
        <Form form={triggerForm} layout="vertical" onFinish={handleCreateTrigger}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="触发器名称" />
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]} initialValue="webhook">
            <Select
              options={[
                { value: 'webhook', label: 'Webhook' },
                { value: 'chat', label: 'Chat' },
                { value: 'schedule', label: '定时触发' },
                { value: 'event', label: '事件触发' },
                { value: 'manual', label: '手动触发' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Pipeline ID" name="pipelineId">
            <Input placeholder="目标 Pipeline ID" />
          </Form.Item>
          <Form.Item label="动作" name="action" initialValue="deploy">
            <Select
              options={[
                { label: '部署 (deploy)', value: 'deploy' },
                { label: '构建 (build)', value: 'build' },
                { label: '回滚 (rollback)', value: 'rollback' },
                { label: '测试 (test)', value: 'test' },
              ]}
            />
          </Form.Item>
          <Form.Item label="触发条件" name="condition" initialValue="always">
            <Input placeholder="如: branch == main" />
          </Form.Item>
          <Form.Item label="Cron 表达式 (定时类型)" name="cronExpression">
            <Input placeholder="如: 0 */4 * * *" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TriggerPage;
