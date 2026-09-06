/**
 * Components/StatsCards.tsx - 灾备 4 卡片统计
 * 抽取自 DisasterRecovery/index.tsx (P2-9 Phase 100)
 */
import React from 'react';
import { Row, Col, Card, Statistic, Typography } from 'antd';
import {
  ClockCircleOutlined,
  HistoryOutlined,
  PieChartOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

interface StatsCardsProps {
  rtoTarget: string;
  rpoTarget: string;
  lastDrill: string;
  coverage: number;
}

const cardBaseStyle = (borderColor: string) => ({
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  borderLeft: `3px solid ${borderColor}`,
});

export const StatsCards: React.FC<StatsCardsProps> = ({ rtoTarget, rpoTarget, lastDrill, coverage }) => (
  <Row gutter={spacing.md} style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
    <Col span={6}>
      <Card style={cardBaseStyle(colors.primary[500])}>
        <Statistic
          title="RTO 目标"
          value={rtoTarget}
          valueStyle={{ color: colors.primary[500] }}
          prefix={<ClockCircleOutlined />}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          恢复时间目标
        </Text>
      </Card>
    </Col>
    <Col span={6}>
      <Card style={cardBaseStyle(colors.success[500])}>
        <Statistic
          title="RPO 目标"
          value={rpoTarget}
          valueStyle={{ color: colors.success[500] }}
          prefix={<DatabaseOutlined />}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          恢复点目标
        </Text>
      </Card>
    </Col>
    <Col span={6}>
      <Card style={cardBaseStyle(colors.warning[500])}>
        <Statistic
          title="上次演练"
          value={lastDrill}
          valueStyle={{ color: colors.warning[500] }}
          prefix={<HistoryOutlined />}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          最近演练时间
        </Text>
      </Card>
    </Col>
    <Col span={6}>
      <Card style={cardBaseStyle(colors.info[500])}>
        <Statistic
          title="灾备覆盖率"
          value={coverage}
          valueStyle={{ color: colors.info[500] }}
          suffix="%"
          prefix={<PieChartOutlined />}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          系统灾备覆盖比例
        </Text>
      </Card>
    </Col>
  </Row>
);
