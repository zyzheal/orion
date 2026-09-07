/**
 * DataQualityFix Page
 * 拆分 (P2-9 Phase 146): types / constants / helpers / useDataQualityFixState /
 * issueColumns / Components/{Header,StatsRow,IssuesTable,QualityScoreCard,QualityTrendChart,RepairHistoryCard} / index
 */
import React from 'react';
import { Card, Col, Row } from 'antd';
import { spacing } from '@/tokens';
import { useDataQualityFixState } from './useDataQualityFixState';
import { DataQualityFixHeader } from './Components/DataQualityFixHeader';
import { StatsRow } from './Components/StatsRow';
import { IssuesTable } from './Components/IssuesTable';
import { QualityScoreCard } from './Components/QualityScoreCard';
import { QualityTrendChart } from './Components/QualityTrendChart';
import { RepairHistoryCard } from './Components/RepairHistoryCard';

const DataQualityFixPage: React.FC = () => {
  const state = useDataQualityFixState();

  return (
    <div>
      <DataQualityFixHeader />

      <StatsRow
        ruleCount={state.ruleCount}
        problemCount={state.problemCount}
        fixedCount={state.fixedCount}
        pendingCount={state.pendingCount}
      />

      <Row gutter={[spacing.md, spacing.md]} style={{ marginTop: spacing.md }}>
        <Col span={14}>
          <IssuesTable
            issues={state.filteredIssues}
            filterType={state.filterType}
            onFilterTypeChange={state.setFilterType}
            filterSeverity={state.filterSeverity}
            onFilterSeverityChange={state.setFilterSeverity}
            filterStatus={state.filterStatus}
            onFilterStatusChange={state.setFilterStatus}
          />
        </Col>
        <Col span={10}>
          <QualityScoreCard overallScore={state.overallScore} />
          <Card title="质量趋势 (7天)" style={{ marginTop: spacing.md }}>
            <QualityTrendChart />
          </Card>
        </Col>
      </Row>

      <RepairHistoryCard />
    </div>
  );
};

export default DataQualityFixPage;
