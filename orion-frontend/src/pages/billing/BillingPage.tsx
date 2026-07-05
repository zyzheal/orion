/**
 * Billing Page (Phase 4 - Quota & Billing)
 * Usage metering tracking, billing records management, billing summary
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Button,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Tabs,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
} from 'antd';
import {
  DollarOutlined,
  ReloadOutlined,
  PlusOutlined,
  CloudServerOutlined,
  LineChartOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import {
  getBillingRecords,
  generateBillingRecord,
  markBillingPaid,
  getBillingSummary,
  getUsage,
  recordUsage,
  getUsageSummary,
  type BillingRecord,
  type UsageRecord,
  type BillingSummary,
} from '@/api/billing';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

// API 响应包装接口
interface BillingSummaryResponse { data?: BillingSummary }
interface BillingRecordsResponse { data?: BillingRecord[] }
interface UsageResponse { data?: UsageRecord[] }
interface UsageSummaryResponse { data?: { totalCost: number; byService: Record<string, number> } }

const { Title, Text } = Typography;

// ============================================================================
// Billing Summary Card
// ============================================================================

const BillingSummaryCard: React.FC = () => {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getBillingSummary();
      setSummary(((res.data as BillingSummaryResponse).data) ?? null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载账单摘要失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <Card loading={loading} style={{ marginBottom: spacing.lg }}>
      <Row gutter={24}>
        <Col span={6}>
          <Statistic title="总账单金额" value={summary?.totalBilling ?? 0} prefix={<DollarOutlined />} suffix="元" />
        </Col>
        <Col span={6}>
          <Statistic title="已支付" value={summary?.paidAmount ?? 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: colors.success[500] }} suffix="元" />
        </Col>
        <Col span={6}>
          <Statistic title="待支付" value={summary?.pendingAmount ?? 0} valueStyle={{ color: colors.warning[500] }} suffix="元" />
        </Col>
        <Col span={6}>
          <Statistic title="已逾期" value={summary?.overdueAmount ?? 0} valueStyle={{ color: colors.error[500] }} suffix="元" />
        </Col>
      </Row>
    </Card>
  );
};

// ============================================================================
// Billing Records Tab
// ============================================================================

const BillingRecordsTab: React.FC = () => {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getBillingRecords();
      setRecords((res.data as BillingRecordsResponse).data || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载账单记录失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleGenerate = async (values: any) => {
    try {
      await generateBillingRecord({ period: values.period });
      message.success('账单生成成功');
      setGenerateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '生成失败';
      message.error(msg);
    }
  };

  const handlePay = async (id: string) => {
    try {
      await markBillingPaid(id);
      message.success('标记已支付');
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '操作失败';
      message.error(msg);
    }
  };

  const statusColorMap: Record<string, string> = {
    draft: colors.neutral[400],
    pending: colors.warning[500],
    paid: colors.success[500],
    overdue: colors.error[500],
    cancelled: colors.neutral[300],
  };

  const columns = [
    { title: '账期', dataIndex: 'billingPeriod', key: 'billingPeriod' },
    { title: '总金额', dataIndex: 'totalAmount', key: 'totalAmount', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '已支付', dataIndex: 'paidAmount', key: 'paidAmount', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '到期日', dataIndex: 'dueDate', key: 'dueDate' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s] || colors.neutral[400]}>{s}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: BillingRecord) => (
        <Space>
          {record.status !== 'paid' && record.status !== 'cancelled' && (
            <Button size="small" type="link" onClick={() => handlePay(record.id)}>支付</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <DollarOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            账单记录
          </Title>
          <Text type="secondary">管理月度账单记录及支付状态</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateModalOpen(true)}>生成账单</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={records} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      {/* Generate Modal */}
      <Modal title="生成月度账单" open={generateModalOpen} onCancel={() => setGenerateModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleGenerate}>
          <Form.Item label="账期" name="period" rules={[{ required: true, message: '请选择账期' }]}>
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Usage Metering Tab
// ============================================================================

const UsageMeteringTab: React.FC = () => {
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ totalCost: number; byService: Record<string, number> } | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [usageRes, summaryRes] = await Promise.all([getUsage(), getUsageSummary()]);
      setUsage((usageRes.data as UsageResponse).data || []);
      setSummary(((summaryRes.data as UsageSummaryResponse).data) ?? null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载用量数据失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRecord = async (values: any) => {
    try {
      await recordUsage({
        service: values.service,
        metric: values.metric,
        quantity: values.quantity,
        unitPrice: values.unitPrice,
        periodStart: values.periodStart?.format('YYYY-MM-DD'),
        periodEnd: values.periodEnd?.format('YYYY-MM-DD'),
      });
      message.success('用量记录成功');
      setRecordModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '记录失败';
      message.error(msg);
    }
  };

  const columns = [
    { title: '服务', dataIndex: 'service', key: 'service', render: (s: string) => <Tag color={colors.primary[500]}>{s}</Tag> },
    { title: '指标', dataIndex: 'metric', key: 'metric' },
    { title: '用量', dataIndex: 'quantity', key: 'quantity' },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', render: (v: number) => `¥${v.toFixed(4)}` },
    { title: '费用', dataIndex: 'totalCost', key: 'totalCost', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '周期开始', dataIndex: 'periodStart', key: 'periodStart' },
    { title: '周期结束', dataIndex: 'periodEnd', key: 'periodEnd' },
  ];

  return (
    <div>
      {/* Summary */}
      {summary && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Row gutter={24}>
            <Col span={8}>
              <Statistic title="本期总用量" value={summary.totalCost} prefix={<LineChartOutlined />} suffix="元" />
            </Col>
            {Object.entries(summary.byService).map(([service, cost]) => (
              <Col span={8} key={service}>
                <Statistic title={service} value={cost} prefix={<CloudServerOutlined />} suffix="元" />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <CloudServerOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            用量计量
          </Title>
          <Text type="secondary">跟踪各服务的资源用量和成本</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRecordModalOpen(true)}>记录用量</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={usage} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      {/* Record Modal */}
      <Modal title="记录用量" open={recordModalOpen} onCancel={() => setRecordModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleRecord}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="服务" name="service" rules={[{ required: true }]}>
                <Select placeholder="选择服务">
                  <Select.Option value="compute">Compute</Select.Option>
                  <Select.Option value="storage">Storage</Select.Option>
                  <Select.Option value="network">Network</Select.Option>
                  <Select.Option value="api-calls">API Calls</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="指标" name="metric" rules={[{ required: true }]}>
                <Input placeholder="例如：cpu-hours, gb-storage" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="用量" name="quantity" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="单价" name="unitPrice" rules={[{ required: true }]}>
                <InputNumber min={0} precision={4} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="周期开始" name="periodStart" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="周期结束" name="periodEnd" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const BillingPage: React.FC = () => {
  const tabItems = [
    { key: 'summary', label: '账单摘要', children: <><BillingSummaryCard /><BillingRecordsTab /></> },
    { key: 'records', label: '账单记录', children: <BillingRecordsTab /> },
    { key: 'usage', label: '用量计量', children: <UsageMeteringTab /> },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Tabs defaultActiveKey="summary" items={tabItems} size="large" />
    </div>
  );
};

export default BillingPage;
