/**
 * StatsBar
 * API 网关路由统计卡（抽取自 index.tsx）
 */
import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import {
  GatewayOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import type { GatewayRoute, GatewayRouteStats } from '@/api/gateway-routes';

export interface StatsBarProps {
  stats: GatewayRouteStats | null;
  routes: GatewayRoute[];
  loading: boolean;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, routes, loading }) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} sm={12} md={6}>
      <Card
        size="small"
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <Statistic
          title="路由总数"
          value={stats?.total ?? routes.length}
          prefix={<GatewayOutlined style={{ color: colors.primary[500] }} />}
          loading={loading}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} md={6}>
      <Card
        size="small"
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <Statistic
          title="已启用"
          value={stats?.enabled ?? routes.filter((r) => r.enabled).length}
          prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
          loading={loading}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} md={6}>
      <Card
        size="small"
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <Statistic
          title="已禁用"
          value={stats?.disabled ?? routes.filter((r) => !r.enabled).length}
          prefix={<CloseCircleOutlined style={{ color: colors.neutral[500] }} />}
          loading={loading}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} md={6}>
      <Card
        size="small"
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: spacing.lg } }}
      >
        <Statistic
          title="总请求量"
          value={stats?.totalRequests ?? routes.reduce((sum, r) => sum + (r.requestCount || 0), 0)}
          prefix={<ApiOutlined style={{ color: colors.info[500] }} />}
          loading={loading}
        />
      </Card>
    </Col>
  </Row>
);
