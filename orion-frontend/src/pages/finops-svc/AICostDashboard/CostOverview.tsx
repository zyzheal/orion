/**
 * Cost Overview - Stats cards, 7-day trend chart, top tenants/users, model distribution
 * Enhanced with ECharts visualization
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Button,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Table as AntTable,
  message,
} from 'antd';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, DollarOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { ColumnsType } from 'antd/es/table';
import {
  getDashboardData,
  getModelPricing,
  type DashboardData,
  type ModelPricing,
} from '@/api/ai-cost';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const CostOverview: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [pricing, setPricing] = useState<ModelPricing[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, pricingRes] = await Promise.all([getDashboardData(), getModelPricing()]);
      setDashboard(dashRes.data.data as DashboardData | null);
      setPricing(Array.isArray(pricingRes.data.data) ? pricingRes.data.data : []);
    } catch (error: unknown) {
      setDashboard(null);
      setPricing([]);
      message.error(`加载成本数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate day-over-day change
  const dayOverDayChange = useMemo(() => {
    if (!dashboard?.dailyTrend || dashboard.dailyTrend.length < 2) return 0;
    const today = dashboard.dailyTrend[dashboard.dailyTrend.length - 1]?.cost || 0;
    const yesterday = dashboard.dailyTrend[dashboard.dailyTrend.length - 2]?.cost || 0;
    if (yesterday === 0) return 0;
    return ((today - yesterday) / yesterday) * 100;
  }, [dashboard]);

  // ECharts option for cost trend
  const trendChartOption = useMemo(() => {
    if (!dashboard?.dailyTrend?.length) return {};
    const trendData = dashboard.dailyTrend;
    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any[]) => {
          const p = params[0];
          return `${p.name}<br/>费用: $${p.value.toFixed(2)}<br/>Token: ${p.data.tokens?.toLocaleString() || 0}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: trendData.map((d) => d.date),
        axisLabel: { rotate: 30 },
      },
      yAxis: [
        { type: 'value' as const, name: '费用 ($)', position: 'left' as const },
        {
          type: 'value' as const,
          name: 'Token',
          position: 'right' as const,
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '费用',
          type: 'line' as const,
          data: trendData.map((d) => d.cost),
          smooth: true,
          itemStyle: { color: colors.primary[500] },
          areaStyle: { color: colors.primary[500], opacity: 0.15 },
        },
        {
          name: 'Token',
          type: 'bar' as const,
          yAxisIndex: 1,
          data: trendData.map((d) => d.tokens),
          itemStyle: { color: colors.success[500], opacity: 0.5 },
          barWidth: '40%',
        },
      ],
    };
  }, [dashboard]);

  // ECharts option for model distribution
  const modelDistOption = useMemo(() => {
    if (!dashboard?.modelDistribution?.length) return {};
    return {
      tooltip: { trigger: 'item' as const, formatter: '{b}: ${c} ({d}%)' },
      legend: { orient: 'vertical' as const, left: 'left', top: 'middle' },
      series: [
        {
          type: 'pie' as const,
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: false,
          data: dashboard.modelDistribution.map((d) => ({
            name: d.model,
            value: Math.round(d.cost * 100) / 100,
          })),
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
        },
      ],
    };
  }, [dashboard]);

  // ECharts option for tenant cost
  const tenantChartOption = useMemo(() => {
    if (!dashboard?.topTenants?.length) return {};
    return {
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' as const, name: '费用 ($)' },
      yAxis: {
        type: 'category' as const,
        data: [...dashboard.topTenants].reverse().map((t) => t.tenantId),
      },
      series: [
        {
          type: 'bar' as const,
          data: [...dashboard.topTenants].reverse().map((t) => ({
            value: Math.round(t.cost * 100) / 100,
            itemStyle: { color: colors.primary[500] },
          })),
          barWidth: '60%',
        },
      ],
    };
  }, [dashboard]);

  const tenantColumns: ColumnsType<{ tenantId: string; cost: number }> = [
    {
      key: 'tenantId',
      title: '租户',
      dataIndex: 'tenantId',
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'cost',
      title: '费用',
      dataIndex: 'cost',
      sorter: (a, b) => a.cost - b.cost,
      render: (v: unknown) => <Text strong>${Number(v).toFixed(2)}</Text>,
    },
  ];

  const userColumns: ColumnsType<{ userId: string; cost: number }> = [
    {
      key: 'userId',
      title: '用户',
      dataIndex: 'userId',
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'cost',
      title: '费用',
      dataIndex: 'cost',
      sorter: (a, b) => a.cost - b.cost,
      render: (v: unknown) => <Text strong>${Number(v).toFixed(2)}</Text>,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <DollarOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            成本总览
          </Title>
          <Text type="secondary">AI 模型调用成本与资源使用统计</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing[6] }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日费用"
              value={dashboard?.todayCost || 0}
              precision={2}
              prefix="$"
              valueStyle={{ color: colors.error[600] }}
            />
            {dayOverDayChange !== 0 && (
              <div style={{ marginTop: 4 }}>
                {dayOverDayChange > 0 ? (
                  <ArrowUpOutlined style={{ color: colors.error[400], fontSize: 12 }} />
                ) : (
                  <ArrowDownOutlined style={{ color: colors.success[500], fontSize: 12 }} />
                )}
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                  较昨日 {Math.abs(dayOverDayChange).toFixed(1)}%
                </Text>
              </div>
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Token 用量" value={dashboard?.totalTokens || 0} suffix="tokens" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="请求数" value={dashboard?.totalRequests || 0} suffix="次" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="预算使用"
              value={dashboard?.budgetUsage || 0}
              precision={1}
              suffix="%"
              valueStyle={{
                color: (dashboard?.budgetUsage || 0) > 80 ? colors.error[600] : colors.success[600],
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 7-Day Trend Chart */}
      <Card title="7 日趋势" style={{ marginBottom: 24 }}>
        {dashboard?.dailyTrend && dashboard.dailyTrend.length > 0 ? (
          <ReactECharts option={trendChartOption} style={{ height: 300 }} />
        ) : (
          <div
            style={{
              height: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: colors.neutral[50],
              borderRadius: 6,
              border: `1px dashed ${colors.neutral[300]}`,
            }}
          >
            <Text type="secondary">暂无趋势数据</Text>
          </div>
        )}
      </Card>

      <Row gutter={16}>
        {/* Top Tenants Chart */}
        <Col span={8}>
          <Card title="Top 租户" size="small" style={{ marginBottom: 16 }}>
            {dashboard?.topTenants && dashboard.topTenants.length > 0 ? (
              <ReactECharts option={tenantChartOption} style={{ height: 200 }} />
            ) : (
              <div
                style={{
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text type="secondary">暂无数据</Text>
              </div>
            )}
          </Card>
          <Card title="租户费用明细" size="small">
            <AntTable<{ tenantId: string; cost: number }>
              columns={tenantColumns}
              dataSource={dashboard?.topTenants || []}
              rowKey="tenantId"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>

        {/* Top Users */}
        <Col span={8}>
          <Card title="Top 用户" size="small" style={{ marginBottom: 16 }}>
            <AntTable<{ userId: string; cost: number }>
              columns={userColumns}
              dataSource={dashboard?.topUsers || []}
              rowKey="userId"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>

        {/* Model Distribution */}
        <Col span={8}>
          <Card title="模型分布" size="small" style={{ marginBottom: 16 }}>
            {dashboard?.modelDistribution && dashboard.modelDistribution.length > 0 ? (
              <ReactECharts option={modelDistOption} style={{ height: 200 }} />
            ) : (
              <div
                style={{
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text type="secondary">暂无数据</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Model Pricing */}
      {pricing.length > 0 && (
        <Card title="模型定价" style={{ marginTop: 16 }}>
          <AntTable
            columns={[
              {
                key: 'model',
                title: '模型',
                dataIndex: 'model',
                render: (v: unknown) => <Tag>{String(v)}</Tag>,
              },
              {
                key: 'provider',
                title: '供应商',
                dataIndex: 'provider',
                render: (v: unknown) => <Text>{String(v)}</Text>,
              },
              {
                key: 'inputPrice',
                title: '输入价格 (每1K tokens)',
                dataIndex: 'inputPricePer1K',
                render: (v: unknown) => <Text>${Number(v).toFixed(4)}</Text>,
              },
              {
                key: 'outputPrice',
                title: '输出价格 (每1K tokens)',
                dataIndex: 'outputPricePer1K',
                render: (v: unknown) => <Text>${Number(v).toFixed(4)}</Text>,
              },
            ]}
            dataSource={pricing}
            rowKey="model"
            size="small"
          />
        </Card>
      )}
    </div>
  );
};

export default CostOverview;
