/**
 * DiffReport - 全局 Diff 报告 (4 Statistic + Table)
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { Card, Row, Col, Statistic, Table } from 'antd';
import { spacing } from '@/tokens';
import { reportColumns } from '../configColumns';
import type { ConfigDiffState } from '../useConfigDiffState';

interface DiffReportProps {
  state: ConfigDiffState;
}

export const DiffReport: React.FC<DiffReportProps> = ({ state }) => {
  const { report } = state;

  if (!report) return null;

  return (
    <Card title={`Diff Report — ${report.reportId}`} style={{ marginBottom: spacing.md }}>
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Statistic title="Total Configs" value={report.totalConfigs} />
        </Col>
        <Col span={6}>
          <Statistic title="Total Differences" value={report.summary?.totalDifferences ?? 0} />
        </Col>
        <Col span={6}>
          <Statistic
            title="Generated"
            value={report.generatedAt}
            valueStyle={{ fontSize: 12 }}
          />
        </Col>
        <Col span={6}>
          <Statistic title="Environments" value={report.environments?.length ?? 0} />
        </Col>
      </Row>
      <Table
        columns={reportColumns}
        dataSource={report.items}
        rowKey="configId"
        pagination={{ pageSize: 10 }}
        size="small"
      />
    </Card>
  );
};
