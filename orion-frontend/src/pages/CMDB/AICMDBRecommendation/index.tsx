/**
 * AI CMDB Smart Recommendation Page (P3-06)
 * 智能推荐：自动关联分析、拓扑建议、异常检测
 * 对接后端 AI 推荐引擎：GET /api/v1/cmdb/recommendations
 *
 * 拆分自原单文件 (P2-9 Phase 139)
 */
import React from 'react';
import { Row, Col, Spin } from 'antd';
import { spacing } from '@/tokens';
import { useAICMDBRecommendationState } from './useAICMDBRecommendationState';
import { AICMDBRecommendationHeader } from './Components/AICMDBRecommendationHeader';
import { StatsRow } from './Components/StatsRow';
import { RecommendationListCard } from './Components/RecommendationListCard';
import { ModelStatusCard } from './Components/ModelStatusCard';
import { AnomalyDetectionCard } from './Components/AnomalyDetectionCard';

const AICMDBRecommendation: React.FC = () => {
  const state = useAICMDBRecommendationState();

  return (
    <Spin spinning={state.loading}>
      <div style={{ padding: spacing.lg }}>
        <AICMDBRecommendationHeader />

        <StatsRow
          totalRecs={state.totalRecs}
          pendingCount={state.pendingCount}
          anomalyCount={state.anomalyCount}
          avgAccuracy={state.avgAccuracy}
        />

        <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
          <Col span={14}>
            <RecommendationListCard
              recommendType={state.recommendType}
              setRecommendType={state.setRecommendType}
              recommendStatus={state.recommendStatus}
              setRecommendStatus={state.setRecommendStatus}
              filteredRecommendations={state.filteredRecommendations}
              handleAccept={state.handleAccept}
              handleReject={state.handleReject}
              fetchRecommendations={state.fetchRecommendations}
            />
          </Col>

          <Col span={10}>
            <ModelStatusCard
              modelStatus={state.modelStatus}
              retraining={state.retraining}
              handleRetrain={state.handleRetrain}
            />
          </Col>
        </Row>

        <AnomalyDetectionCard anomalies={state.anomalies} />
      </div>
    </Spin>
  );
};

export default AICMDBRecommendation;
