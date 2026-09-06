/**
 * Personal Workbench Page (个人工作台)
 * - 统一运维视角: 我的流水线 + 我的告警 + 我的工单 + 我的部署
 * - 4 汇总卡片 + 2x2 面板网格
 * - 60 秒自动刷新
 * - 6 文件拆分: constants.tsx + useWorkbenchState.ts + WorkbenchColumns.tsx + WorkbenchPage.tsx
 * 抽取自 715 行原始文件 (P2-9 Phase 65)
 */
import React from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Typography,
  Statistic,
  Spin,
  Empty,
  Button,
  Space,
  Badge,
} from 'antd';
import {
  ReloadOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  OrderedListOutlined,
  CloudUploadOutlined,
  LinkOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import DataState from '@/components/DataState';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { COLORS } from './constants';
import { useWorkbenchState } from './useWorkbenchState';
import {
  usePipelineColumns,
  useAlertColumns,
  useTicketColumns,
  useDeploymentColumns,
} from './WorkbenchColumns';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const WorkbenchPage: React.FC = () => {
  const { data, loading, error, lastRefresh, fetchData, handleAcknowledge } =
    useWorkbenchState();

  const pipelineColumns = usePipelineColumns();
  const alertColumns = useAlertColumns({ handleAcknowledge });
  const ticketColumns = useTicketColumns();
  const deploymentColumns = useDeploymentColumns();

  // Loading skeleton
  if (loading && !data) {
    return (
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            个人工作台
          </Title>
        </div>
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="加载工作台数据..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <DataState loading={false} error={error} retry={fetchData}>
        {null}
      </DataState>
    );
  }

  // Empty state
  const isEmpty =
    !data ||
    (data.myPipelines.recentRuns.length === 0 &&
      data.myAlerts.recent.length === 0 &&
      data.myTickets.recent.length === 0 &&
      data.myDeployments.recent.length === 0);

  if (isEmpty && !loading) {
    return (
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: spacing.lg }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
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

  // Success rate calculation
  const successRate =
    data.myPipelines.successRate ||
    (data.myPipelines.recentRuns.length > 0
      ? Math.round(
          (data.myPipelines.recentRuns.filter((r) => r.status === 'success').length /
            data.myPipelines.recentRuns.length) *
            100,
        )
      : 0);

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div
        style={{
          marginBottom: spacing.lg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            个人工作台
          </Title>
          <Text type="secondary">
            统一运维视角 — 我的流水线 + 我的告警 + 我的工单 + 我的部署{' '}
            <ClockCircleOutlined style={{ marginLeft: spacing.sm }} />
            最后刷新: {dayjs(lastRefresh).format('HH:mm:ss')}
          </Text>
        </div>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchData} loading={loading}>
          刷新
        </Button>
      </div>

      <DataState loading={loading} error={error} empty={false} retry={fetchData}>
        {/* Summary Stat Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
          <Col xs={12} sm={12} md={6}>
            <Card size="small">
              <Statistic
                title="流水线成功率"
                value={successRate}
                suffix="%"
                prefix={<ThunderboltOutlined />}
                valueStyle={{
                  color: successRate >= 90 ? COLORS.success : COLORS.warning,
                }}
              />
              <Text type="secondary" style={{ fontSize: spacing[2] }}>
                {data.myPipelines.totalRuns24h > 0
                  ? `24h 运行 ${data.myPipelines.totalRuns24h} 次`
                  : `失败 ${data.myPipelines.failedRuns} 次`}
              </Text>
            </Card>
          </Col>

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
                  <span style={{ color: COLORS.error }}>{data.myTickets.overdue} 个超期</span>
                ) : (
                  '无超期'
                )}
              </Text>
            </Card>
          </Col>

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
