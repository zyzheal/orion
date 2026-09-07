/**
 * ManagerDashboard TeamOverview
 * 抽取自 index.tsx (P2-9 Phase 181)
 */
import { Row, Col } from 'antd';
import CardPanel from '@/components/CardPanel';
import { GaugeChart, StatCard } from '@/components/charts';
import { spacing } from '@/tokens';
import type { ManagerDashboardData } from '@/types/pages';

type TeamOverview = ManagerDashboardData['teamOverview'];

interface TeamOverviewProps {
  teamOverview: TeamOverview;
}

export const TeamOverview = ({ teamOverview }: TeamOverviewProps) => (
  <div style={{ marginBottom: spacing.lg }}>
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={8} xl={4}>
        <CardPanel>
          <StatCard title="总工单数" value={teamOverview.totalTickets} suffix="个" />
        </CardPanel>
      </Col>
      <Col xs={24} sm={12} lg={8} xl={4}>
        <CardPanel>
          <StatCard title="已解决" value={teamOverview.resolvedCount} suffix="个" />
        </CardPanel>
      </Col>
      <Col xs={24} sm={12} lg={8} xl={4}>
        <CardPanel>
          <StatCard
            title="平均解决时间"
            value={teamOverview.avgResolutionTimeHours}
            suffix="h"
          />
        </CardPanel>
      </Col>
      <Col xs={24} sm={12} lg={8} xl={4}>
        <CardPanel>
          <StatCard
            title="SLA合规率"
            value={teamOverview.slaComplianceRate}
            suffix="%"
          />
        </CardPanel>
      </Col>
      <Col xs={24} sm={12} lg={8} xl={8}>
        <CardPanel>
          <GaugeChart
            value={teamOverview.teamLoadPercentage}
            title="团队负载"
            max={100}
            thresholds={{ warning: 70, danger: 90 }}
            size={160}
            unit="%"
          />
        </CardPanel>
      </Col>
    </Row>
  </div>
);
