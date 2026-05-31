/**
 * Capacity Planning Page (Phase 4 - Capacity Planning)
 * Resource capacity tracking, forecasting, bottleneck analysis
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Table, Button, Tag, Space, Tabs, message,
  Modal, Form, Input, Select, Popconfirm, Card, Progress,
} from 'antd';
import {
  BarChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import {
  recordCapacityMetric, listCapacityMetrics,
  generateCapacityForecast, listCapacityForecasts,
  listCapacityAlerts, deleteCapacityAlert,
  generateCapacityReport, listCapacityReports,
  analyzeBottlenecks,
  type CapacityMetric, type CapacityForecast, type CapacityAlert, type CapacityReport, type Bottleneck,
} from '@/api/capacity';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// ============================================================================
// Overview Tab
// ============================================================================

const OverviewTab: React.FC = () => {
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [alerts, setAlerts] = useState<CapacityAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bnRes, alertRes] = await Promise.all([analyzeBottlenecks(), listCapacityAlerts()]);
      setBottlenecks((bnRes.data as { data?: Bottleneck[] })?.data ?? []);
      setAlerts((alertRes.data as { data?: CapacityAlert[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载数据失败');
    } finally { setLoading(false); }
  };

  const handleForecast = async () => {
    try {
      await generateCapacityForecast();
      message.success('预测生成成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '预测失败');
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await deleteCapacityAlert(id);
      message.success('告警已清除');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  useEffect(() => { loadData(); }, []);

  const impactColorMap: Record<string, string> = {
    high: colors.error[500],
    medium: colors.warning[500],
    low: colors.info[500],
  };

  const severityColorMap: Record<string, string> = {
    critical: colors.error[500],
    warning: colors.warning[500],
    info: colors.info[500],
  };

  const bottleneckColumns = [
    { title: '资源 ID', dataIndex: 'resourceId', key: 'resourceId' },
    { title: '资源类型', dataIndex: 'resourceType', key: 'resourceType' },
    { title: '指标', dataIndex: 'metricName', key: 'metricName' },
    {
      title: '使用率', dataIndex: 'utilization', key: 'utilization',
      render: (v: number) => (
        <Progress percent={Math.round(v)} size="small" status={v >= 80 ? 'exception' : v >= 60 ? 'normal' : 'success'} style={{ width: 100 }} />
      ),
    },
    {
      title: '影响', dataIndex: 'impact', key: 'impact',
      render: (i: string) => <Tag color={impactColorMap[i]}>{i}</Tag>,
    },
    { title: '建议', dataIndex: 'recommendation', key: 'recommendation', ellipsis: true },
  ];

  const alertColumns = [
    { title: '资源', dataIndex: 'resourceId', key: 'resourceId' },
    { title: '指标', dataIndex: 'metricName', key: 'metricName' },
    { title: '使用率', dataIndex: 'currentUtilization', key: 'currentUtilization', render: (v: number) => `${v.toFixed(1)}%` },
    {
      title: '级别', dataIndex: 'severity', key: 'severity',
      render: (s: string) => <Tag color={severityColorMap[s]}>{s}</Tag>,
    },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: CapacityAlert) => (
        <Popconfirm title="确认清除？" onConfirm={() => handleDeleteAlert(record.id)}>
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
            <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            容量概览
          </Title>
          <Text type="secondary">资源使用瓶颈与容量预警</Text>
        </div>
        <Space>
          <Button icon={<RiseOutlined />} onClick={handleForecast}>生成预测</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </div>

      {/* Bottlenecks */}
      <Card title="瓶颈分析" style={{ marginBottom: 16 }}>
        <Table columns={bottleneckColumns} dataSource={bottlenecks} rowKey={(r) => `${r.resourceId}-${r.metricName}`} pagination={false} size="small"
          locale={{ emptyText: bottlenecks.length === 0 ? '暂无瓶颈数据' : undefined }} />
      </Card>

      {/* Alerts */}
      <Card title="容量预警">
        <Table columns={alertColumns} dataSource={alerts} rowKey="id" pagination={{ pageSize: 10 }} size="small"
          locale={{ emptyText: alerts.length === 0 ? '暂无容量预警' : undefined }} />
      </Card>
    </div>
  );
};

// ============================================================================
// Forecast Tab
// ============================================================================

const ForecastTab: React.FC = () => {
  const [forecasts, setForecasts] = useState<CapacityForecast[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listCapacityForecasts();
      setForecasts((res.data as { data?: CapacityForecast[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载预测失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const columns = [
    { title: '资源', dataIndex: 'resourceId', key: 'resourceId' },
    { title: '类型', dataIndex: 'resourceType', key: 'resourceType' },
    { title: '指标', dataIndex: 'metricName', key: 'metricName' },
    { title: '当前', dataIndex: 'currentUtilization', key: 'currentUtilization', render: (v: number) => `${v.toFixed(1)}%` },
    {
      title: '30 天预测', dataIndex: 'forecast30Days', key: 'forecast30Days',
      render: (v: number) => <span style={{ color: v >= 90 ? colors.error[500] : v >= 70 ? colors.warning[500] : colors.neutral[900] }}>{v.toFixed(1)}%</span>,
    },
    {
      title: '90 天预测', dataIndex: 'forecast90Days', key: 'forecast90Days',
      render: (v: number) => <span style={{ color: v >= 90 ? colors.error[500] : v >= 70 ? colors.warning[500] : colors.neutral[900] }}>{v.toFixed(1)}%</span>,
    },
    { title: '预计耗尽', dataIndex: 'estimatedExhaustDate', key: 'estimatedExhaustDate', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { title: '建议', dataIndex: 'recommendedAction', key: 'recommendedAction', ellipsis: true, render: (v: string) => v || '-' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <RiseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            容量预测
          </Title>
          <Text type="secondary">资源使用趋势预测与耗尽时间估算</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>
      <Table columns={columns} dataSource={forecasts} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ============================================================================
// Metrics Tab
// ============================================================================

const MetricsTab: React.FC = () => {
  const [metrics, setMetrics] = useState<CapacityMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listCapacityMetrics();
      setMetrics((res.data as { data?: CapacityMetric[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载指标失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await recordCapacityMetric({
        resourceType: values.resourceType, resourceId: values.resourceId,
        metricName: values.metricName, currentValue: values.currentValue,
        maxValue: values.maxValue, unit: values.unit,
      });
      message.success('指标记录成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '记录失败');
    }
  };

  const typeColorMap: Record<string, string> = {
    compute: colors.primary[500],
    storage: colors.info[500],
    network: colors.success[500],
    database: colors.warning[500],
  };

  const columns = [
    { title: '资源 ID', dataIndex: 'resourceId', key: 'resourceId' },
    {
      title: '类型', dataIndex: 'resourceType', key: 'resourceType',
      render: (t: string) => <Tag color={typeColorMap[t]}>{t}</Tag>,
    },
    { title: '指标', dataIndex: 'metricName', key: 'metricName' },
    { title: '当前值', dataIndex: 'currentValue', key: 'currentValue', render: (v: number, r: CapacityMetric) => `${v} ${r.unit}` },
    { title: '最大值', dataIndex: 'maxValue', key: 'maxValue', render: (v: number, r: CapacityMetric) => `${v} ${r.unit}` },
    { title: '使用率', dataIndex: 'utilizationPercent', key: 'utilizationPercent', render: (v: number) => `${v.toFixed(1)}%` },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            资源指标
          </Title>
          <Text type="secondary">各资源类型的容量指标数据</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>记录指标</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={metrics} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="记录容量指标" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="资源类型" name="resourceType" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="compute">Compute</Select.Option>
              <Select.Option value="storage">Storage</Select.Option>
              <Select.Option value="network">Network</Select.Option>
              <Select.Option value="database">Database</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="资源 ID" name="resourceId" rules={[{ required: true }]}><Input placeholder="如: vm-001, db-primary" /></Form.Item>
          <Form.Item label="指标名称" name="metricName" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="cpu">CPU</Select.Option>
              <Select.Option value="memory">Memory</Select.Option>
              <Select.Option value="disk">Disk</Select.Option>
              <Select.Option value="iops">IOPS</Select.Option>
              <Select.Option value="throughput">Throughput</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="当前值" name="currentValue" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item label="最大值" name="maxValue" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item label="单位" name="unit" rules={[{ required: true }]}><Input placeholder="如: %, GB, MB/s" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Reports Tab
// ============================================================================

const ReportsTab: React.FC = () => {
  const [reports, setReports] = useState<CapacityReport[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listCapacityReports();
      setReports((res.data as { data?: CapacityReport[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载报告失败');
    } finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    try {
      await generateCapacityReport({ title: `容量规划报告 ${new Date().toLocaleDateString()}` });
      message.success('报告生成成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '生成失败');
    }
  };

  useEffect(() => { loadData(); }, []);

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '健康评分', dataIndex: 'summary', key: 'summary',
      render: (s: CapacityReport['summary']) => (
        <Progress percent={s.overallScore} size="small" status={s.overallScore >= 80 ? 'success' : s.overallScore >= 60 ? 'normal' : 'exception'} style={{ width: 100 }} />
      ),
    },
    { title: '总资源数', dataIndex: 'summary', key: 'total', render: (s: CapacityReport['summary']) => s.totalResources },
    { title: '健康', dataIndex: 'summary', key: 'healthy', render: (s: CapacityReport['summary']) => <span style={{ color: colors.success[500] }}>{s.healthyCount}</span> },
    { title: '警告', dataIndex: 'summary', key: 'warning', render: (s: CapacityReport['summary']) => <span style={{ color: colors.warning[500] }}>{s.warningCount}</span> },
    { title: '严重', dataIndex: 'summary', key: 'critical', render: (s: CapacityReport['summary']) => <span style={{ color: colors.error[500] }}>{s.criticalCount}</span> },
    { title: '生成时间', dataIndex: 'generatedAt', key: 'generatedAt', render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            容量报告
          </Title>
          <Text type="secondary">容量规划报告汇总</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleGenerate}>生成报告</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={reports} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const CapacityPlanningPage: React.FC = () => {
  const tabItems = [
    { key: 'overview', label: '容量概览', children: <OverviewTab /> },
    { key: 'forecast', label: '容量预测', children: <ForecastTab /> },
    { key: 'metrics', label: '资源指标', children: <MetricsTab /> },
    { key: 'reports', label: '容量报告', children: <ReportsTab /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs defaultActiveKey="overview" items={tabItems} size="large" />
    </div>
  );
};

export default CapacityPlanningPage;
