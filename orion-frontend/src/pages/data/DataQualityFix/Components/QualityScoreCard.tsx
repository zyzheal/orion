/**
 * DataQualityFix quality score card
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import React from 'react';
import { Card, Progress, Space, Typography } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { MOCK_DIMENSIONS } from '../constants';
import { getScoreColor } from '../helpers';

const { Text } = Typography;

export interface QualityScoreCardProps {
  overallScore: number;
}

export const QualityScoreCard: React.FC<QualityScoreCardProps> = ({ overallScore }) => (
  <Card title="数据质量评分" style={{ marginTop: spacing.md }}>
    <div style={{ textAlign: 'center', marginBottom: spacing.lg }}>
      <div style={{ fontSize: 56, fontWeight: 700, color: getScoreColor(overallScore) }}>
        {overallScore}
      </div>
      <div style={{ color: colors.neutral[500], marginTop: 4 }}>整体质量得分</div>
    </div>
    <Space direction="vertical" style={{ width: '100%' }} size={spacing.md}>
      {MOCK_DIMENSIONS.map((dim) => (
        <div key={dim.name}>
          <div style={{ marginBottom: 4 }}>
            <Text>{dim.name}</Text>
            <Text style={{ float: 'right', color: getScoreColor(dim.score) }}>
              {dim.score}
            </Text>
          </div>
          <Progress
            percent={dim.score}
            showInfo={false}
            strokeColor={getScoreColor(dim.score)}
          />
        </div>
      ))}
    </Space>
  </Card>
);
