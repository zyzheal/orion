/**
 * ChatDashboard - 总览看板
 * 展示 ChatOps 执行统计数据、趋势分析、热门命令
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Button,
  Space,
  Typography,
  Empty,
  Skeleton,
  Tooltip,
  Tag,
} from 'antd';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import {
  getDashboardStats,
  type DashboardStats,
  type TimeRangeType,
  type TopCommand,
} from '@/api/chatops';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;
const { Option } = Select;

interface MetricCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  trend?: number;
  color: string;
  tooltip: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, suffix, trend, color, tooltip }) => (
  <Card>
    <Tooltip title={tooltip}>
      <Statistic
        title={<span>{title} <InfoCircleOutlined style={{ fontSize: 12, color: '#bbb', cursor: 'help' }} /></span>}
        value={value}
        suffix={suffix}
        valueStyle={{ color }}
        prefix={
          trend != null && trend !== 0 ? (
            <span style={{ fontSize: 12, marginRight: 4 }}>
              {trend > 0 ? (
                <ArrowUpOutlined style={{ color: trend > 0 ? '#52c41a' : '#ff4d4f' }} />
              ) : (
                <ArrowDownOutlined style={{ color: trend > 0 ? '#ff4d4f' : '#52c41a' }} />
              )}
            </span>
          ) : undefined
        }
      />
    </Tooltip>
    {trend != null && trend !== 0 && (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {trend > 0 ? '↑' : '↓'}{Math.abs(trend)}% 环比
      </Text>
    )}
  </Card>
);

export default function ChatDashboard() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeType>('7d');
  const [apiError, setApiError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await getDashboardStats({ range: timeRange });
      setStats(res.data.data as DashboardStats);
    } catch {
      setApiError('后端服务暂不可用');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData();
  };

  if (apiError && !stats) {
    return (
      <div style={{ padding: '0 0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600, lineHeight: '24px' }}>ChatOps 总览看板</span>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>执行统计与趋势分析</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>刷新</Button>
        </div>
        <Card>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={apiError} />
        </Card>
      </div>
    );
  }

  const timeRangeOptions = [
    { label: '近 7 天', value: '7d' as TimeRangeType },
    { label: '近 30 天', value: '30d' as TimeRangeType },
    { label: '本月', value: 'month' as TimeRangeType },
  ];

  const trendChartOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: stats?.trends.map(t => dayjs(t.date).format('MM-DD')) || [],
      axisLine: { lineStyle: { color: '#eee' } },
      axisLabel: { color: '#999' },
    },
    yAxis: [
      { type: 'value' as const, name: '执行数', axisLabel: { color: '#999' }, splitLine: { lineStyle: { type: 'dashed' } } },
    ],
    series: [
      {
        name: '执行数',
        type: 'bar' as const,
        data: stats?.trends.map(t => t.executions) || [],
        itemStyle: { color: colors.primary[500] },
        barWidth: '40%',
      },
    ],
  };

  const platformChartOption = {
    tooltip: { trigger: 'item' as const },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, formatter: '{b}: {c}次' },
        data: stats?.platformDistribution.map(p => ({ name: p.platform, value: p.count })) || [],
      },
    ],
  };

  const renderTopCommands = (commands: TopCommand[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {commands.map((cmd, index) => (
        <div key={cmd.command} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: index < 3 ? colors.primary[500] : '#d9d9d9',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {index + 1}
          </span>
          <Text code style={{ flex: 1 }}>/{cmd.command}</Text>
          <Text style={{ color: colors.primary[500], fontWeight: 600 }}>{cmd.count}</Text>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '0 0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 600, lineHeight: '24px' }}>ChatOps 总览看板</span>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>执行统计与趋势分析</Text>
        </div>
        <Space>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 120 }}
            options={timeRangeOptions.map(o => ({ label: o.label, value: o.value }))}
          />
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {loading && !stats ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : stats ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <MetricCard
                title="总执行数"
                value={stats.metrics.totalExecutions}
                trend={stats.comparison.totalExecutions}
                color={colors.primary[500]}
                tooltip="时间范围内所有执行次数"
              />
            </Col>
            <Col span={6}>
              <MetricCard
                title="成功率"
                value={stats.metrics.successRate}
                suffix="%"
                trend={stats.comparison.successRate}
                color="#52c41a"
                tooltip="成功数 / 总执行数 × 100%"
              />
            </Col>
            <Col span={6}>
              <MetricCard
                title="失败数"
                value={stats.metrics.failedCount}
                trend={stats.comparison.failedCount}
                color="#ff4d4f"
                tooltip="状态为 failed 的执行数"
              />
            </Col>
            <Col span={6}>
              <MetricCard
                title="平均响应时间"
                value={stats.metrics.avgResponseTime}
                suffix="s"
                trend={stats.comparison.avgResponseTime !== 0 ? -Math.round(stats.comparison.avgResponseTime * 10) / 10 : 0}
                color="#722ed1"
                tooltip="成功执行的平均响应时间"
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={24} md={12} lg={12}>
              <Card title="活跃度趋势">
                {stats.trends.length === 0 ? (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <ReactECharts option={trendChartOption} style={{ height: 200 }} />
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={6}>
              <Card title="热门命令 TOP5" style={{ height: '100%' }}>
                {stats.topCommands.length === 0 ? (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  renderTopCommands(stats.topCommands)
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6} lg={6}>
              <Card title="平台分布" style={{ height: '100%' }}>
                {stats.platformDistribution.length === 0 ? (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <ReactECharts option={platformChartOption} style={{ height: 200 }} />
                )}
              </Card>
            </Col>
          </Row>

          <Card title="最近执行记录">
            {stats.recentExecutions.length === 0 ? (
              <Empty description="暂无执行记录">
                <Text type="secondary">还没有执行记录，开始第一次对话吧</Text>
              </Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.recentExecutions.map((exec) => (
                  <div
                    key={exec.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#fafafa',
                      borderRadius: 6,
                    }}
                  >
                    <Text code>/{exec.commandId}</Text>
                    <Tag style={{ marginLeft: 8 }}>{exec.platform}</Tag>
                    <Text style={{ marginLeft: 'auto' }}>{exec.userId}</Text>
                    <Tag
                      color={exec.status === 'completed' ? 'green' : exec.status === 'failed' ? 'red' : 'orange'}
                      style={{ marginLeft: 8 }}
                    >
                      {exec.status}
                    </Tag>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {dayjs(exec.startTime).fromNow()}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}