/**
 * ObservabilityPage (Phase 2)
 * 全栈可观测性页 - 自定义告警规则、根因分析、静默规则管理
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Tabs,
  Table,
  Tag,
  Space,
  Button,
  Form,
  Input,
  Select,
  message,
  Descriptions,
  Modal,
  Switch,
  DatePicker,
  Row,
  Col,
  Timeline,
  Progress,
} from 'antd';
import {
  EyeOutlined,
  ReloadOutlined,
  BellOutlined,
  SafetyOutlined,
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
  getSilenceRules,
  createSilenceRule,
  deleteSilenceRule,
  getRootCauseAnalyses,
  triggerRCA,
  getRootCauseAnalysis,
  getServiceHealth,
  type AlertRule as AlertRuleType,
  type AlertRuleInput,
  type SilenceRule as SilenceRuleType,
  type SilenceRuleInput,
  type RootCauseAnalysis as RCAType,
  type ServiceHealth,
} from '@/api/observability';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ---- Color maps ----

const severityColorMap: Record<string, string> = {
  critical: 'error',
  warning: 'warning',
  info: 'blue',
};

const healthColorMap: Record<string, string> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
};

// ---- Alert Rules Tab ----

const AlertRulesTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<AlertRuleType[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRuleType | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await getAlertRules();
      setRules(res.data?.data?.rules || []);
    } catch (error: unknown) {
      message.error(`加载告警规则失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const openCreateModal = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ duration: '5m', severity: 'warning' });
    setModalVisible(true);
  };

  const openEditModal = (rule: AlertRuleType) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      duration: rule.duration,
      severity: rule.severity,
      summary: rule.annotations?.summary,
      description: rule.annotations?.description,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: AlertRuleInput = {
        name: values.name,
        metric: values.metric,
        condition: values.condition,
        threshold: values.threshold,
        duration: values.duration,
        severity: values.severity,
        annotations: values.summary
          ? { summary: values.summary, description: values.description || '' }
          : undefined,
      };

      if (editingRule) {
        await updateAlertRule(editingRule.id, payload);
        message.success('告警规则已更新');
      } else {
        await createAlertRule(payload);
        message.success('告警规则已创建');
      }
      setModalVisible(false);
      loadRules();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`操作失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (ruleId: string) => {
    try {
      await toggleAlertRule(ruleId);
      message.success('规则状态已切换');
      loadRules();
    } catch (error: unknown) {
      message.error(`切换失败: ${(error as Error).message}`);
    }
  };

  const handleDelete = async (ruleId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      onOk: async () => {
        try {
          await deleteAlertRule(ruleId);
          message.success('告警规则已删除');
          loadRules();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const conditionLabels: Record<string, string> = {
    gt: '>',
    lt: '<',
    eq: '==',
    gte: '>=',
    lte: '<=',
    neq: '!=',
  };

  const columns = [
    { title: '规则名称', dataIndex: 'name', key: 'name', width: 180, render: (v: string) => <Text strong>{v}</Text> },
    { title: '指标', dataIndex: 'metric', key: 'metric', width: 140 },
    {
      title: '条件',
      key: 'condition',
      width: 100,
      render: (_: unknown, record: AlertRuleType) => (
        <Tag>{conditionLabels[record.condition] || record.condition} {record.threshold}</Tag>
      ),
    },
    { title: '持续时间', dataIndex: 'duration', key: 'duration', width: 80 },
    {
      title: '严重度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (v: string) => <Tag color={severityColorMap[v]}>{v}</Tag>,
    },
    {
      title: '状态',
      key: 'enabled',
      width: 80,
      render: (_: unknown, record: AlertRuleType) => (
        <Switch checked={record.enabled} size="small" onChange={() => handleToggle(record.id)} />
      ),
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, record: AlertRuleType) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEditModal(record)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">管理和配置自定义告警规则</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRules} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>创建规则</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={rules} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10 }} />

      <Modal
        title={editingRule ? '编辑告警规则' : '创建告警规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如: CPU 使用率过高" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="metric" label="指标名称" rules={[{ required: true }]}>
                <Input placeholder="如: cpu_usage" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="condition" label="条件" rules={[{ required: true }]}>
                <Select options={[
                  { label: '> 大于', value: 'gt' },
                  { label: '< 小于', value: 'lt' },
                  { label: '>= 大于等于', value: 'gte' },
                  { label: '<= 小于等于', value: 'lte' },
                  { label: '== 等于', value: 'eq' },
                  { label: '!= 不等于', value: 'neq' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="threshold" label="阈值" rules={[{ required: true }]}>
                <Input type="number" placeholder="90" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="duration" label="持续时间">
                <Input placeholder="如: 5m, 10m, 1h" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="严重度" rules={[{ required: true }]}>
                <Select options={[
                  { label: 'Critical', value: 'critical' },
                  { label: 'Warning', value: 'warning' },
                  { label: 'Info', value: 'info' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="summary" label="告警摘要">
            <Input placeholder="简短描述告警触发原因" />
          </Form.Item>
          <Form.Item name="description" label="详细描述">
            <Input.TextArea rows={3} placeholder="详细描述告警条件和影响" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ---- Silence Rules Tab ----

const SilenceRulesTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<SilenceRuleType[]>([]);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await getSilenceRules();
      setRules(res.data?.data?.rules || []);
    } catch (error: unknown) {
      message.error(`加载静默规则失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const [start, end] = values.timeRange;
      const payload: SilenceRuleInput = {
        matchers: [
          { name: 'alertname', value: values.alertName, isRegex: false },
          ...(values.service ? [{ name: 'service', value: values.service, isRegex: false }] : []),
        ],
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        comment: values.comment,
      };
      await createSilenceRule(payload);
      message.success('静默规则已创建');
      setModalVisible(false);
      form.resetFields();
      loadRules();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteSilenceRule(ruleId);
      message.success('静默规则已删除');
      loadRules();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const columns = [
    {
      title: '匹配器',
      key: 'matchers',
      width: 240,
      render: (_: unknown, record: SilenceRuleType) => (
        <Space wrap>
          {record.matchers.map((m, i) => (
            <Tag key={i} color="blue">{m.name}="{m.value}"</Tag>
          ))}
        </Space>
      ),
    },
    { title: '开始时间', dataIndex: 'startsAt', key: 'startsAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    { title: '结束时间', dataIndex: 'endsAt', key: 'endsAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => <Tag color={v === 'active' ? 'success' : 'default'}>{v}</Tag>,
    },
    { title: '备注', dataIndex: 'comment', key: 'comment', ellipsis: true },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 120 },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: SilenceRuleType) => (
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">配置告警静默规则，在维护期间抑制告警通知</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRules} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>创建静默规则</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={rules} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10 }} />

      <Modal
        title="创建静默规则"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="alertName" label="告警名称" rules={[{ required: true }]}>
            <Input placeholder="要静默的告警名称" />
          </Form.Item>
          <Form.Item name="service" label="服务 (可选)">
            <Input placeholder="限定服务名称" />
          </Form.Item>
          <Form.Item name="timeRange" label="静默时间段" rules={[{ required: true }]}>
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="comment" label="备注" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="静默原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ---- Root Cause Analysis Tab ----

const RootCauseAnalysisTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [analyses, setAnalyses] = useState<RCAType[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<RCAType | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [triggerForm] = Form.useForm();
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAnalyses = async () => {
    setLoading(true);
    try {
      const res = await getRootCauseAnalyses();
      setAnalyses(res.data?.data?.analyses || []);
    } catch (error: unknown) {
      message.error(`加载根因分析列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, []);

  const handleTrigger = async () => {
    try {
      const values = await triggerForm.validateFields();
      setTriggerLoading(true);
      await triggerRCA({
        incidentId: values.incidentId,
        serviceIds: values.serviceIds
          ? (values.serviceIds as string).split(',').map((s: string) => s.trim())
          : undefined,
      });
      message.success('根因分析已触发');
      triggerForm.resetFields();
      loadAnalyses();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`触发失败: ${(error as Error).message}`);
      }
    } finally {
      setTriggerLoading(false);
    }
  };

  const viewDetail = async (analysis: RCAType) => {
    setSelectedAnalysis(analysis);
    setDrawerVisible(true);
    setDetailLoading(true);
    try {
      const res = await getRootCauseAnalysis(analysis.id);
      setSelectedAnalysis(res.data?.data || analysis);
    } catch {
      // fallback to existing data
    } finally {
      setDetailLoading(false);
    }
  };

  const statusColorMap: Record<string, string> = {
    analyzing: 'processing',
    completed: 'success',
    failed: 'error',
  };

  const columns = [
    { title: '事件 ID', dataIndex: 'incidentId', key: 'incidentId', width: 140 },
    { title: '开始时间', dataIndex: 'startTime', key: 'startTime', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    {
      title: '根因服务',
      key: 'rootCause',
      width: 140,
      render: (_: unknown, record: RCAType) => record.rootCause?.service || '-',
    },
    {
      title: '置信度',
      key: 'confidence',
      width: 100,
      render: (_: unknown, record: RCAType) =>
        record.rootCause ? `${Math.round(record.rootCause.confidence * 100)}%` : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: RCAType) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => viewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Trigger RCA */}
      <Card title="触发根因分析">
        <Form form={triggerForm} layout="inline" onFinish={handleTrigger}>
          <Form.Item name="incidentId" label="事件 ID" rules={[{ required: true }]}>
            <Input placeholder="如: INC-001" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="serviceIds" label="涉及服务 (逗号分隔)">
            <Input placeholder="如: api-gateway, auth-service" style={{ width: 280 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={triggerLoading} icon={<SearchOutlined />}>
              触发分析
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Analysis List */}
      <Card title="根因分析列表">
        <Table columns={columns} dataSource={analyses} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10 }} />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="根因分析详情"
        open={drawerVisible}
        onCancel={() => setDrawerVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {detailLoading ? (
          <PageSkeleton rows={4} />
        ) : selectedAnalysis ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="事件 ID">{selectedAnalysis.incidentId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedAnalysis.status]}>{selectedAnalysis.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{new Date(selectedAnalysis.startTime).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {selectedAnalysis.endTime ? new Date(selectedAnalysis.endTime).toLocaleString() : '进行中'}
              </Descriptions.Item>
            </Descriptions>

            {selectedAnalysis.rootCause && (
              <Card size="small" title="根因" style={{ borderLeft: `3px solid ${colors.error[400]}` }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="服务">{selectedAnalysis.rootCause.service}</Descriptions.Item>
                  <Descriptions.Item label="组件">{selectedAnalysis.rootCause.component}</Descriptions.Item>
                  <Descriptions.Item label="描述">{selectedAnalysis.rootCause.description}</Descriptions.Item>
                  <Descriptions.Item label="置信度">
                    <Progress
                      percent={Math.round(selectedAnalysis.rootCause.confidence * 100)}
                      size="small"
                      style={{ width: 120 }}
                    />
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {selectedAnalysis.contributingFactors && selectedAnalysis.contributingFactors.length > 0 && (
              <Card size="small" title="贡献因素">
                <Table
                  dataSource={selectedAnalysis.contributingFactors}
                  rowKey="service"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '服务', dataIndex: 'service', key: 'service' },
                    { title: '指标', dataIndex: 'metric', key: 'metric' },
                    {
                      title: '影响度',
                      dataIndex: 'impact',
                      key: 'impact',
                      render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" style={{ width: 100 }} />,
                    },
                    { title: '描述', dataIndex: 'description', key: 'description' },
                  ]}
                />
              </Card>
            )}

            {selectedAnalysis.timeline && selectedAnalysis.timeline.length > 0 && (
              <Card size="small" title="事件时间线">
                <Timeline>
                  {selectedAnalysis.timeline.map((item, i) => (
                    <Timeline.Item key={i}>
                      <Text strong>{item.service}</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </Text>
                      <div>{item.event}</div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}

            {selectedAnalysis.recommendations && selectedAnalysis.recommendations.length > 0 && (
              <Card size="small" title="建议措施">
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {selectedAnalysis.recommendations.map((r, i) => (
                    <li key={i}><Text>{r}</Text></li>
                  ))}
                </ul>
              </Card>
            )}
          </Space>
        ) : (
          <Text type="secondary">无法加载分析详情</Text>
        )}
      </Modal>
    </Space>
  );
};

// ---- Service Health Tab ----

const ServiceHealthTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceHealth[]>([]);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const res = await getServiceHealth();
      setServices(res.data?.data?.services || []);
    } catch (error: unknown) {
      message.error(`加载服务健康状态失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const columns = [
    { title: '服务名称', dataIndex: 'serviceName', key: 'serviceName', width: 180, render: (v: string) => <Text strong>{v}</Text> },
    {
      title: '健康状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => (
        <Tag color={healthColorMap[v]}>
          {v === 'healthy' ? '健康' : v === 'degraded' ? '降级' : '不可用'}
        </Tag>
      ),
    },
    { title: 'P50 延迟', key: 'p50', width: 100, render: (_: unknown, r: ServiceHealth) => `${r.latencyP50}ms` },
    { title: 'P95 延迟', key: 'p95', width: 100, render: (_: unknown, r: ServiceHealth) => `${r.latencyP95}ms` },
    { title: 'P99 延迟', key: 'p99', width: 100, render: (_: unknown, r: ServiceHealth) => `${r.latencyP99}ms` },
    {
      title: '错误率',
      key: 'errorRate',
      width: 100,
      render: (_: unknown, r: ServiceHealth) => (
        <Text style={{ color: r.errorRate > 5 ? colors.error[400] : colors.success[500] }}>
          {r.errorRate.toFixed(2)}%
        </Text>
      ),
    },
    { title: '请求速率', key: 'requestRate', width: 120, render: (_: unknown, r: ServiceHealth) => `${r.requestRate.toFixed(1)} req/s` },
    {
      title: '饱和度',
      key: 'saturation',
      width: 120,
      render: (_: unknown, r: ServiceHealth) => (
        <Progress
          percent={Math.round(r.saturation)}
          size="small"
          strokeColor={r.saturation > 80 ? colors.error[400] : colors.success[500]}
          style={{ width: 80 }}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">查看各服务的健康状态和关键指标</Text>
        <Button icon={<ReloadOutlined />} onClick={loadHealth} loading={loading}>刷新</Button>
      </div>
      <Table columns={columns} dataSource={services} rowKey="serviceName" loading={loading} size="middle" pagination={{ pageSize: 15 }} />
    </div>
  );
};

// ---- Main Page ----

const ObservabilityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('alert-rules');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <PageSkeleton rows={6} />;
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <EyeOutlined style={{ marginRight: 8 }} />
          全栈可观测性
        </Title>
        <Text type="secondary">自定义告警规则、根因分析和静默规则管理</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab={<span><BellOutlined />告警规则</span>} key="alert-rules">
          <AlertRulesTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><SafetyOutlined />静默规则</span>} key="silence-rules">
          <SilenceRulesTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><SearchOutlined />根因分析</span>} key="rca">
          <RootCauseAnalysisTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><ThunderboltOutlined />服务健康</span>} key="health">
          <ServiceHealthTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default ObservabilityPage;
