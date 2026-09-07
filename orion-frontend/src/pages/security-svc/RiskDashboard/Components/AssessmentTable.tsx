/**
 * RiskDashboard assessment records table
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
import React, { useMemo } from 'react';
import { Card, Table } from 'antd';
import type { RiskAssessment } from '@/api/risk';
import { spacing } from '@/tokens';
import { buildAssessmentColumns } from '../riskColumns';

interface AssessmentTableProps {
  assessments: RiskAssessment[];
  loading: boolean;
  openDrawer: (record: RiskAssessment) => void;
}

export const AssessmentTable: React.FC<AssessmentTableProps> = ({
  assessments,
  loading,
  openDrawer,
}) => (
  <Card title="风险评估记录" style={{ marginBottom: spacing.lg }}>
    <Table<RiskAssessment>
      columns={useMemo(() => buildAssessmentColumns({ openDrawer }), [openDrawer])}
      dataSource={assessments}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 10 }}
      size="small"
    />
  </Card>
);
