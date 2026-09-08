/**
 * ScoreRingCard - 综合评分卡
 * 抽取自 index.tsx (P2-9 Phase 212)
 */
import { Card, Row, Col, Typography } from 'antd';
import type { DomainKey } from '@/utils/efficacyScore';
import { spacing } from '@/tokens';
import ScoreRing from '@/components/EfficacyMetrics/ScoreRing';

const { Text } = Typography;

interface Props {
  domainScores: Record<DomainKey, number>;
}

export const ScoreRingCard = ({ domainScores }: Props) => (
  <Card style={{ marginBottom: spacing.md }}>
    <Row gutter={spacing.md}>
      <Col span={6}>
        <ScoreRing domainScores={domainScores} />
      </Col>
      <Col
        span={18}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: spacing.sm,
        }}
      >
        <Text style={{ fontSize: 15 }}>
          综合评分由六大域核心指标加权聚合：端到端交付成功率、管理域团队评分、工程域 DORA
          等级、合规域合规率、AI 提效采纳率、风险域弹性评分。
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          评分基准：Elite (≥80) = 世界级，High (60-79) = 优秀，Medium (40-59) = 中等，Low
          (&lt;40) = 待改进
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          数据来源：DORA API、Pipeline Runs、Team Comparison、Agent Runs、Risk Assessments
        </Text>
      </Col>
    </Row>
  </Card>
);
