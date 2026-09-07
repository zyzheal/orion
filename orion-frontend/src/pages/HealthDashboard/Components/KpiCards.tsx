/**
 * KpiCards - 4 个 KPI 卡片
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import React from 'react';
import { Card, Col, Row, Statistic, Tag } from 'antd';
import {
  HeartOutlined,
  AlertOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { HealthDashboardState } from '../useHealthDashboardState';

interface KpiCardsProps {
  state: HealthDashboardState;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ state }) => {
  const { score, activeAlerts, avgLatencyMs, errorRate } = state;

  return (
    <Row gutter={16} style={{ marginBottom: spacing.lg }}>
      <Col xs={24} sm={12}>
        <Card>
          <Statistic
            title="健康评分"
            value={score?.score ?? 0}
            suffix="/ 100"
            valueStyle={{
              color:
                (score?.score ?? 0) >= 80
                  ? colors.success[500]
                  : (score?.score ?? 0) >= 60
                    ? colors.warning[500]
                    : colors.error[500],
            }}
            prefix={<HeartOutlined />}
          />
          {score && (
            <div style={{ marginTop: 4 }}>
              <Tag
                color={
                  score.level === 'healthy'
                    ? colors.success[500]
                    : score.level === 'warning'
                      ? colors.warning[500]
                      : colors.error[500]
                }
              >
                {score.level === 'healthy'
                  ? '健康'
                  : score.level === 'warning'
                    ? '警告'
                    : '严重'}
              </Tag>
            </div>
          )}
        </Card>
      </Col>
      <Col xs={24} sm={12}>
        <Card>
          <Statistic
            title="活跃告警"
            value={activeAlerts}
            valueStyle={{ color: activeAlerts > 0 ? colors.error[500] : colors.success[500] }}
            prefix={<AlertOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12}>
        <Card>
          <Statistic
            title="平均延迟"
            value={avgLatencyMs}
            suffix="ms"
            valueStyle={{
              color: avgLatencyMs > 200 ? colors.warning[500] : colors.success[500],
            }}
            prefix={<ClockCircleOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12}>
        <Card>
          <Statistic
            title="全局错误率"
            value={errorRate}
            suffix="%"
            precision={2}
            valueStyle={{
              color:
                errorRate > 2
                  ? colors.error[500]
                  : errorRate > 0.5
                    ? colors.warning[500]
                    : colors.success[500],
            }}
            prefix={<WarningOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
};
