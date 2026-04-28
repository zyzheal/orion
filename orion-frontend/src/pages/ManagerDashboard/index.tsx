/**
 * Manager Dashboard Page
 * Team-level metrics for engineering managers, including member performance table,
 * week-over-week comparison, and transfer analysis.
 *
 * Uses mock data initially; real API integration will be added later.
 */
import React, { useMemo } from 'react';
import { Row, Col, Statistic, Tag, Progress, Table, Typography, Space } from 'antd';
import { colors, spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import CardPanel from '@/components/CardPanel';
import { mockManagerDashboard } from '@/pages/__mocks__/mockBIData';
import dayjs from 'dayjs';

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
 * Simple bar visualization
 */
const SimpleBar: React.FC<{
  value: number;
  max: number;
  color: string;
  width?: number;
}> = ({ value, max, color, width = 80 }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      style={{
        width,
        height: 6,
        backgroundColor: colors.light.border.light,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(percentage, 100)}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
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
  const data = mockManagerDashboard;

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
          <SimpleBar
            value={score}
            max={100}
            color={score >= 90 ? COLORS.success : score >= 70 ? COLORS.info : COLORS.error}
            width={60}
          />
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
          <SimpleBar
            value={count}
            max={data.transferAnalysis.topTransferReasons[0]?.count || 1}
            color={COLORS.warning}
          />
          <Text strong>{count}</Text>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
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
              <Statistic
                title="总工单数"
                value={data.teamOverview.totalTickets}
                suffix="个"
                valueStyle={{ fontSize: spacing[6], fontWeight: 600 }}
              />
            </CardPanel>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <CardPanel>
              <Statistic
                title="已解决"
                value={data.teamOverview.resolvedCount}
                suffix="个"
                valueStyle={{ fontSize: spacing[6], fontWeight: 600, color: COLORS.success }}
                prefix={<CheckCircleOutlined />}
              />
            </CardPanel>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <CardPanel>
              <Statistic
                title="平均解决时间"
                value={data.teamOverview.avgResolutionTimeHours}
                suffix="h"
                valueStyle={{ fontSize: spacing[6], fontWeight: 600 }}
                prefix={<ClockCircleOutlined />}
              />
            </CardPanel>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <CardPanel>
              <Statistic
                title="SLA合规率"
                value={data.teamOverview.slaComplianceRate}
                suffix="%"
                valueStyle={{
                  fontSize: spacing[6],
                  fontWeight: 600,
                  color: data.teamOverview.slaComplianceRate >= 90 ? COLORS.success : COLORS.error,
                }}
                prefix={<CheckCircleOutlined />}
              />
            </CardPanel>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={8}>
            <CardPanel>
              <Statistic
                title="团队负载"
                value={data.teamOverview.teamLoadPercentage}
                suffix="%"
                valueStyle={{
                  fontSize: spacing[6],
                  fontWeight: 600,
                  color:
                    data.teamOverview.teamLoadPercentage > 85
                      ? COLORS.error
                      : data.teamOverview.teamLoadPercentage > 70
                        ? COLORS.warning
                        : COLORS.info,
                }}
              />
              <Progress
                percent={data.teamOverview.teamLoadPercentage}
                size="small"
                strokeColor={data.teamOverview.teamLoadPercentage > 85 ? COLORS.error : COLORS.info}
                showInfo={false}
                style={{ marginTop: 8 }}
              />
            </CardPanel>
          </Col>
        </Row>
      </div>

      {/* Week-over-Week Comparison */}
      <div style={{ marginBottom: 24 }}>
        <CardPanel title="环比变化（vs 上周）" extra={<Tag color="cyan">周环比</Tag>}>
          <Row gutter={[16, 16]}>
            {wowMetrics.map((metric) => (
              <Col xs={24} sm={12} lg={6} key={metric.label}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: colors.neutral[50],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <Text type="secondary" style={{ fontSize: spacing[3] }}>
                      {metric.label}
                    </Text>
                    <div
                      style={{
                        fontSize: spacing[6],
                        fontWeight: 600,
                        color:
                          metric.value > 0
                            ? metric.label === '平均解决时间'
                              ? COLORS.error
                              : COLORS.success
                            : metric.value < 0
                              ? metric.label === '平均解决时间'
                                ? COLORS.success
                                : COLORS.error
                              : colors.neutral[400],
                      }}
                    >
                      {metric.value > 0 ? '+' : ''}
                      {metric.value}
                      {metric.suffix}
                    </div>
                  </div>
                  <div style={{ fontSize: spacing[6] }}>
                    {metric.value > 0 ? (
                      <ArrowUpOutlined style={{ color: COLORS.success }} />
                    ) : metric.value < 0 ? (
                      <ArrowDownOutlined style={{ color: COLORS.error }} />
                    ) : (
                      <MinusOutlined style={{ color: colors.neutral[400] }} />
                    )}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
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
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Statistic
                  title="总转派次数"
                  value={data.transferAnalysis.totalTransfers}
                  valueStyle={{ fontSize: 28, fontWeight: 600 }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Statistic
                  title="平均每工单转派"
                  value={data.transferAnalysis.avgTransfersPerTicket}
                  precision={2}
                  valueStyle={{ fontSize: 28, fontWeight: 600 }}
                />
              </Col>
            </Row>
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
    </div>
  );
};

export default ManagerDashboard;
