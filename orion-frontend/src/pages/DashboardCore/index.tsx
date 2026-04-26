/**
 * Dashboard Page (TASK-905)
 * Platform overview with KPIs, recent activity timeline, and quick access cards.
 *
 * Displays:
 * - MetricCard components for KPIs (pipeline success rate, deployment frequency, active alerts, system health)
 * - Recent activity timeline
 * - Quick action buttons
 */
import React from 'react';
import { Card, Row, Col, Typography, Space, Tag } from 'antd';
import { colors, spacing } from '@/tokens';
import {
  RocketOutlined,
  CloudUploadOutlined,
  BellOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import DashboardLayout from '@/components/DashboardLayout';
import CardPanel from '@/components/CardPanel';
import StatusBadge from '@/components/StatusBadge';
import Timeline, { type TimelineEvent } from '@/components/Timeline';
import {
  mockDashboardMetrics,
  mockRecentActivity,
  mockQuickActions,
} from '@/pages/__mocks__/mockData';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// Convert mock activity to Timeline events
const timelineEvents: TimelineEvent[] = mockRecentActivity.map((activity) => ({
  id: activity.id,
  title: activity.title,
  description: activity.description,
  time: activity.time,
  status: activity.status,
}));

// Icon map for quick actions
const quickActionIcons: Record<string, React.ReactNode> = {
  RocketOutlined: <RocketOutlined />,
  CloudUploadOutlined: <CloudUploadOutlined />,
  BellOutlined: <BellOutlined />,
  FileTextOutlined: <FileTextOutlined />,
};

const DashboardCore: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          工作台
        </Title>
        <Text type="secondary">
          平台运行概览 — {dayjs().format('YYYY-MM-DD HH:mm')}
        </Text>
      </div>

      {/* KPI Cards */}
      <div style={{ marginBottom: 24 }}>
        <DashboardLayout columns={4} gap={16}>
          {mockDashboardMetrics.map((metric) => (
            <MetricCard
              key={metric.id}
              title={metric.title}
              value={metric.value}
              unit={metric.unit}
              trend={metric.trend}
              trendPercent={metric.trendPercent}
              previousValue={metric.previousValue}
              color={metric.color}
            />
          ))}
        </DashboardLayout>
      </div>

      {/* Main content area */}
      <Row gutter={[16, 16]}>
        {/* Left column - Recent Activity */}
        <Col xs={24} xl={16}>
          <CardPanel title="最近活动" extra={<Tag color="blue">实时更新</Tag>}>
            <Timeline events={timelineEvents} maxItems={6} showMore mode="left" />
          </CardPanel>
        </Col>

        {/* Right column - Quick Actions + System Health */}
        <Col xs={24} xl={8}>
          {/* Quick Actions */}
          <CardPanel title="快速操作">
            <Row gutter={[12, 12]}>
              {mockQuickActions.map((action) => (
                <Col span={12} key={action.name}>
                  <Card
                    hoverable
                    size="small"
                    style={{
                      textAlign: 'center',
                      cursor: 'pointer',
                      height: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transition: 'all 0.3s',
                    }}
                    onClick={() => navigate(action.path)}
                  >
                    <div
                      style={{
                        fontSize: 28,
                        color: action.color,
                        marginBottom: 8,
                      }}
                    >
                      {quickActionIcons[action.icon]}
                    </div>
                    <Text style={{ fontSize: spacing[3] }}>{action.name}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </CardPanel>

          {/* System Health Summary */}
          <CardPanel title="系统健康">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {[
                { name: 'API Gateway', status: 'success' as const, latency: '45ms' },
                { name: 'Platform Service', status: 'success' as const, latency: '32ms' },
                { name: 'Database', status: 'success' as const, latency: '12ms' },
                { name: 'Event Bus', status: 'warning' as const, latency: '156ms' },
              ].map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: `1px solid ${colors.light.border.light}`,
                  }}
                >
                  <Space>
                    <StatusBadge status={item.status} size="small" showDot={false} variant="subtle" />
                    <Text>{item.name}</Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {item.latency}
                  </Text>
                </div>
              ))}
            </Space>
          </CardPanel>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardCore;
