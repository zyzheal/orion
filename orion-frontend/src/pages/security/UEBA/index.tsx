/**
 * UEBA ML User Behavior Anomaly Detection Page
 * P3-14 - 用户行为异常检测
 * 纯前端 Mock 数据：行为基线学习、离群值检测、风险评分
 * Refactored in P2-9 Phase 135.
 */
import React from 'react';
import { Row, Col } from 'antd';
import { spacing } from '@/tokens';
import { useUebaState } from './useUebaState';
import { UEBAHeader } from './Components/UEBAHeader';
import { UEBAStatsRow } from './Components/UEBAStatsRow';
import { AnomalyEventsCard } from './Components/AnomalyEventsCard';
import { RiskRankCard } from './Components/RiskRankCard';
import { DetectionConfigCard } from './Components/DetectionConfigCard';

const UEBAPage: React.FC = () => {
  const state = useUebaState();

  return (
    <div>
      <UEBAHeader />

      <UEBAStatsRow
        monitoredUsers={state.monitoredUsers}
        anomalyEvents={state.anomalyEvents}
        highRiskUsers={state.highRiskUsers}
        modelAccuracy={state.modelAccuracy}
      />

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
        <Col span={14}>
          <AnomalyEventsCard
            filteredEvents={state.filteredEvents}
            typeFilter={state.typeFilter}
            setTypeFilter={state.setTypeFilter}
            levelFilter={state.levelFilter}
            setLevelFilter={state.setLevelFilter}
          />
        </Col>
        <Col span={10}>
          <RiskRankCard riskRanks={state.mockRiskRanks} />
        </Col>
      </Row>

      <DetectionConfigCard configForm={state.configForm} config={state.config} />
    </div>
  );
};

export default UEBAPage;
