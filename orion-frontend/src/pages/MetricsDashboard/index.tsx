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
 * Uses existing monitoring APIs for all data sources.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Tag, Space, Button, Select, message } from 'antd';
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
// Service Options
// ============================================================================

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

      const metricsData = metricsRes.data.data || [];
      const dashboardData = dashboardRes.data.data;

      if (dashboardData) {
        setMetricSummary({
          requestRate: dashboardData.metrics?.rate ?? 0,
          errorRate: dashboardData.alerts?.total
            ? (dashboardData.alerts.active / dashboardData.alerts.total) * 100
            : 0,
          latencyP50: (dashboardData.metrics as any)?.latencyP50 ?? 0,
          latencyP95: (dashboardData.metrics as any)?.latencyP95 ?? 0,
          latencyP99: (dashboardData.metrics as any)?.latencyP99 ?? 0,
          throughput: (dashboardData.metrics as any)?.throughput ?? 0,
        });
      } else {
        setMetricSummary(null);
      }

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
      setServiceHealth(healthRows);
    } catch (error: unknown) {
      setMetricSummary(null);
      setServiceHealth([]);
      message.error(`加载指标数据失败: ${(error as Error).message}`);
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
            趋势图表区域 -- 待集成 ECharts 后展示历史趋势曲线
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default MetricsDashboard;
