/**
 * 多租户配额管理 (Tenant Quota Management)
 * /api/v1/tenant-quota — 配额计划 · 用量监控 · 超额告警
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  Row, Col, message, Typography, Empty, Descriptions, Popconfirm,
  Progress,
} from 'antd';
import {
  ClusterOutlined, PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, WarningOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  listPlans, createPlan, updatePlan, deletePlan,
  listUsage, listAlerts, checkQuota,
  type QuotaPlan, type QuotaUsage, type QuotaAlert,
} from '@/api/tenantQuota';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PLAN_STATUS: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '活跃' },
  inactive: { color: 'default', label: '停用' },
};

const QUOTA_METRICS: { value: string; label: string; planField: string }[] = [
  { value: 'api_calls_per_min', label: 'API 每分钟调用', planField: 'apiRateLimitPerMin' },
  { value: 'api_calls_per_hour', label: 'API 每小时调用', planField: 'apiRateLimitPerHour' },
  { value: 'ci_count', label: 'CI 任务数', planField: 'maxCIs' },
  { value: 'user_count', label: '用户数', planField: 'maxUsers' },
  { value: 'storage_mb', label: '存储空间(MB)', planField: 'maxStorageMB' },
  { value: 'pipeline_count', label: '流水线数', planField: 'maxPipelines' },
  { value: 'concurrent_jobs', label: '并发任务数', planField: 'maxConcurrentJobs' },
  { value: 'alerts_per_day', label: '每日告警数', planField: 'maxAlertsPerDay' },
];

const TenantQuotaPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<QuotaPlan | null>(null);
  const [form] = Form.useForm();

  const [plans, setPlans] = useState<QuotaPlan[]>([]);
  const [usages, setUsages] = useState<QuotaUsage[]>([]);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [status, setStatus] = useState<string>('');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPlans();
      setPlans(Array.isArray(data) ? data : []);
    } catch { setPlans([]); }
    finally { setLoading(false); }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const data = await listUsage();
      setUsages(Array.isArray(data) ? data : []);
    } catch { setUsages([]); }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await listAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch { setAlerts([]); }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { loadUsage(); }, [loadUsage]);
  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleCreate = () => { setSelectedPlan(null); form.resetFields(); setModalOpen(true); };
  const handleEdit = (r: QuotaPlan) => { setSelectedPlan(r); form.setFieldsValue(r); setModalOpen(true); };
  const handleViewDetail = (r: QuotaPlan) => { setSelectedPlan(r); setDetailOpen(true); };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (selectedPlan) {
        await updatePlan(selectedPlan.id, values);
        message.success('配额计划更新成功');
      } else {
        await createPlan(values);
        message.success('配额计划创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      loadPlans();
    } catch { /* validated */ }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复',
      onOk: async () => {
        try { await deletePlan(id); message.success('删除成功'); loadPlans(); }
        catch { message.error('删除失败'); }
      },
    });
  };

  const handleCheckQuota = async (metric: string) => {
    try {
      const result = await checkQuota(metric, 1);
      message.info(`${result.metric}: 已用 ${result.currentValue}/${result.limit} (${result.usagePct.toFixed(1)}%)`);
    } catch { message.error('检查失败'); }
  };

  const columns = [
    { title: '计划名', dataIndex: 'name', key: 'name', render: (v: string) => <Tag>{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={PLAN_STATUS[v]?.color}>{PLAN_STATUS[v]?.label || v}</Tag> },
    { title: 'SLA', dataIndex: 'slaTier', key: 'slaTier', width: 80 },
    { title: 'API/min', dataIndex: 'apiRateLimitPerMin', key: 'apiRateLimitPerMin', width: 90 },
    { title: 'CI', dataIndex: 'maxCIs', key: 'maxCIs', width: 70 },
    { title: '用户', dataIndex: 'maxUsers', key: 'maxUsers', width: 70 },
    { title: '存储MB', dataIndex: 'maxStorageMB', key: 'maxStorageMB', width: 90 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    {
      title: '操作', key: 'action', width: 180,
      render: (_: any, r: QuotaPlan) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const usageColumns = [
    { title: '指标', dataIndex: 'metric', key: 'metric', render: (v: string) => {
      const m = QUOTA_METRICS.find((x) => x.value === v);
      return <Tag color="blue">{m?.label || v}</Tag>;
    }},
    { title: '当前值', dataIndex: 'currentValue', key: 'currentValue', width: 100 },
    { title: '峰值', dataIndex: 'peakValue', key: 'peakValue', width: 100 },
    { title: '窗口开始', dataIndex: 'windowStart', key: 'windowStart', width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '窗口结束', dataIndex: 'windowEnd', key: 'windowEnd', width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: QuotaUsage) => (
        <Button type="link" size="small" onClick={() => handleCheckQuota(r.metric)}>检查</Button>
      ),
    },
  ];

  const alertColumns = [
    { title: '指标', dataIndex: 'metric', key: 'metric', render: (v: string) => {
      const m = QUOTA_METRICS.find((x) => x.value === v);
      return <Tag>{m?.label || v}</Tag>;
    }},
    { title: '当前值', dataIndex: 'currentValue', key: 'currentValue', width: 90 },
    { title: '限制值', dataIndex: 'limitValue', key: 'limitValue', width: 90 },
    { title: '使用率', dataIndex: 'usagePct', key: 'usagePct', width: 100, render: (v: number) => (
      <Progress percent={Math.round(v)} size="small"
        strokeColor={v >= 95 ? colors.error[500] : v >= 80 ? colors.warning[500] : colors.success[500]}
      />
    )},
    { title: '告警级别', dataIndex: 'alertLevel', key: 'alertLevel', width: 100, render: (v: string) => <Tag color={v === 'critical' ? 'red' : 'orange'}>{v}</Tag> },
    { title: '通知时间', dataIndex: 'notifiedAt', key: 'notifiedAt', width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
  ];

  const activePlan = plans.find((p) => p.status === 'active');
  const planMetrics = activePlan ? QUOTA_METRICS.map((m) => ({
    ...m,
    limit: (activePlan as any)[m.planField] || 0,
  })) : [];
  const usageMap = new Map(usages.map((u) => [u.metric, u]));

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        多租户配额管理
      </Title>
      <Typography.Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        配额计划配置 · 用量实时监控 · 超额告警
      </Typography.Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">配额计划数</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>{plans.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">活跃用量指标</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.info[500] }}>{usages.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">告警数</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.warning[500] }}>{alerts.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">严重告警</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>{alerts.filter((a: QuotaAlert) => a.alertLevel === 'critical').length}</div>
          </Card>
        </Col>
      </Row>

      {planMetrics.length > 0 && (
        <Card title="活跃计划用量概览" style={{ marginBottom: spacing.md }}>
          <Row gutter={[spacing.md, spacing.md]}>
            {planMetrics.map((m) => {
              const usage = usageMap.get(m.value);
              const current = usage?.currentValue || 0;
              const limit = m.limit || 1;
              const pct = limit > 0 ? Math.round((current / limit) * 100) : 0;
              const strokeColor = pct >= 95 ? colors.error[500] : pct >= 80 ? colors.warning[500] : colors.success[500];
              return (
                <Col span={6} key={m.value}>
                  <Card size="small">
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{m.label}</Typography.Text>
                    <div style={{ fontSize: 16, fontWeight: 600, margin: '4px 0' }}>{current} / {limit}</div>
                    <Progress percent={Math.min(pct, 100)} size="small" strokeColor={strokeColor}
                      showInfo={false} />
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card
          title="配额计划"
          extra={
            <Space>
              <Select style={{ width: 120 }} value={status} onChange={setStatus} allowClear placeholder="状态">
                <Option value="active">活跃</Option>
                <Option value="inactive">停用</Option>
              </Select>
              <Button icon={<ReloadOutlined />} size="small" onClick={loadPlans} loading={loading}>刷新</Button>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreate}>新建计划</Button>
            </Space>
          }
        >
          {plans.length === 0 ? <Empty description="暂无配额计划" /> :
            <Table columns={columns} dataSource={plans} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 10 }} />
          }
        </Card>

        <Card title="用量明细" extra={<Button icon={<ReloadOutlined />} size="small" onClick={loadUsage}>刷新</Button>}>
          <Table columns={usageColumns} dataSource={usages} rowKey="id" size="small"
            locale={{ emptyText: <Empty description="暂无用量数据" /> }} pagination={{ pageSize: 10 }} />
        </Card>

        {alerts.length > 0 && (
          <Card title={<><WarningOutlined /> 超额告警</>} extra={<Button icon={<ReloadOutlined />} size="small" onClick={loadAlerts}>刷新</Button>}>
            <Table columns={alertColumns} dataSource={alerts} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
          </Card>
        )}
      </Space>

      <Modal title={selectedPlan ? '编辑配额计划' : '新建配额计划'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="计划名称" rules={[{ required: true, message: '请输入计划名称' }]}>
            <Input placeholder="e.g. 企业版" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="slaTier" label="SLA 等级">
            <Select><Option value="basic">基础</Option><Option value="standard">标准</Option><Option value="enterprise">企业</Option></Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="apiRateLimitPerMin" label="API/min"><Input type="number" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="apiRateLimitPerHour" label="API/hour"><Input type="number" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxCIs" label="最大 CI 任务数"><Input type="number" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxUsers" label="最大用户数"><Input type="number" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxStorageMB" label="最大存储(MB)"><Input type="number" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxPipelines" label="最大流水线数"><Input type="number" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxConcurrentJobs" label="最大并发任务"><Input type="number" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxAlertsPerDay" label="每日最大告警"><Input type="number" /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="计划详情" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>} width={600}>
        {selectedPlan && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="计划名称">{selectedPlan.name}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={PLAN_STATUS[selectedPlan.status]?.color}>{PLAN_STATUS[selectedPlan.status]?.label || selectedPlan.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="SLA">{selectedPlan.slaTier}</Descriptions.Item>
            {selectedPlan.description && <Descriptions.Item label="描述">{selectedPlan.description}</Descriptions.Item>}
            <Descriptions.Item label="API 每分钟">{selectedPlan.apiRateLimitPerMin}</Descriptions.Item>
            <Descriptions.Item label="API 每小时">{selectedPlan.apiRateLimitPerHour}</Descriptions.Item>
            <Descriptions.Item label="最大 CI 任务数">{selectedPlan.maxCIs}</Descriptions.Item>
            <Descriptions.Item label="最大用户数">{selectedPlan.maxUsers}</Descriptions.Item>
            <Descriptions.Item label="最大存储(MB)">{selectedPlan.maxStorageMB}</Descriptions.Item>
            <Descriptions.Item label="最大流水线数">{selectedPlan.maxPipelines}</Descriptions.Item>
            <Descriptions.Item label="最大并发任务">{selectedPlan.maxConcurrentJobs}</Descriptions.Item>
            <Descriptions.Item label="每日最大告警">{selectedPlan.maxAlertsPerDay}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{selectedPlan.createdAt ? new Date(selectedPlan.createdAt).toLocaleString() : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default TenantQuotaPage;