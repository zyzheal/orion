/**
 * RiskDashboard detail drawer
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
import React from 'react';
import { Descriptions, Drawer, Tag, Timeline, Typography } from 'antd';
import type { RiskAssessment } from '@/api/risk';
import { colors, spacing } from '@/tokens';
import { RISK_LEVEL_COLOR } from '../constants';

const { Title, Text } = Typography;

interface DetailDrawerProps {
  open: boolean;
  selectedAssessment: RiskAssessment | null;
  onClose: () => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  open,
  selectedAssessment,
  onClose,
}) => (
  <Drawer title="风险评估详情" placement="right" width={700} open={open} onClose={onClose}>
    {selectedAssessment && (
      <>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="ID">{selectedAssessment.id}</Descriptions.Item>
          <Descriptions.Item label="目标类型">
            {selectedAssessment.targetType}
          </Descriptions.Item>
          <Descriptions.Item label="目标 ID">{selectedAssessment.targetId}</Descriptions.Item>
          <Descriptions.Item label="风险等级">
            <Tag color={RISK_LEVEL_COLOR[selectedAssessment.riskLevel]}>
              {selectedAssessment.riskLevel.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="风险评分">
            {selectedAssessment.riskScore.toFixed(0)}
          </Descriptions.Item>
          <Descriptions.Item label="状态">{selectedAssessment.status}</Descriptions.Item>
          <Descriptions.Item label="评估者">
            {selectedAssessment.assessedBy}
          </Descriptions.Item>
          <Descriptions.Item label="评估时间">
            {new Date(selectedAssessment.assessedAt).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>

        <Title level={5} style={{ marginTop: spacing.lg }}>
          风险因素
        </Title>
        <Timeline>
          {selectedAssessment.factors.map((factor, index) => (
            <Timeline.Item
              key={String(index)}
              color={
                factor.status === 'pass'
                  ? 'green'
                  : factor.status === 'warning'
                    ? 'orange'
                    : 'red'
              }
            >
              <div>
                <Text strong>{factor.name}</Text>
                <div style={{ fontSize: spacing[3], color: colors.neutral[400] }}>
                  {factor.category}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">{factor.description}</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text>
                    评分：{factor.score} | 权重：{factor.weight}
                  </Text>
                </div>
              </div>
            </Timeline.Item>
          ))}
        </Timeline>

        {selectedAssessment.recommendations.length > 0 && (
          <>
            <Title level={5}>改进建议</Title>
            <ul>
              {selectedAssessment.recommendations.map((rec, index) => (
                <li key={String(index)}>{rec}</li>
              ))}
            </ul>
          </>
        )}
      </>
    )}
  </Drawer>
);
