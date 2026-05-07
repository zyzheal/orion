/**
 * Manager Dashboard Page
 * Team-level metrics for engineering managers, including member performance table,
 * week-over-week comparison, and transfer analysis.
 *
 * P0-3 Fix: Removed mock data fallback. Now uses real API data with proper
 * loading, error, and empty states. Mock data is kept only in test files.
 */
import React, { useMemo } from 'react';
import { Row, Col, Tag, Table, Typography, Space, Result } from 'antd';
import { colors, spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  TeamOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import CardPanel from '@/components/CardPanel';
import DataState from '@/components/DataState';
import { useBiDashboard } from '@/hooks/useBiDashboard';
import type { ManagerDashboardData } from '@/types/pages';
import dayjs from 'dayjs';
import { BarChart, GaugeChart, PieChart, StatCard } from '@/components/charts';

const { Title, Text } = Typography;

// Color constants
const COLORS = {
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[400],
  info: colors.primary[500],
  purple: colors.purple[500],
};

/**
 * Format milliseconds to hours string
 */
const msToHours = (ms: number): string => {
  const hours = ms / (1000 * 3600);
  return `${hours.toFixed(1)}h`;
};

/**
 * Grade color mapping
 */
const gradeColor = (grade: string): string => {
  switch (grade) {
    case 'A':
      return COLORS.success;
    case 'A-':
      return COLORS.success;
    case 'B+':
      return COLORS.info;
    case 'B':
      return COLORS.info;
    case 'C':
      return COLORS.warning;
    case 'D':
      return COLORS.error;
    default:
      return colors.neutral[400];
  }
};

/**
 * Trend icon and color
 */
const TrendIndicator: React.FC<{ trend: 'improving' | 'stable' | 'declining' }> = ({ trend }) => {
  if (trend === 'improving') {
    return <ArrowUpOutlined style={{ color: COLORS.success }} />;
  }
  if (trend === 'declining') {
    return <ArrowDownOutlined style={{ color: COLORS.error }} />;
  }
  return <MinusOutlined style={{ color: colors.neutral[400] }} />;
};

const ManagerDashboard: React.FC = () => {
  const { data: apiData, loading, error } = useBiDashboard('manager');

  // Retry handler - reload page on error
  const handleRetry = () => window.location.reload();

  // Show empty state when no data available
  if (!loading && !error && !apiData) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="info"
          title="暂无数据"
          subTitle="经理效能仪表盘 API 尚未返回数据，请确认后端服务已正确部署。"
        />
      </div>
    );
  }

  // Cast API data to expected type
  const data = apiData as ManagerDashboardData | undefined;

  if (!data) {
    return null; // Will show loading/error via DataState
  }

  // Week-over-week metrics
  const wowMetrics = useMemo(
    () => [
      {
        label: '工单创建',
        value: data.weekOverWeek.ticketsCreatedChange,
        suffix: '%',
      },
      {
        label: '已解决',
        value: data.weekOverWeek.resolvedChange,
        suffix: '%',
      },
      {
        label: '平均解决时间',
        value: data.weekOverWeek.avgResolutionTimeChange,
        suffix: '%',
      },
      {
        label: 'SLA合规率',
        value: data.weekOverWeek.slaComplianceChange,
        suffix: '%',
      },
    ],
    [data]
  );

  // Member metrics table columns
  const memberColumns: ColumnsType<(typeof data.memberMetrics)[0]> = [
    {
      title: '工程师',
      dataIndex: 'engineerName',
      key: 'engineerName',
      fixed: 'left',
      width: 100,
    },
    {
      title: '工作量',
      key: 'workload',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: spacing[3] }}>
            分配 <Text strong>{record.workload.totalAssigned}</Text>
          </Text>
          <Text style={{ fontSize: spacing[3] }}>
            解决{' '}
            <Text strong style={{ color: COLORS.success }}>
              {record.workload.totalResolved}
            </Text>
          </Text>
        </Space>
      ),
    },
    {
      title: '效率',
      key: 'efficiency',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: spacing[3] }}>
            平均 {msToHours(record.efficiency.avgResolutionTimeMs)}
          </Text>
          <Text style={{ fontSize: spacing[3] }}>{record.efficiency.ticketsPerDay} 单/天</Text>
        </Space>
      ),
    },
    {
      title: '质量',
      key: 'quality',
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: spacing[3] }}>
            SLA{' '}
            <Text
              strong
              style={{
                color: record.quality.slaComplianceRate >= 0.9 ? COLORS.success : COLORS.error,
              }}
            >
              {(record.quality.slaComplianceRate * 100).toFixed(0)}%
            </Text>
          </Text>
          <Text style={{ fontSize: spacing[3] }}>
            首次解决 {(record.quality.firstTimeResolveRate * 100).toFixed(0)}%
          </Text>
          <Text style={{ fontSize: spacing[3] }}>
            重开率{' '}
            <Text
              style={{
                color: record.quality.reopenRate > 0.1 ? COLORS.error : 'inherit',
              }}
            >
              {(record.quality.reopenRate * 100).toFixed(0)}%
            </Text>
          </Text>
        </Space>
      ),
    },
    {
      title: '综合评分',
      dataIndex: 'compositeScore',
      key: 'compositeScore',
      width: 160,
      sorter: (a, b) => a.compositeScore - b.compositeScore,
      defaultSortOrder: 'descend',
      render: (score: number) => (
        <Space>
          <Text strong>{score}</Text>
        </Space>
      ),
    },
    {
      title: '等级',
      dataIndex: 'performanceGrade',
      key: 'performanceGrade',
      width: 70,
      render: (grade: string) => (
        <Tag
          color={gradeColor(grade)}
          style={{ fontWeight: 700, minWidth: 30, textAlign: 'center' }}
        >
          {grade}
        </Tag>
      ),
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      width: 70,
      render: (trend: 'improving' | 'stable' | 'declining') => <TrendIndicator trend={trend} />,
    },
  ];

  // Transfer reasons table columns
  const transferColumns: ColumnsType<(typeof data.transferAnalysis.topTransferReasons)[0]> = [
    {
      title: '转派原因',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
      render: (count: number) => (
        <Space>
          <Text strong>{count}</Text>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <DataState
        loading={loading}
        error={error}
        empty={false}
        loadingText="加载效能数据..."
        retry={handleRetry}
      >
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 8, color: COLORS.info }} />
            经理看板
          </Title>
          <Text type="secondary">团队管理与成员效能分析 — {dayjs().format('YYYY-MM-DD HH:mm')}</Text>
        </div>

      {/* Team Overview Cards */}
      <div style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <CardPanel>
              <StatCard
                title="总工单数"
                value={data.teamOverview.totalTickets}
                suffix="个"
              />
            </CardPanel>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <CardPanel>
              <StatCard
                title="已解决"
                value={data.teamOverview.resolvedCount}
                suffix="个"
              />
            </CardPanel>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <CardPanel>
              <StatCard
                title="平均解决时间"
                value={data.teamOverview.avgResolutionTimeHours}
                suffix="h"
              />
            </CardPanel>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <CardPanel>
              <StatCard
                title="SLA合规率"
                value={data.teamOverview.slaComplianceRate}
                suffix="%"
              />
            </CardPanel>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={8}>
            <CardPanel>
              <GaugeChart
                value={data.teamOverview.teamLoadPercentage}
                title="团队负载"
                max={100}
                thresholds={{ warning: 70, danger: 90 }}
                size={160}
                unit="%"
              />
            </CardPanel>
          </Col>
        </Row>
      </div>

      {/* Week-over-Week Comparison */}
      <div style={{ marginBottom: 24 }}>
        <CardPanel title="环比变化（vs 上周）" extra={<Tag color="cyan">周环比</Tag>}>
          <Row gutter={[16, 16]}>
            {wowMetrics.map((metric) => {
              const isGoodUp = !['平均解决时间'].includes(metric.label);
              const trendDir = metric.value > 0 ? 'up' : metric.value < 0 ? 'down' : 'flat';
              return (
                <Col xs={24} sm={12} lg={6} key={metric.label}>
                  <StatCard
                    title={metric.label}
                    value={`${metric.value > 0 ? '+' : ''}${metric.value}`}
                    suffix={metric.suffix}
                    trend={{
                      value: Math.abs(metric.value),
                      direction: trendDir,
                      good: isGoodUp ? 'up' : 'down',
                    }}
                  />
                </Col>
              );
            })}
          </Row>
        </CardPanel>
      </div>

      {/* Team Performance Chart */}
      <div style={{ marginBottom: 24 }}>
        <CardPanel
          title="团队绩效分布"
          extra={<Tag color="blue">{data.memberMetrics.length} 人</Tag>}
        >
          <BarChart
            data={data.memberMetrics.map((m) => ({
              label: m.engineerName,
              value: m.workload.totalResolved,
            }))}
            height={280}
          />
        </CardPanel>
      </div>

      {/* Member Metrics Table */}
      <div style={{ marginBottom: 24 }}>
        <CardPanel
          title="成员效能明细"
          extra={<Tag color="blue">{data.memberMetrics.length} 人</Tag>}
        >
          <Table
            dataSource={data.memberMetrics}
            columns={memberColumns}
            rowKey="engineerId"
            pagination={false}
            scroll={{ x: 900 }}
            size="middle"
          />
        </CardPanel>
      </div>

      {/* Transfer Analysis */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <CardPanel title="转派分析" extra={<SwapOutlined />}>
            <PieChart
              title="转派原因分布"
              data={data.transferAnalysis.topTransferReasons.map(r => ({ name: r.reason, value: r.count }))}
              variant="donut"
              height={200}
            />
          </CardPanel>
        </Col>
        <Col xs={24} xl={10}>
          <CardPanel title="主要转派原因">
            <Table
              dataSource={data.transferAnalysis.topTransferReasons}
              columns={transferColumns}
              rowKey="reason"
              pagination={false}
              size="small"
            />
          </CardPanel>
        </Col>
      </Row>
      </DataState>
    </div>
  );
};

export default ManagerDashboard;
