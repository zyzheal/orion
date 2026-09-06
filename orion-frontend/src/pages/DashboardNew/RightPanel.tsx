/**
 * RightPanel.tsx - DashboardNew 右侧面板组件
 * 抽取自 DashboardNew/index.tsx (P2-9 Phase 67)
 * 包含: 效能看板入口 + 系统健康状态 + 快速操作 + 系统提醒
 */
import React from 'react';
import { Card, Row, Col, Space, Badge, Button, Typography } from 'antd';
import {
  DashboardOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { dashboardLinks, quickActions, statusColors } from './constants';
import type { SystemHealthItem } from './types';

const { Text, Paragraph } = Typography;

// ---- 效能看板入口 ----
export const DashboardLinksCard: React.FC<{ navigate: (path: string) => void }> = ({
  navigate,
}) => (
  <Card
    title={
      <Space>
        <DashboardOutlined />
        效能看板
      </Space>
    }
    extra={
      <Button type="link" size="small" onClick={() => navigate('/dashboard/executive')}>
        查看全部
      </Button>
    }
    style={{ marginBottom: spacing.md }}
  >
    <Row gutter={[12, 12]}>
      {dashboardLinks.map((link) => (
        <Col span={12} key={link.name}>
          <Card
            hoverable
            size="small"
            onClick={() => navigate(link.path)}
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              height: 110,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              border: `1px solid ${colors.light?.border?.light || colors.neutral[200]}`,
              transition: 'all 0.3s',
            }}
          >
            <div style={{ fontSize: spacing[6], color: link.color, marginBottom: 6 }}>
              {link.icon}
            </div>
            <Text strong style={{ fontSize: spacing[3] }}>
              {link.name}
            </Text>
            <Text type="secondary" style={{ fontSize: spacing[2], marginTop: 2 }}>
              {link.desc}
            </Text>
          </Card>
        </Col>
      ))}
    </Row>
  </Card>
);

// ---- 系统健康状态 ----
export const SystemHealthCard: React.FC<{ health: SystemHealthItem[] }> = ({ health }) => (
  <Card title="系统健康状态" style={{ marginBottom: spacing.md }}>
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {health.map((item) => (
        <div
          key={item.name}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: `1px solid ${colors.neutral[50] || colors.neutral[100]}`,
          }}
        >
          <Space>
            <Badge status={statusColors[item.status] as 'success' | 'warning' | 'error'} />
            <Text>{item.name}</Text>
          </Space>
          <Space>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              {item.latency}
            </Text>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              {item.uptime}
            </Text>
          </Space>
        </div>
      ))}
    </Space>
  </Card>
);

// ---- 快速操作 ----
export const QuickActionsCard: React.FC<{ navigate: (path: string) => void }> = ({
  navigate,
}) => (
  <Card title="快速操作" style={{ marginBottom: spacing.md }}>
    <Row gutter={[12, 12]}>
      {quickActions.map((action) => (
        <Col span={12} key={action.name}>
          <Card
            hoverable
            size="small"
            onClick={() => navigate(action.path)}
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
          >
            <div style={{ fontSize: 28, color: action.color, marginBottom: spacing.sm }}>
              {action.icon}
            </div>
            <Text style={{ fontSize: spacing[3] }}>{action.name}</Text>
          </Card>
        </Col>
      ))}
    </Row>
  </Card>
);

// ---- 系统提醒 ----
export const AlertsCard: React.FC<{
  failed: number;
  running: number;
}> = ({ failed, running }) => (
  <Card title="系统提醒">
    {failed > 0 && (
      <Paragraph
        type="secondary"
        style={{ fontSize: spacing[3], marginBottom: spacing.sm }}
      >
        <WarningOutlined style={{ color: colors.warning[500], marginRight: spacing.sm }} />
        {failed} 个 Pipeline 运行失败，请检查
      </Paragraph>
    )}
    {running > 0 && (
      <Paragraph
        type="secondary"
        style={{ fontSize: spacing[3], marginBottom: spacing.sm }}
      >
        <RocketOutlined style={{ color: colors.primary[500], marginRight: spacing.sm }} />
        {running} 个 Pipeline 正在运行中
      </Paragraph>
    )}
    <Paragraph type="secondary" style={{ fontSize: spacing[3] }}>
      <CheckCircleOutlined style={{ color: colors.success[500], marginRight: spacing.sm }} />
      系统运行正常
    </Paragraph>
  </Card>
);
