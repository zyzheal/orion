/**
 * Data Quality Platform Page
 * Data quality rules, checks, and monitoring dashboard
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Typography,
  message,
  Row,
  Col,
  Statistic,
  Progress,
  Tabs,
} from 'antd';
import {
  SafetyCertificateOutlined,
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  BugOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

interface QualityRule {
  id: string;
  name: string;
  table_name: string;
  column_name?: string;
  rule_type: 'not_null' | 'unique' | 'range' | 'regex' | 'custom' | 'freshness' | 'volume';
  config: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  last_check_at: string | null;
  last_status: 'pass' | 'fail' | 'error' | null;
  pass_rate: number;
}

interface QualityCheck {
  id: string;
  rule_id: string;
  rule_name: string;
  status: 'pass' | 'fail' | 'error';
  actual_value: string;
  expected_value: string;
  checked_at: string;
  details?: string;
}

const ruleTypeOptions = [
  { label: '非空检查', value: 'not_null' },
  { label: '唯一性检查', value: 'unique' },
  { label: '范围检查', value: 'range' },
  { label: '正则匹配', value: 'regex' },
  { label: '自定义 SQL', value: 'custom' },
  { label: '数据新鲜度', value: 'freshness' },
  { label: '数据量检查', value: 'volume' },
];

const severityConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  info: { color: 'blue', icon: <CheckCircleOutlined />, label: '信息' },
  warning: { color: 'orange', icon: <WarningOutlined />, label: '警告' },
  error: { color: 'red', icon: <CloseCircleOutlined />, label: '错误' },
  critical: { color: 'magenta', icon: <BugOutlined />, label: '严重' },
};

export default function DataQualityPage() {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');
  const [form] = Form.useForm();

  const fetchRules = async () => {
    setLoading(true);
    try {
      // TODO: integrate with data quality API
      setRules([]);
    } catch {
      message.error('获取规则失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchChecks = async () => {
    try {
      // TODO: integrate with data quality API
      setChecks([]);
    } catch {
      // silently handle
    }
  };

  useEffect(() => {
    fetchRules();
    fetchChecks();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      // TODO: integrate with data quality API
      message.success('规则创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchRules();
    } catch {
      message.error('创建失败');
    }
  };

  const ruleColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '数据表',
      dataIndex: 'table_name',
      key: 'table_name',
      render: (v: string) => <Tag icon={<DatabaseOutlined />}>{v}</Tag>,
    },
    {
      title: '列',
      dataIndex: 'column_name',
      key: 'column_name',
      render: (v: string) => v || '-',
    },
    {
      title: '规则类型',
      dataIndex: 'rule_type',
      key: 'rule_type',
      render: (v: string) => {
        const opt = ruleTypeOptions.find(o => o.value === v);
        return <Tag>{opt?.label || v}</Tag>;
      },
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: string) => {
        const cfg = severityConfig[v] || severityConfig.info;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: '通过率',
      dataIndex: 'pass_rate',
      key: 'pass_rate',
      render: (v: number) => (
        <Progress
          percent={v}
          size="small"
          strokeColor={v >= 90 ? colors.success[500] : v >= 70 ? colors.warning[500] : colors.error[500]}
          format={(p) => `${p}%`}
        />
      ),
    },
    {
      title: '最近状态',
      dataIndex: 'last_status',
      key: 'last_status',
      render: (v: string | null) => {
        if (!v) return <Text type="secondary">-</Text>;
        const cfg: Record<string, { color: string; label: string }> = {
          pass: { color: 'success', label: '通过' },
          fail: { color: 'error', label: '失败' },
          error: { color: 'warning', label: '异常' },
        };
        const c = cfg[v] || cfg.error;
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button size="small">运行</Button>
          <Button size="small">编辑</Button>
          <Button size="small" danger>删除</Button>
        </Space>
      ),
    },
  ];

  const checkColumns = [
    {
      title: '规则',
      dataIndex: 'rule_name',
      key: 'rule_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const cfg: Record<string, { color: string; label: string }> = {
          pass: { color: 'success', label: '通过' },
          fail: { color: 'error', label: '失败' },
          error: { color: 'warning', label: '异常' },
        };
        const c = cfg[v] || cfg.error;
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: '实际值',
      dataIndex: 'actual_value',
      key: 'actual_value',
    },
    {
      title: '期望值',
      dataIndex: 'expected_value',
      key: 'expected_value',
    },
    {
      title: '检查时间',
      dataIndex: 'checked_at',
      key: 'checked_at',
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
  ];

  const totalRules = rules.length;
  const passingRules = rules.filter(r => r.last_status === 'pass').length;
  const failingRules = rules.filter(r => r.last_status === 'fail').length;
  const avgPassRate = totalRules > 0 ? Math.round(rules.reduce((s, r) => s + r.pass_rate, 0) / totalRules) : 0;

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数据质量平台
      </Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="质量规则" value={totalRules} prefix={<SafetyCertificateOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="通过规则" value={passingRules} prefix={<CheckCircleOutlined />} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="失败规则" value={failingRules} prefix={<CloseCircleOutlined />} valueStyle={{ color: colors.error[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均通过率" value={avgPassRate} suffix="%" valueStyle={{ color: avgPassRate >= 90 ? colors.success[500] : colors.warning[500] }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'rules',
              label: '质量规则',
              children: (
                <Card
                  extra={
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={fetchRules}>刷新</Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
                        新建规则
                      </Button>
                    </Space>
                  }
                >
                  <Table dataSource={rules} columns={ruleColumns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
                </Card>
              ),
            },
            {
              key: 'checks',
              label: '检查历史',
              children: (
                <Card>
                  <Table dataSource={checks} columns={checkColumns} rowKey="id" pagination={{ pageSize: 20 }} />
                </Card>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="新建质量规则"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ severity: 'warning', rule_type: 'not_null' }}
        >
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如：用户表邮箱非空检查" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="table_name" label="数据表" rules={[{ required: true }]}>
                <Input placeholder="table_name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="column_name" label="列名">
                <Input placeholder="column_name (可选)" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rule_type" label="规则类型" rules={[{ required: true }]}>
                <Select options={ruleTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="严重程度" rules={[{ required: true }]}>
                <Select options={Object.entries(severityConfig).map(([k, v]) => ({ label: v.label, value: k }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
