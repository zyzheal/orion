/**
 * Cost Overview Tab
 * 成本总览 Tab（抽取自 CostOperationsPage.tsx）
 */
import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Typography,
  Card,
  Table,
  Space,
  Row,
  Col,
  Statistic,
  Progress,
  message,
} from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import {
  getCostOverview,
  getCostTrend,
  getCostByService,
  type CostOverview as CostOverviewType,
  type CostTrendPoint,
  type CostByService as CostByServiceType,
} from '@/api/cost-operations';

const { Text } = Typography;

export const CostOverviewTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<CostOverviewType | null>(null);
  const [trends, setTrends] = useState<CostTrendPoint[]>([]);
  const [byService, setByService] = useState<CostByServiceType[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, trendRes, serviceRes] = await Promise.all([
        getCostOverview(),
        getCostTrend({ days: 30 }),
        getCostByService(),
      ]);
      setOverview(overviewRes.data || null);
      setTrends(trendRes.data?.trends || []);
      setByService(serviceRes.data?.services || []);
    } catch (error: unknown) {
      message.error(`加载成本数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const trendOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['实际成本', '预算'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      boundaryGap: false,
      data: trends.map((t) => t.date),
    },
    yAxis: { type: 'value' as const, name: '成本 (元)' },
    series: [
      {
        name: '实际成本',
        type: 'line' as const,
        data: trends.map((t) => t.cost),
        smooth: true,
        itemStyle: { color: colors.primary[500] },
        areaStyle: { color: colors.primary[200], opacity: 0.3 },
      },
      {
        name: '预算',
        type: 'line' as const,
        data: trends.map((t) => t.budget),
        smooth: true,
        itemStyle: { color: colors.warning[500] },
        lineStyle: { type: 'dashed' as const },
      },
    ],
  };

  const servicePieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c}元 ({d}%)' },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        data: byService.map((s) => ({
          name: s.serviceName,
          value: Math.round(s.cost * 100) / 100,
        })),
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      },
    ],
  };

  const columns = [
    {
      title: '服务',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: 160,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '成本',
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '占比',
      dataIndex: 'percentOfTotal',
      key: 'percentOfTotal',
      width: 100,
      render: (v: number) => (
        <Progress percent={Math.round(v)} size="small" style={{ width: 80 }} />
      ),
    },
    {
      title: '趋势',
      key: 'trend',
      width: 120,
      render: (_: unknown, record: CostByServiceType) => (
        <Space>
          {record.trend === 'up' ? (
            <RiseOutlined style={{ color: colors.error[400] }} />
          ) : record.trend === 'down' ? (
            <FallOutlined style={{ color: colors.success[500] }} />
          ) : (
            <Text>-</Text>
          )}
          <Text type="secondary">{record.trendPercent.toFixed(1)}%</Text>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Summary Cards */}
      {overview && (
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="本月成本"
                value={overview.currentMonthCost}
                prefix="¥"
                precision={2}
              />
              {overview.monthOverMonthChange !== 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  环比{' '}
                  {overview.monthOverMonthChange > 0 ? (
                    <RiseOutlined style={{ color: colors.error[400] }} />
                  ) : (
                    <FallOutlined style={{ color: colors.success[500] }} />
                  )}{' '}
                  {Math.abs(overview.monthOverMonthChange).toFixed(1)}%
                </Text>
              )}
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="预计月度成本"
                value={overview.projectedMonthlyCost}
                prefix="¥"
                precision={2}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="预算剩余"
                value={overview.budgetRemaining}
                prefix="¥"
                precision={2}
                valueStyle={
                  {
                    color:
                      overview.budgetRemaining > 0 ? colors.success[500] : colors.error[400],
                  } as React.CSSProperties
                }
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="预算使用率"
                value={overview.budgetUsagePercent}
                suffix="%"
                valueStyle={
                  {
                    color:
                      overview.budgetUsagePercent > 90
                        ? colors.error[400]
                        : overview.budgetUsagePercent > 70
                          ? colors.warning[500]
                          : colors.success[500],
                  } as React.CSSProperties
                }
              />
              <Progress
                percent={Math.round(overview.budgetUsagePercent)}
                size="small"
                style={{ marginTop: spacing.sm }}
                strokeColor={
                  overview.budgetUsagePercent > 90
                    ? colors.error[400]
                    : overview.budgetUsagePercent > 70
                      ? colors.warning[500]
                      : colors.success[500]
                }
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Charts */}
      <Row gutter={16}>
        <Col span={16}>
          <Card title="成本趋势 (30天)" loading={loading}>
            <ReactECharts option={trendOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="服务成本分布" loading={loading}>
            <ReactECharts option={servicePieOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* Service Cost Table */}
      <Card title="服务成本明细">
        <Table
          columns={columns}
          dataSource={byService}
          rowKey="serviceName"
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  );
};
