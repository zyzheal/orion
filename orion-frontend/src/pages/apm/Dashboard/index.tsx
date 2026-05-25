/**
 * APM Dashboard (Phase 3.5.3)
 * Application performance overview with metrics and trace visualization
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Row, Col, Statistic, Button, Space, Tag, message, Spin } from 'antd';
import { DashboardOutlined, ReloadOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { apmApi, type TraceSummary, type ServiceInfo } from '@/api/apm';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const ApmDashboardPage: React.FC = () => {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [traceRes, serviceRes] = await Promise.all([
        apmApi.listTraces({ limit: 50 }),
        apmApi.listServices(),
      ]);
      setTraces(traceRes);
      setServices(serviceRes);

      // Compute stats
      const errors = traceRes.filter((t) => t.status === 'error').length;
      setErrorCount(errors);
      const avg = traceRes.length > 0
        ? Math.round(traceRes.reduce((sum, t) => sum + t.duration_ms, 0) / traceRes.length)
        : 0;
      setAvgDuration(avg);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载 APM 数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const traceColumns = [
    { title: 'Trace ID', dataIndex: 'traceId', key: 'traceId', ellipsis: true, render: (v: string) => <code style={{ fontSize: 12 }}>{v.slice(0, 16)}...</code> },
    { title: '服务', dataIndex: 'root_service', key: 'root_service' },
    { title: '操作', dataIndex: 'root_operation', key: 'root_operation' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => (
        <Tag color={s === 'error' ? colors.error[500] : colors.success[500]}>{s}</Tag>
      ),
    },
    {
      title: '耗时', dataIndex: 'duration_ms', key: 'duration_ms',
      render: (ms: number) => (
        <span style={{ color: ms > 1000 ? colors.error[500] : ms > 500 ? colors.warning[500] : colors.neutral[900] }}>
          {ms} ms
        </span>
      ),
    },
    { title: 'Span 数', dataIndex: 'span_count', key: 'span_count' },
    {
      title: '时间', dataIndex: 'start_time', key: 'start_time',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  const serviceColumns = [
    { title: '服务名称', dataIndex: 'service_name', key: 'service_name' },
    { title: 'Trace 数', dataIndex: 'trace_count', key: 'trace_count' },
    {
      title: '最大耗时', dataIndex: 'max_duration_ms', key: 'max_duration_ms',
      render: (ms: number) => `${ms} ms`,
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
              APM 性能仪表盘
            </Title>
            <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>应用性能监控与分布式链路追踪</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </div>

        {/* Overview Stats */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="总 Trace 数" value={traces.length} prefix={<ClockCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="平均响应时间" value={avgDuration} suffix="ms" valueStyle={{ color: avgDuration > 500 ? colors.warning[500] : colors.success[500] }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="错误数" value={errorCount} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: errorCount > 0 ? colors.error[500] : colors.success[500] }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="服务数" value={services.length} />
            </Card>
          </Col>
        </Row>

        {/* Recent Traces */}
        <Card title="最近链路" style={{ marginBottom: 16 }}>
          <Table columns={traceColumns} dataSource={traces} rowKey="traceId" pagination={{ pageSize: 10 }} size="small" />
        </Card>

        {/* Service List */}
        <Card title="服务列表">
          <Table columns={serviceColumns} dataSource={services} rowKey="service_name" pagination={false} size="small" />
        </Card>
      </div>
    </Spin>
  );
};

export default ApmDashboardPage;
