/**
 * Alert Config - Rule creation, severity levels, notification channels
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, DeleteOutlined, BellOutlined, DollarOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import { getAlerts, type CostAlert } from '@/api/ai-cost';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const severityColorMap: Record<string, string> = {
  info: 'blue',
  warning: 'orange',
  critical: 'red',
};

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  channels: string[];
  enabled: boolean;
}

const AlertConfig: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  // TODO: Alert rule CRUD requires backend API support
  const [rules, setRules] = useState<AlertRule[]>([
    {
      id: 'r1',
      name: '日费用超预算 80%',
      metric: 'daily_cost',
      operator: '>',
      threshold: 80,
      severity: 'warning',
      channels: ['dingtalk'],
      enabled: true,
    },
    {
      id: 'r2',
      name: '日费用超预算 95%',
      metric: 'daily_cost',
      operator: '>',
      threshold: 95,
      severity: 'critical',
      channels: ['dingtalk', 'email'],
      enabled: true,
    },
    {
      id: 'r3',
      name: 'Token 用量异常',
      metric: 'token_usage',
      operator: '>',
      threshold: 1000000,
      severity: 'info',
      channels: ['inapp'],
      enabled: true,
    },
  ]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await getAlerts();
      setAlerts(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setAlerts([]);
      message.error(`加载告警数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleCreateRule = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const newRule: AlertRule = {
        id: `r${rules.length + 1}`,
        name: values.name,
        metric: values.metric,
        operator: values.operator,
        threshold: values.threshold,
        severity: values.severity,
        channels: values.channels,
        enabled: true,
      };
      setRules((prev) => [...prev, newRule]);
      message.success('告警规则创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '创建失败';
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const alertColumns: TableColumn<CostAlert>[] = [
    {
      key: 'severity',
      title: '级别',
      dataIndex: 'severity',
      width: 80,
      render: (v: unknown) => <Tag color={severityColorMap[String(v)]}>{String(v)}</Tag>,
    },
    {
      key: 'message',
      title: '消息',
      dataIndex: 'message',
      width: 300,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'currentUsage',
      title: '当前使用',
      dataIndex: 'currentUsage',
      width: 100,
      render: (v: unknown) => <Text strong>{Number(v)}%</Text>,
    },
    {
      key: 'threshold',
      title: '阈值',
      dataIndex: 'threshold',
      width: 80,
      render: (v: unknown) => <Tag>{Number(v)}%</Tag>,
    },
    {
      key: 'createdAt',
      title: '触发时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: unknown) => <Text type="secondary">{dayjs(String(v)).fromNow()}</Text>,
    },
  ];

  const ruleColumns: TableColumn<AlertRule>[] = [
    {
      key: 'name',
      title: '规则名称',
      dataIndex: 'name',
      width: 200,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'metric',
      title: '指标',
      dataIndex: 'metric',
      width: 120,
      render: (v: unknown) => <Tag>{String(v)}</Tag>,
    },
    {
      key: 'condition',
      title: '条件',
      dataIndex: 'operator',
      width: 120,
      render: (_: unknown, record: any) => (
        <Text code>
          {record.operator} {record.threshold}
        </Text>
      ),
    },
    {
      key: 'severity',
      title: '级别',
      dataIndex: 'severity',
      width: 80,
      render: (v: unknown) => <Tag color={severityColorMap[String(v)]}>{String(v)}</Tag>,
    },
    {
      key: 'channels',
      title: '通知渠道',
      dataIndex: 'channels',
      width: 160,
      render: (v: unknown) => (
        <Space size={4}>{Array.isArray(v) ? v.map((c) => <Tag key={c}>{c}</Tag>) : null}</Space>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (v: unknown) => (
        <StatusBadge status={v ? 'success' : 'warning'} size="small" />
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: any) => (
        <Popconfirm
          title="确认删除?"
          onConfirm={() => setRules((prev) => prev.filter((r) => r.id !== record.id))}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const metricOptions = [
    { label: '日费用', value: 'daily_cost' },
    { label: 'Token 用量', value: 'token_usage' },
    { label: '请求数', value: 'request_count' },
    { label: '预算使用率', value: 'budget_usage' },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <DollarOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          告警设置
        </Title>
        <Text type="secondary">配置成本告警规则与通知</Text>
      </div>

      <Card
        title={
          <Space>
            <BellOutlined />
            活跃告警
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={alertColumns}
          dataSource={alerts}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      <Card
        title="告警规则"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建规则
          </Button>
        }
      >
        <Table columns={ruleColumns} dataSource={rules} rowKey="id" size="middle" striped loading={loading} />
      </Card>

      {/* Create Rule Modal */}
      <Modal
        title="创建告警规则"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreateRule}
        confirmLoading={submitting}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="日费用超预算告警" />
          </Form.Item>
          <Form.Item name="metric" label="监控指标" rules={[{ required: true }]}>
            <Select options={metricOptions} />
          </Form.Item>
          <Form.Item name="operator" label="操作符" rules={[{ required: true }]} initialValue=">">
            <Select
              options={[
                { label: '大于', value: '>' },
                { label: '小于', value: '<' },
                { label: '等于', value: '==' },
              ]}
            />
          </Form.Item>
          <Form.Item name="threshold" label="阈值" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="severity"
            label="告警级别"
            rules={[{ required: true }]}
            initialValue="warning"
          >
            <Select
              options={[
                { label: 'Info', value: 'info' },
                { label: 'Warning', value: 'warning' },
                { label: 'Critical', value: 'critical' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="channels"
            label="通知渠道"
            rules={[{ required: true }]}
            initialValue={['dingtalk']}
          >
            <Select
              mode="multiple"
              options={[
                { label: '钉钉', value: 'dingtalk' },
                { label: '企业微信', value: 'wecom' },
                { label: '飞书', value: 'feishu' },
                { label: '邮件', value: 'email' },
                { label: '站内', value: 'inapp' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AlertConfig;
