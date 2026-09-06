/**
 * EvalSetStatsRow.tsx - 评测统计卡片行
 * 抽取自 EvalSetManagement/index.tsx (P2-9 Phase 60)
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { FormOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { EvalSet, EvalRun } from './types';

export interface EvalSetStatsRowProps {
  sets: EvalSet[];
  runs: EvalRun[];
}

export const EvalSetStatsRow: React.FC<EvalSetStatsRowProps> = ({ sets, runs }) => {
  const totalCases = sets.reduce((sum, s) => sum + (s.cases?.length || 0), 0);
  const firstRun = runs[0];
  const recentPassRate = firstRun?.total_count
    ? `${((firstRun.pass_count / firstRun.total_count) * 100).toFixed(1)}%`
    : '-';

  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card size="small">
          <Statistic title="评测集总数" value={sets.length} prefix={<FormOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="评测用例总数" value={totalCases} prefix={<EyeOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic title="评测运行数" value={runs.length} prefix={<PlayCircleOutlined />} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small">
          <Statistic
            title="最近通过率"
            value={recentPassRate}
            valueStyle={{
              color: firstRun?.pass_count > 0 ? colors.success[500] : colors.neutral[500],
            }}
          />
        </Card>
      </Col>
    </Row>
  );
};
