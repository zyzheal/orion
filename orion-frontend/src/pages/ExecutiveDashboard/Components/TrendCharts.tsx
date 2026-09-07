/**
 * Executive Dashboard trend charts (ticket volume + SLA compliance)
 * 抽取自 index.tsx (P2-9 Phase 158)
 */
import { Col, Row, Tag } from 'antd';
import { spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import { TrendLineChart, type TrendDataPoint } from '@/components/charts';

interface TrendChartsProps {
  ticketVolumeTrend: Array<{ period: string; created: number; resolved: number }>;
  slaComplianceTrend: Array<{ period: string; rate: number }>;
}

export const TrendCharts = ({ ticketVolumeTrend, slaComplianceTrend }: TrendChartsProps) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} xl={12}>
      <CardPanel title="工单量趋势（近14天）" extra={<Tag color="blue">30天数据</Tag>}>
        <TrendLineChart
          title="工单量趋势（近14天）"
          data={[
            ticketVolumeTrend.map(
              (d): TrendDataPoint => ({ period: d.period, value: d.created, label: '创建' }),
            ),
            ticketVolumeTrend.map(
              (d): TrendDataPoint => ({ period: d.period, value: d.resolved, label: '解决' }),
            ),
          ]}
          height={240}
        />
      </CardPanel>
    </Col>

    <Col xs={24} xl={12}>
      <CardPanel title="SLA合规率趋势（近14天）" extra={<Tag color="green">{'目标 >90%'}</Tag>}>
        <TrendLineChart
          title="SLA合规率趋势（近14天）"
          data={[
            slaComplianceTrend
              .slice(-14)
              .map((d): TrendDataPoint => ({ period: d.period, value: d.rate, label: 'SLA' })),
          ]}
          height={240}
          showArea={true}
          smooth={true}
        />
      </CardPanel>
    </Col>
  </Row>
);
