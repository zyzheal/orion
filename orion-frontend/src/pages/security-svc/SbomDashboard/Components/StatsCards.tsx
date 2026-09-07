/**
 * SbomDashboard StatsCards
 * 抽取自 index.tsx (P2-9 Phase 170)
 */
import { Row, Col } from 'antd';
import { GaugeChart, StatCard } from '@/components/charts';
import { spacing } from '@/tokens';
import type { SbomComplianceReport } from '@/api/sbom';

interface StatsCardsProps {
  documentsCount: number;
  activeDocs: number;
  totalPackages: number;
  compliance: SbomComplianceReport | null;
}

export const StatsCards = ({
  documentsCount,
  activeDocs,
  totalPackages,
  compliance,
}: StatsCardsProps) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <StatCard title="SBOM 总数" value={documentsCount} suffix="个" />
    </Col>
    <Col span={6}>
      <StatCard
        title="覆盖率"
        value={Math.round((activeDocs / Math.max(documentsCount, 1)) * 100)}
        suffix="%"
      />
    </Col>
    <Col span={6}>
      <StatCard title="总包数" value={totalPackages} />
    </Col>
    <Col span={6}>
      <GaugeChart
        value={compliance?.complianceRate || 0}
        title="合规评分"
        max={100}
        thresholds={{ warning: 80, danger: 60 }}
        direction="descend"
        size={140}
        unit="%"
      />
    </Col>
  </Row>
);
