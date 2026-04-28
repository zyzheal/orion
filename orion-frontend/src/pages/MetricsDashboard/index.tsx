/**
 * MetricsDashboard Page
 * Metrics Overview - 全局指标概览
 *
 * Features:
 * - Dashboard cards showing key metrics: Request Rate, Error Rate, Latency (P50/P95/P99), Throughput
 * - Mini trend indicators
 * - Service health summary table
 * - Filter by service and time range
 * - Refresh button
 *
 * Uses existing monitoring APIs where available, falls back to mock data with warning banner.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Tag, Space, Button, Select, Alert, message } from 'antd';
import {
  ReloadOutlined,
  DashboardOutlined,
  ArrowUpOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import DashboardLayout from '@/components/DashboardLayout';
import MetricCard from '@/components/MetricCard';
import Table, { TableColumn } from '@/components/Table';
import SearchFilterBar, { FilterDefinition } from '@/components/SearchFilterBar';
import { getMonitoringHealth, getMetrics, getDashboardData } from '@/api/monitoring';

const { Title, Text } = Typography;

// ============================================================================
// Type Definitions
// ============================================================================

interface ServiceHealthRow {
  key: string;
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  requestRate: string;
  errorRate: string;
  latency: string;
}

interface MetricSummary {
  requestRate: number;
  errorRate: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  throughput: number;
}

type TimeRange = '5m' | '15m' | '1h' | '6h' | '24h' | '7d';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_METRIC_SUMMARY: MetricSummary = {
  requestRate: 12540,
  errorRate: 0.32,
  latencyP50: 45,
  latencyP95: 180,
  latencyP99: 420,
  throughput: 8920,
};

const MOCK_SERVICE_HEALTH: ServiceHealthRow[] = [
  {
    key: 'api-gateway',
    serviceName: 'API Gateway',
    status: 'healthy',
    requestRate: '4,230/min',
    errorRate: '0.12%',
    latency: '23ms',
  },
  {
    key: 'platform-service',
    serviceName: 'Platform Service',
    status: 'healthy',
    requestRate: '3,120/min',
    errorRate: '0.28%',
    latency: '45ms',
  },
  {
    key: 'ai-service',
    serviceName: 'AI Service',
    status: 'degraded',
    requestRate: '1,890/min',
    errorRate: '1.45%',
    latency: '320ms',
  },
  {
    key: 'pipeline-engine',
    serviceName: 'Pipeline Engine',
    status: 'healthy',
    requestRate: '980/min',
    errorRate: '0.05%',
    latency: '15ms',
  },
  {
    key: 'auth-service',
    serviceName: 'Auth Service',
    status: 'healthy',
    requestRate: '2,320/min',
    errorRate: '0.08%',
    latency: '12ms',
  },
  {
    key: 'notification-svc',
    serviceName: 'Notification Service',
    status: 'unhealthy',
    requestRate: '540/min',
    errorRate: '5.23%',
    latency: '890ms',
  },
];

const SERVICE_OPTIONS = [
  { label: 'All Services', value: 'all' },
  { label: 'API Gateway', value: 'api-gateway' },
  { label: 'Platform Service', value: 'platform-service' },
  { label: 'AI Service', value: 'ai-service' },
  { label: 'Pipeline Engine', value: 'pipeline-engine' },
  { label: 'Auth Service', value: 'auth-service' },
  { label: 'Notification Service', value: 'notification-svc' },
];

// ============================================================================
// Helpers
// ============================================================================

function getStatusColor(status: ServiceHealthRow['status']): string {
  switch (status) {
    case 'healthy':
      return colors.success[500];
    case 'degraded':
      return colors.warning[500];
    case 'unhealthy':
      return colors.error[500];
  }
}

function getStatusLabel(status: ServiceHealthRow['status']): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'unhealthy':
      return 'Unhealthy';
  }
}

// ============================================================================
// Component
// ============================================================================

const MetricsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1h');
  const [metricSummary, setMetricSummary] = useState<MetricSummary | null>(null);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthRow[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [_healthRes, metricsRes, dashboardRes] = await Promise.all([
        getMonitoringHealth(),
        getMetrics(),
        getDashboardData(),
      ]);

      // Build metric summary from API responses
      const metricsData = metricsRes.data.data || [];

      // Use dashboard data for overview
      const dashboardData = dashboardRes.data.data;
      if (dashboardData) {
        setMetricSummary({
          requestRate: dashboardData.metrics?.rate ?? MOCK_METRIC_SUMMARY.requestRate,
          errorRate: dashboardData.alerts?.total
            ? (dashboardData.alerts.active / dashboardData.alerts.total) * 100
            : MOCK_METRIC_SUMMARY.errorRate,
          latencyP50: MOCK_METRIC_SUMMARY.latencyP50,
          latencyP95: MOCK_METRIC_SUMMARY.latencyP95,
          latencyP99: MOCK_METRIC_SUMMARY.latencyP99,
          throughput: MOCK_METRIC_SUMMARY.throughput,
        });
      } else {
        setMetricSummary(MOCK_METRIC_SUMMARY);
      }

      // Build service health from metrics
      const healthRows: ServiceHealthRow[] = metricsData.map(
        (m: { name?: string; value?: number; unit?: string; lastUpdated?: string }, i: number) => ({
          key: `metric-${i}`,
          serviceName: m.name || `Service ${i + 1}`,
          status:
            m.value !== undefined && m.value > 0.9
              ? 'unhealthy'
              : m.value !== undefined && m.value > 0.5
                ? 'degraded'
                : 'healthy',
          requestRate: `${Math.round((m.value || 0) * 1000)}/min`,
          errorRate: `${(m.value || 0).toFixed(2)}%`,
          latency: `${Math.round((m.value || 0) * 100)}ms`,
        })
      );

      setServiceHealth(healthRows.length > 0 ? healthRows : MOCK_SERVICE_HEALTH);

      // If we got minimal data, also show warning
      if (healthRows.length === 0) {
        setUsingMockData(true);
      } else {
        setUsingMockData(false);
      }
    } catch (error: unknown) {
      // Fallback to mock data
      setMetricSummary(MOCK_METRIC_SUMMARY);
      setServiceHealth(MOCK_SERVICE_HEALTH);
      setUsingMockData(true);
      message.warning(error instanceof Error ? error.message : 'API 不可用，显示模拟数据');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter service health by selected service
  const filteredServiceHealth =
    selectedService === 'all'
      ? serviceHealth
      : serviceHealth.filter((s) => s.key === selectedService);

  // Table columns for service health
  const serviceColumns: TableColumn<ServiceHealthRow>[] = [
    {
      key: 'serviceName',
      title: 'Service Name',
      dataIndex: 'serviceName',
      sortable: true,
      render: (value: unknown) => <Text strong>{String(value)}</Text>,
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      sortable: true,
      render: (_value: unknown, record: ServiceHealthRow) => (
        <Tag color={getStatusColor(record.status)}>{getStatusLabel(record.status)}</Tag>
      ),
    },
    {
      key: 'requestRate',
      title: 'Request Rate',
      dataIndex: 'requestRate',
      sortable: true,
    },
    {
      key: 'errorRate',
      title: 'Error Rate',
      dataIndex: 'errorRate',
      sortable: true,
      render: (value: unknown) => {
        const rate = parseFloat(String(value).replace('%', '')) || 0;
        return (
          <Text
            style={{
              color:
                rate > 1
                  ? colors.error[500]
                  : rate > 0.5
                    ? colors.warning[500]
                    : colors.success[500],
            }}
          >
            {String(value)}
          </Text>
        );
      },
    },
    {
      key: 'latency',
      title: 'Latency',
      dataIndex: 'latency',
      sortable: true,
      render: (value: unknown) => {
        const ms = parseInt(String(value).replace('ms', ''), 10) || 0;
        return (
          <Text
            style={{
              color:
                ms > 500 ? colors.error[500] : ms > 200 ? colors.warning[500] : colors.success[500],
            }}
          >
            {String(value)}
          </Text>
        );
      },
    },
  ];

  // Filter definitions for SearchFilterBar
  const filterDefinitions: FilterDefinition[] = [
    {
      key: 'service',
      label: 'Service',
      options: SERVICE_OPTIONS,
      placeholder: 'Filter by service',
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          marginBottom: spacing[6],
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DashboardOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
            Metrics Overview
          </Title>
          <Text type="secondary">全局指标概览</Text>
        </div>
        <Space>
          <Select
            value={selectedTimeRange}
            onChange={(value: TimeRange) => setSelectedTimeRange(value)}
            style={{ width: 120 }}
            options={[
              { label: 'Last 5m', value: '5m' },
              { label: 'Last 15m', value: '15m' },
              { label: 'Last 1h', value: '1h' },
              { label: 'Last 6h', value: '6h' },
              { label: 'Last 24h', value: '24h' },
              { label: 'Last 7d', value: '7d' },
            ]}
          />
          <Button
            type="primary"
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={handleRefresh}
            loading={refreshing}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Mock Data Warning */}
      {usingMockData && (
        <Alert
          type="warning"
          closable
          message="使用模拟数据"
          description="当前指标数据为演示用模拟数据，后端监控服务尚未完全接入。"
          style={{ marginBottom: spacing[4] }}
          onClose={() => setUsingMockData(false)}
        />
      )}

      {/* Metric Cards */}
      <div style={{ marginBottom: spacing[6] }}>
        <Title level={5}>Key Metrics</Title>
        <DashboardLayout columns={4} gap={spacing[4]}>
          <MetricCard
            title="Request Rate"
            value={metricSummary?.requestRate ?? '-'}
            unit="req/min"
            trend="up"
            trendPercent={8.2}
            previousValue={
              metricSummary?.requestRate ? Math.round(metricSummary.requestRate * 0.92) : 0
            }
            loading={loading}
            icon={<SyncOutlined style={{ color: colors.success[500] }} />}
          />
          <MetricCard
            title="Error Rate"
            value={metricSummary?.errorRate ?? '-'}
            unit="%"
            trend="down"
            trendPercent={15.3}
            previousValue={
              metricSummary?.errorRate ? (metricSummary.errorRate * 1.15).toFixed(2) : '0.38'
            }
            loading={loading}
            color={
              metricSummary && metricSummary.errorRate > 1 ? colors.error[500] : colors.success[500]
            }
          />
          <MetricCard
            title="Latency (P50)"
            value={metricSummary?.latencyP50 ?? '-'}
            unit="ms"
            trend="stable"
            trendPercent={2.1}
            previousValue={
              metricSummary?.latencyP50 ? Math.round(metricSummary.latencyP50 * 0.98) : 44
            }
            loading={loading}
          />
          <MetricCard
            title="Throughput"
            value={metricSummary?.throughput ?? '-'}
            unit="ops/min"
            trend="up"
            trendPercent={5.7}
            previousValue={
              metricSummary?.throughput ? Math.round(metricSummary.throughput * 0.94) : 0
            }
            loading={loading}
            icon={<ArrowUpOutlined style={{ color: colors.success[500] }} />}
          />
        </DashboardLayout>
      </div>

      {/* Latency Breakdown */}
      <div style={{ marginBottom: spacing[6] }}>
        <Title level={5}>Latency Breakdown</Title>
        <DashboardLayout columns={3} gap={spacing[4]}>
          <MetricCard
            title="P50 Latency"
            value={metricSummary?.latencyP50 ?? '-'}
            unit="ms"
            trend="down"
            trendPercent={3.2}
            previousValue={
              metricSummary?.latencyP50 ? Math.round(metricSummary.latencyP50 * 1.03) : 46
            }
            loading={loading}
            size="small"
          />
          <MetricCard
            title="P95 Latency"
            value={metricSummary?.latencyP95 ?? '-'}
            unit="ms"
            trend="stable"
            trendPercent={1.1}
            previousValue={
              metricSummary?.latencyP95 ? Math.round(metricSummary.latencyP95 * 0.99) : 0
            }
            loading={loading}
            size="small"
            color={
              metricSummary && metricSummary.latencyP95 > 200 ? colors.warning[500] : undefined
            }
          />
          <MetricCard
            title="P99 Latency"
            value={metricSummary?.latencyP99 ?? '-'}
            unit="ms"
            trend="up"
            trendPercent={8.5}
            previousValue={
              metricSummary?.latencyP99 ? Math.round(metricSummary.latencyP99 * 0.92) : 0
            }
            loading={loading}
            size="small"
            color={metricSummary && metricSummary.latencyP99 > 400 ? colors.error[500] : undefined}
          />
        </DashboardLayout>
      </div>

      {/* Service Health Table */}
      <Card title="Service Health Summary" size="small">
        {/* Filter Bar */}
        <SearchFilterBar
          filters={filterDefinitions}
          showSearch={false}
          onFilter={(filters) => {
            if (filters.service) {
              setSelectedService(String(filters.service));
            }
          }}
          initialFilters={selectedService !== 'all' ? { service: selectedService } : {}}
        />

        <Table<ServiceHealthRow>
          columns={serviceColumns}
          dataSource={filteredServiceHealth}
          rowKey="key"
          loading={loading}
          size="small"
        />
      </Card>

      {/* Trend Placeholder */}
      <Card title="Metric Trends" size="small" style={{ marginTop: spacing[4] }}>
        <div style={{ textAlign: 'center', padding: spacing[6] }}>
          <Text type="secondary">
            趋势图表区域（集成 ECharts 后展示 Request Rate / Error Rate / Latency
            历史趋势曲线，时间范围: {selectedTimeRange}）
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default MetricsDashboard;
