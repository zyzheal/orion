/**
 * Middleware Operations Page (Phase 4 - Middleware Operations)
 * Middleware health monitoring, connection pool management, message queue tracking
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Table, Button, Tag, Space, Tabs, message,
  Modal, Form, Input, Select, Popconfirm, Card, Row, Col, Statistic, Progress,
} from 'antd';
import {
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
  LinkOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  createMiddlewareInstance, listMiddlewareInstances, deleteMiddlewareInstance,
  listConnectionPools,
  listMqStats,
  listMiddlewareAlerts, deleteMiddlewareAlert,
  getMiddlewareHealthSummary,
  type MiddlewareInstance, type ConnectionPool, type MessageQueueStats, type MiddlewareAlert,
} from '@/api/middleware-ops';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// ============================================================================
// Instances Tab
// ============================================================================

const InstancesTab: React.FC = () => {
  const [instances, setInstances] = useState<MiddlewareInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listMiddlewareInstances();
      setInstances((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载中间件实例失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createMiddlewareInstance({
        name: values.name, type: values.type,
        host: values.host, port: parseInt(values.port),
        version: values.version,
      });
      message.success('实例创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMiddlewareInstance(id);
      message.success('删除成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const typeColorMap: Record<string, string> = {
    redis: colors.error[500],
    kafka: colors.primary[500],
    rabbitmq: colors.success[500],
    mysql: colors.info[500],
    postgresql: colors.purple[500],
    elasticsearch: colors.warning[500],
    mongodb: colors.success[500],
    nginx: colors.neutral[400],
  };

  const statusColorMap: Record<string, string> = {
    healthy: colors.success[500],
    degraded: colors.warning[500],
    unhealthy: colors.error[500],
    unknown: colors.neutral[400],
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型', dataIndex: 'type', key: 'type',
      render: (t: string) => <Tag color={typeColorMap[t]}>{t}</Tag>,
    },
    { title: '地址', dataIndex: 'host', key: 'host', render: (h: string, r: MiddlewareInstance) => `${h}:${r.port}` },
    { title: '版本', dataIndex: 'version', key: 'version', render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: MiddlewareInstance) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
          <Button size="small" type="link" danger>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            中间件实例
          </Title>
          <Text type="secondary">管理 Redis/Kafka/MySQL/RabbitMQ 等中间件实例</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>添加实例</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={instances} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="添加中间件实例" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input placeholder="实例名称" /></Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="redis">Redis</Select.Option>
              <Select.Option value="kafka">Kafka</Select.Option>
              <Select.Option value="rabbitmq">RabbitMQ</Select.Option>
              <Select.Option value="mysql">MySQL</Select.Option>
              <Select.Option value="postgresql">PostgreSQL</Select.Option>
              <Select.Option value="elasticsearch">Elasticsearch</Select.Option>
              <Select.Option value="mongodb">MongoDB</Select.Option>
              <Select.Option value="nginx">Nginx</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="主机" name="host" rules={[{ required: true }]}><Input placeholder="localhost" /></Form.Item>
          <Form.Item label="端口" name="port" rules={[{ required: true }]}><Input type="number" placeholder="6379" /></Form.Item>
          <Form.Item label="版本" name="version"><Input placeholder="7.0.0" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Connection Pools Tab
// ============================================================================

const ConnectionPoolsTab: React.FC = () => {
  const [pools, setPools] = useState<ConnectionPool[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listConnectionPools();
      setPools((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载连接池失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const columns = [
    { title: '中间件 ID', dataIndex: 'middlewareId', key: 'middlewareId', ellipsis: true },
    { title: '连接池', dataIndex: 'poolName', key: 'poolName' },
    { title: '活跃', dataIndex: 'active', key: 'active', render: (v: number, r: ConnectionPool) => <span style={{ color: v / r.max > 0.8 ? colors.error[500] : colors.neutral[900] }}>{v}</span> },
    { title: '空闲', dataIndex: 'idle', key: 'idle' },
    { title: '最大', dataIndex: 'max', key: 'max' },
    { title: '等待', dataIndex: 'waiting', key: 'waiting', render: (v: number) => <span style={{ color: v > 0 ? colors.error[500] : colors.success[500] }}>{v}</span> },
    {
      title: '使用率', key: 'utilization',
      render: (_: any, r: ConnectionPool) => (
        <Progress percent={Math.round((r.active / r.max) * 100)} size="small" status={(r.active / r.max) > 0.8 ? 'exception' : 'normal'} style={{ width: 80 }} />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <LinkOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            连接池监控
          </Title>
          <Text type="secondary">各中间件连接池使用情况</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>
      <Table columns={columns} dataSource={pools} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ============================================================================
// Message Queues Tab
// ============================================================================

const MessageQueuesTab: React.FC = () => {
  const [mqStats, setMqStats] = useState<MessageQueueStats[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listMqStats();
      setMqStats((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载消息队列数据失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const columns = [
    { title: '中间件 ID', dataIndex: 'middlewareId', key: 'middlewareId', ellipsis: true },
    { title: '队列名称', dataIndex: 'queueName', key: 'queueName' },
    { title: '消息数', dataIndex: 'messageCount', key: 'messageCount', render: (v: number) => <span style={{ color: v > 10000 ? colors.error[500] : colors.neutral[900] }}>{v.toLocaleString()}</span> },
    { title: '消费者', dataIndex: 'consumerCount', key: 'consumerCount' },
    { title: '消息/秒', dataIndex: 'messagesPerSecond', key: 'messagesPerSecond' },
    { title: '平均延迟', dataIndex: 'avgLatencyMs', key: 'avgLatencyMs', render: (v: number) => `${v.toFixed(0)} ms` },
    { title: '死信数', dataIndex: 'deadLetterCount', key: 'deadLetterCount', render: (v: number) => <span style={{ color: v > 0 ? colors.error[500] : colors.success[500] }}>{v}</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            消息队列
          </Title>
          <Text type="secondary">Kafka/RabbitMQ 消息队列监控</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>
      <Table columns={columns} dataSource={mqStats} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ============================================================================
// Alerts Tab
// ============================================================================

const AlertsTab: React.FC = () => {
  const [alerts, setAlerts] = useState<MiddlewareAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listMiddlewareAlerts();
      setAlerts((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载告警失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteMiddlewareAlert(id);
      message.success('告警已清除');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const severityColorMap: Record<string, string> = {
    critical: colors.error[500],
    warning: colors.warning[500],
    info: colors.info[500],
  };

  const columns = [
    { title: '中间件', dataIndex: 'middlewareName', key: 'middlewareName' },
    { title: '类型', dataIndex: 'alertType', key: 'alertType', render: (t: string) => t.replace(/_/g, ' ') },
    {
      title: '级别', dataIndex: 'severity', key: 'severity',
      render: (s: string) => <Tag color={severityColorMap[s]}>{s}</Tag>,
    },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: '当前值', dataIndex: 'value', key: 'value', render: (v: number) => v.toFixed(1) },
    { title: '阈值', dataIndex: 'threshold', key: 'threshold' },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: MiddlewareAlert) => (
        <Popconfirm title="确认清除？" onConfirm={() => handleDelete(record.id)}>
          <Button size="small" type="link" danger>清除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <WarningOutlined style={{ marginRight: 12, color: colors.error[500] }} />
            中间件告警
          </Title>
          <Text type="secondary">连接池耗尽/消息积压/高延迟等告警</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>
      <Table columns={columns} dataSource={alerts} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const MiddlewareOpsPage: React.FC = () => {
  const [healthSummary, setHealthSummary] = useState<{
    totalInstances: number; healthyCount: number; degradedCount: number;
    unhealthyCount: number; totalAlerts: number; criticalAlerts: number; healthScore: number;
  } | null>(null);

  const loadHealth = async () => {
    try {
      const res = await getMiddlewareHealthSummary();
      setHealthSummary((res.data as any).data || null);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadHealth(); }, []);

  const tabItems = [
    { key: 'instances', label: '中间件实例', children: <InstancesTab /> },
    { key: 'pools', label: '连接池', children: <ConnectionPoolsTab /> },
    { key: 'queues', label: '消息队列', children: <MessageQueuesTab /> },
    { key: 'alerts', label: '告警', children: <AlertsTab /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Health Summary */}
      {healthSummary && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col span={8}>
              <Title level={3} style={{ marginBottom: 16 }}>
                <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
                中间件健康总览
              </Title>
            </Col>
            <Col span={3}>
              <Statistic title="总实例数" value={healthSummary.totalInstances} />
            </Col>
            <Col span={3}>
              <Statistic title="健康" value={healthSummary.healthyCount} valueStyle={{ color: colors.success[500] }} />
            </Col>
            <Col span={3}>
              <Statistic title="降级" value={healthSummary.degradedCount} valueStyle={{ color: colors.warning[500] }} />
            </Col>
            <Col span={3}>
              <Statistic title="异常" value={healthSummary.unhealthyCount} valueStyle={{ color: colors.error[500] }} />
            </Col>
            <Col span={4}>
              <Statistic title="健康评分" value={healthSummary.healthScore} suffix="/ 100" valueStyle={{ color: healthSummary.healthScore >= 80 ? colors.success[500] : healthSummary.healthScore >= 60 ? colors.warning[500] : colors.error[500] }} />
            </Col>
          </Row>
        </Card>
      )}

      <Tabs defaultActiveKey="instances" items={tabItems} size="large" />
    </div>
  );
};

export default MiddlewareOpsPage;
