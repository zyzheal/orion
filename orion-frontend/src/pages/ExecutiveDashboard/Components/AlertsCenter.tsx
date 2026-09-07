/**
 * Executive Dashboard alerts center
 * 抽取自 index.tsx (P2-9 Phase 158)
 */
import { Col, Row, Tag } from 'antd';
import { spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import { GaugeChart, StatCard } from '@/components/charts';
import type { AlertCard } from '../types';

interface AlertsCenterProps {
  slaComplianceRate: number;
  alertCards: AlertCard[];
}

export const AlertsCenter = ({ slaComplianceRate, alertCards }: AlertsCenterProps) => (
  <div style={{ marginBottom: spacing.lg }}>
    <CardPanel title="告警中心" extra={<Tag color="red">需立即处理</Tag>}>
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.md }}>
        <Col xs={24} sm={8}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GaugeChart
              title="SLA合规率"
              value={slaComplianceRate}
              thresholds={{ warning: 85, danger: 90 }}
              direction="descend"
              size={160}
            />
          </div>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        {alertCards.map((alert) => (
          <Col xs={24} sm={12} lg={6} key={alert.title}>
            <StatCard
              title={alert.title}
              value={alert.value}
              suffix={alert.suffix}
              icon={<span style={{ color: alert.color }}>{alert.icon}</span>}
              color={alert.color}
            />
          </Col>
        ))}
      </Row>
    </CardPanel>
  </div>
);
