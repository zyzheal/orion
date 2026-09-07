/**
 * ChaosEngineering Resilience Score Card
 * 抽取自 index.tsx (P2-9 Phase 132)
 */
import React from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { ResilienceScore } from '@/api/chaos';

interface ResilienceScoreCardProps {
  score: ResilienceScore | null;
}

export const ResilienceScoreCard: React.FC<ResilienceScoreCardProps> = ({ score }) => (
  <Card
    title={
      <>
        <SafetyOutlined style={{ marginRight: spacing.sm }} />
        系统弹性评分
      </>
    }
    style={{ marginBottom: spacing.lg }}
  >
    <Row gutter={24}>
      <Col span={6}>
        <Statistic title="弹性评分" value={score?.score ?? 0} suffix="/ 100" />
        <Progress
          percent={score?.score ?? 0}
          status={
            score && score.score >= 80
              ? 'success'
              : score && score.score >= 60
                ? 'normal'
                : 'exception'
          }
          style={{ marginTop: spacing.sm }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="平均恢复时间 (MTTR)"
          value={score?.mttr_ms ?? 0}
          suffix="ms"
          valueStyle={{
            color: score && score.mttr_ms < 5000 ? colors.success[500] : colors.warning[500],
          }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="实验成功率"
          value={(score?.success_rate ?? 0) * 100}
          precision={1}
          suffix="%"
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="趋势"
          value={score?.trend || 'stable'}
          valueStyle={{
            color:
              score?.trend === 'improving'
                ? colors.success[500]
                : score?.trend === 'degrading'
                  ? colors.error[400]
                  : colors.neutral[400],
          }}
        />
      </Col>
    </Row>
  </Card>
);
