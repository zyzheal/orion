/**
 * ManagerDashboard WowSection
 * 抽取自 index.tsx (P2-9 Phase 181)
 */
import { Row, Col, Tag } from 'antd';
import CardPanel from '@/components/CardPanel';
import { StatCard } from '@/components/charts';
import { spacing } from '@/tokens';
import type { ManagerDashboardData } from '@/types/pages';

type WeekOverWeek = ManagerDashboardData['weekOverWeek'];

interface WowSectionProps {
  weekOverWeek: WeekOverWeek;
}

export const WowSection = ({ weekOverWeek }: WowSectionProps) => {
  const wowMetrics = [
    { label: '工单创建', value: weekOverWeek.ticketsCreatedChange, suffix: '%' },
    { label: '已解决', value: weekOverWeek.resolvedChange, suffix: '%' },
    { label: '平均解决时间', value: weekOverWeek.avgResolutionTimeChange, suffix: '%' },
    { label: 'SLA合规率', value: weekOverWeek.slaComplianceChange, suffix: '%' },
  ];

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <CardPanel title="环比变化（vs 上周）" extra={<Tag color="cyan">周环比</Tag>}>
        <Row gutter={[16, 16]}>
          {wowMetrics.map((metric) => {
            const isGoodUp = metric.label !== '平均解决时间';
            const trendDir = metric.value > 0 ? 'up' : metric.value < 0 ? 'down' : 'flat';
            return (
              <Col xs={24} sm={12} lg={6} key={metric.label}>
                <StatCard
                  title={metric.label}
                  value={`${metric.value > 0 ? '+' : ''}${metric.value}`}
                  suffix={metric.suffix}
                  trend={{
                    value: Math.abs(metric.value),
                    direction: trendDir,
                    good: isGoodUp ? 'up' : 'down',
                  }}
                />
              </Col>
            );
          })}
        </Row>
      </CardPanel>
    </div>
  );
};
