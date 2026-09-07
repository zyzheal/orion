/**
 * ManagerDashboard MemberPerformanceChart
 * 抽取自 index.tsx (P2-9 Phase 181)
 */
import { Tag } from 'antd';
import CardPanel from '@/components/CardPanel';
import { BarChart } from '@/components/charts';
import { spacing } from '@/tokens';
import type { ManagerDashboardData } from '@/types/pages';

type MemberMetrics = ManagerDashboardData['memberMetrics'];

interface MemberPerformanceChartProps {
  memberMetrics: MemberMetrics;
}

export const MemberPerformanceChart = ({ memberMetrics }: MemberPerformanceChartProps) => (
  <div style={{ marginBottom: spacing.lg }}>
    <CardPanel title="团队绩效分布" extra={<Tag color="blue">{memberMetrics.length} 人</Tag>}>
      <BarChart
        data={memberMetrics.map((m) => ({
          label: m.engineerName,
          value: m.workload.totalResolved,
        }))}
        height={280}
      />
    </CardPanel>
  </div>
);
