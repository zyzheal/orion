/**
 * SBOM Dashboard stats row
 * 抽取自 index.tsx (P2-9 Phase 148)
 */
import React from 'react';
import { Col, Row } from 'antd';
import { StatCard, GaugeChart } from '@/components/charts';
import { spacing } from '@/tokens';
import type { SbomComplianceReport } from '../types';

interface StatsRowProps {
  documents: unknown[];
  compliance: SbomComplianceReport | null;
  totalPackages: number;
  activeDocs: number;
}

export const StatsRow: React.FC<StatsRowProps> = ({
  documents,
  compliance,
  totalPackages,
  activeDocs,
}) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <StatCard title="SBOM 总数" value={documents.length} suffix="个" />
    </Col>
    <Col span={6}>
      <StatCard
        title="覆盖率"
        value={Math.round((activeDocs / Math.max(documents.length, 1)) * 100)}
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
