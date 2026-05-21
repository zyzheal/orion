/**
 * Personal Workbench Page (个人工作台)
 *
 * Unified operational dashboard aggregating data from multiple services:
 * - My Pipelines: recent runs, success rate, failure count
 * - My Alerts: active alerts, critical count, acknowledge actions
 * - My Tickets: active tickets, SLA countdown, priority tags
 * - My Deployments: recent deployments, environment tags, status
 *
 * Features:
 * - 4 summary stat cards at top
 * - 2x2 grid of detail panels
 * - Auto-refresh every 60 seconds
 * - Loading skeleton, empty states
 * - "View more" links to respective detail pages
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Badge,
  Button,
  Space,
  Typography,
  Statistic,
  Spin,
  Empty,
  Tooltip,
  Popconfirm,
  message,
} from 'antd';
import {
  ReloadOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  OrderedListOutlined,
  CloudUploadOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import DataState from '@/components/DataState';
import {
  getWorkbenchData,
  type WorkbenchData,
  type PipelineRunSummary,
  type AlertSummary,
  type TicketSummary,
  type DeploymentSummary,
  acknowledgeAlert,
} from '@/api/workbench';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ============================================================================
// Color constants
// ============================================================================

const COLORS = {
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.primary[500],
  purple: colors.purple[500],
  cyan: colors.info[500],
};

// ============================================================================
// Display helpers
// ============================================================================

/** Status badge for pipeline runs and deployments */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusMap: Record<string, { color: string; text: string }> = {
    success: { color: 'success', text: '成功' },
    failed: { color: 'error', text: '失败' },
    running: { color: 'processing', text: '运行中' },
    pending: { color: 'default', text: '等待中' },
    cancelled: { color: 'default', text: '已取消' },
    deploying: { color: 'processing', text: '部署中' },
    rolled_back: { color: 'error', text: '已回滚' },
  };
  const { color, text } = statusMap[status] || { color: 'default', text: status };
  return <Badge status={color as any} text={text} />;
};

/** Severity color mapping for alerts */
const severityColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
      return COLORS.error;
    case 'warning':
      return COLORS.warning;
    case 'info':
      return COLORS.info;
    default:
      return colors.neutral[400];
  }
};

/** Severity display name */
const severityName = (severity: string): string => {
  const names: Record<string, string> = {
    critical: '严重',
    warning: '警告',
    info: '信息',
  };
  return names[severity] || severity;
};

/** Priority tag color */
const priorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical':
    case 'urgent':
      return COLORS.error;
    case 'high':
      return COLORS.warning;
    case 'medium':
      return COLORS.info;
    case 'low':
      return COLORS.success;
    default:
      return colors.neutral[400];
  }
};

/** Priority display name */
const priorityName = (priority: string): string => {
  const names: Record<string, string> = {
    critical: '紧急',
    urgent: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  };
  return names[priority] || priority;
};

/** Environment tag color */
const envColor = (env: string): string => {
  switch (env) {
    case 'prod':
    case 'production':
      return COLORS.error;
    case 'staging':
    case 'pre-prod':
      return COLORS.warning;
    case 'dev':
    case 'development':
      return COLORS.info;
    default:
      return colors.neutral[400];
  }
};

/** Environment display name */
const envName = (env: string): string => {
  const names: Record<string, string> = {
    prod: '生产',
    production: '生产',
    staging: '预发',
    'pre-prod': '预发',
    dev: '开发',
    development: '开发',
  };
  return names[env] || env;
};

/** Format duration from milliseconds to human readable */
const formatDuration = (ms: number): string => {
  if (!ms) return '-';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.round((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

/** Format SLA remaining time */
const formatSlaRemaining = (hours: number): { text: string; color: string } => {
  if (hours < 0) {
    return { text: `超时 ${Math.abs(hours)}h`, color: COLORS.error };
  }
  if (hours < 4) {
    return { text: `${hours}h`, color: COLORS.warning };
  }
  return { text: `${hours}h`, color: 'inherit' };
};

// ============================================================================
// Main Component
// ============================================================================

const WorkbenchPage: React.FC = () => {
  const [data, setData] = useState<WorkbenchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch workbench data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getWorkbenchData();
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch workbench data'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 60 seconds
  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // Acknowledge an alert
  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      message.success('告警已确认');
      // Refresh data after acknowledge
      fetchData();
    } catch {
      message.error('确认告警失败');
    }
  };

  // ============================================================================
  // Loading skeleton
  // ============================================================================

  if (loading && !data) {
    return (
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            个人工作台
          </Title>
        </div>
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="加载工作台数据..." />
        </div>
      </div>
    );
  }

  // ============================================================================
  // Error state
  // ============================================================================

  if (error && !data) {
    return (
      <DataState loading={false} error={error} retry={fetchData} />
    );
  }

  // ============================================================================
  // Empty state
  // ============================================================================

  const isEmpty =
    !data ||
    (data.myPipelines.recentRuns.length === 0 &&
      data.myAlerts.recent.length === 0 &&
      data.myTickets.recent.length === 0 &&
      data.myDeployments.recent.length === 0);

  if (isEmpty && !loading) {
    return (
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            个人工作台
          </Title>
          <Text type="secondary" style={{ marginLeft: spacing[2] }}>
            最后刷新: {dayjs(lastRefresh).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        </div>
        <Empty description="暂无数据，当前没有活跃的流水线、告警、工单或部署任务" />
      </div>
    );
  }

  // Safety fallback
  if (!data) return null;

  // ============================================================================
  // Render
  // ============================================================================

  // Pipeline runs table columns
  const pipelineColumns = [
    {
      title: '流水线名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: PipelineRunSummary) => (
        <a href={`/pipelines/${record.id}/runs/${record.id}`}>{text}</a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (ms: number) => formatDuration(ms),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (time: string) => (
        <Tooltip title={dayjs(time).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(time).fromNow()}
        </Tooltip>
      ),
    },
  ];

  // Alert columns
  const alertColumns = [
    {
      title: '告警内容',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (text: string, record: AlertSummary) => (
        <Space direction="vertical" size={2}>
          <Tag color={severityColor(record.severity)} style={{ fontWeight: 600 }}>
            {severityName(record.severity)}
          </Tag>
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (time: string) => dayjs(time).fromNow(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: AlertSummary) =>
        !record.acknowledged ? (
          <Popconfirm title="确认已处理此告警?" onConfirm={() => handleAcknowledge(record.id)}>
            <Button type="link" size="small">
              确认
            </Button>
          </Popconfirm>
        ) : (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
            已确认
          </Tag>
        ),
    },
  ];

  // Ticket columns
  const ticketColumns = [
    {
      title: '工单标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: TicketSummary) => (
        <a href={`/tickets/${record.id}`}>{text}</a>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => (
        <Tag color={priorityColor(priority)} style={{ fontWeight: 600 }}>
          {priorityName(priority)}
        </Tag>
      ),
    },
    {
      title: 'SLA剩余',
      dataIndex: 'slaRemaining',
      key: 'slaRemaining',
      width: 100,
      render: (hours: number) => {
        const { text, color } = formatSlaRemaining(hours);
        return (
          <Text style={{ color, fontWeight: hours < 4 ? 600 : 400 }}>
            {text}
          </Text>
        );
      },
    },
  ];

  // Deployment columns
  const deploymentColumns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      ellipsis: true,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 100,
      render: (env: string) => (
        <Tag color={envColor(env)} style={{ fontWeight: 600 }}>
          {envName(env)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: '部署时间',
      dataIndex: 'deployedAt',
      key: 'deployedAt',
      width: 130,
      render: (time: string) => (
        <Tooltip title={dayjs(time).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(time).fromNow()}
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            个人工作台
          </Title>
          <Text type="secondary">
            统一运维视角 — 我的流水线 + 我的告警 + 我的工单 + 我的部署
            {' '}
            <ClockCircleOutlined style={{ marginLeft: 8 }} />
            最后刷新: {dayjs(lastRefresh).format('HH:mm:ss')}
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined spin={loading} />}
          onClick={fetchData}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <DataState loading={loading} error={error} empty={false} retry={fetchData}>
        {/* Summary Stat Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {/* Pipeline success rate */}
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="流水线成功率"
                value={data.myPipelines.successRate || (data.myPipelines.recentRuns.length > 0
                  ? Math.round(
                      (data.myPipelines.recentRuns.filter((r) => r.status === 'success').length /
                        data.myPipelines.recentRuns.length) *
                        100
                    )
                  : 0)}
                suffix="%"
                prefix={<ThunderboltOutlined />}
                valueStyle={{
                  color:
                    (data.myPipelines.successRate || 100) >= 90
                      ? COLORS.success
                      : COLORS.warning,
                }}
              />
              <Text type="secondary" style={{ fontSize: spacing[2] }}>
                {data.myPipelines.totalRuns24h > 0
                  ? `24h 运行 ${data.myPipelines.totalRuns24h} 次`
                  : `失败 ${data.myPipelines.failedRuns} 次`}
              </Text>
            </Card>
          </Col>

          {/* Critical alerts */}
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="严重告警"
                value={data.myAlerts.critical}
                prefix={<WarningOutlined />}
                valueStyle={{ color: data.myAlerts.critical > 0 ? COLORS.error : COLORS.success }}
              />
              <Text type="secondary" style={{ fontSize: spacing[2] }}>
                未读 {data.myAlerts.unread} 条
              </Text>
            </Card>
          </Col>

          {/* Active tickets */}
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="活跃工单"
                value={data.myTickets.active}
                prefix={<OrderedListOutlined />}
                valueStyle={{ color: COLORS.info }}
              />
              <Text type="secondary" style={{ fontSize: spacing[2] }}>
                {data.myTickets.overdue > 0 ? (
                  <span style={{ color: COLORS.error }}>
                    {data.myTickets.overdue} 个超期
                  </span>
                ) : (
                  '无超期'
                )}
              </Text>
            </Card>
          </Col>

          {/* Recent deployments */}
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="最近部署"
                value={data.myDeployments.recent.length}
                prefix={<CloudUploadOutlined />}
                valueStyle={{ color: COLORS.cyan }}
              />
              <Text type="secondary" style={{ fontSize: spacing[2] }}>
                {data.myDeployments.successRate > 0
                  ? `成功率 ${data.myDeployments.successRate}%`
                  : '近期部署记录'}
              </Text>
            </Card>
          </Col>
        </Row>

        {/* 2x2 Grid */}
        <Row gutter={[16, 16]}>
          {/* Top-left: Recent Pipeline Runs */}
          <Col xs={24} xl={12}>
            <Card
              size="small"
              title={
                <Space>
                  <ThunderboltOutlined style={{ color: COLORS.info }} />
                  最近流水线运行
                </Space>
              }
              extra={
                <a href="/pipeline-runs">
                  <Space>
                    查看更多
                    <LinkOutlined />
                  </Space>
                </a>
              }
            >
              {data.myPipelines.recentRuns.length > 0 ? (
                <Table
                  dataSource={data.myPipelines.recentRuns}
                  columns={pipelineColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无流水线运行记录" />
              )}
            </Card>
          </Col>

          {/* Top-right: Active Alerts */}
          <Col xs={24} xl={12}>
            <Card
              size="small"
              title={
                <Space>
                  <WarningOutlined style={{ color: COLORS.warning }} />
                  活跃告警
                </Space>
              }
              extra={
                <Badge count={data.myAlerts.unread} offset={[5, 0]}>
                  <a href="/alerts">
                    <Space>
                      查看更多
                      <LinkOutlined />
                    </Space>
                  </a>
                </Badge>
              }
            >
              {data.myAlerts.recent.length > 0 ? (
                <Table
                  dataSource={data.myAlerts.recent}
                  columns={alertColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无活跃告警" />
              )}
            </Card>
          </Col>

          {/* Bottom-left: My Tickets */}
          <Col xs={24} xl={12}>
            <Card
              size="small"
              title={
                <Space>
                  <OrderedListOutlined style={{ color: COLORS.purple }} />
                  我的工单
                </Space>
              }
              extra={
                <a href="/tickets">
                  <Space>
                    查看更多
                    <LinkOutlined />
                  </Space>
                </a>
              }
            >
              {data.myTickets.recent.length > 0 ? (
                <Table
                  dataSource={data.myTickets.recent}
                  columns={ticketColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无活跃工单" />
              )}
            </Card>
          </Col>

          {/* Bottom-right: Recent Deployments */}
          <Col xs={24} xl={12}>
            <Card
              size="small"
              title={
                <Space>
                  <CloudUploadOutlined style={{ color: COLORS.cyan }} />
                  最近部署
                </Space>
              }
              extra={
                <a href="/deployments">
                  <Space>
                    查看更多
                    <LinkOutlined />
                  </Space>
                </a>
              }
            >
              {data.myDeployments.recent.length > 0 ? (
                <Table
                  dataSource={data.myDeployments.recent}
                  columns={deploymentColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无部署记录" />
              )}
            </Card>
          </Col>
        </Row>
      </DataState>
    </div>
  );
};

export default WorkbenchPage;
