/**
 * AssessmentTable - 风险评估记录表
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import { Table } from 'antd';
import type { RiskAssessment } from '@/api/risk';
import CardPanel from '@/components/CardPanel';
import { spacing } from '@/tokens';
import { buildAssessmentColumns } from '../riskColumns';
import type { RiskDashboardState } from '../useRiskDashboardState';

interface AssessmentTableProps {
  state: RiskDashboardState;
}

export const AssessmentTable: React.FC<AssessmentTableProps> = ({ state }) => {
  const { loading, assessments, openDetail, handleAcknowledge } = state;

  const columns = buildAssessmentColumns({ openDetail, handleAcknowledge });

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <CardPanel title="风险评估记录">
        <Table<RiskAssessment>
          columns={columns}
          dataSource={assessments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </CardPanel>
    </div>
  );
};
