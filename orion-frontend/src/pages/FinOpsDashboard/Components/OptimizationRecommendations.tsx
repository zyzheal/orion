/**
 * OptimizationRecommendations - 优化建议
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import React from 'react';
import { Button, Card, Space, Tag, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import type { FinOpsDashboardState } from '../useFinOpsDashboardState';
import { effortConfig, optimizationStatusConfig } from '../constants';

const { Text } = Typography;

interface OptimizationRecommendationsProps {
  state: FinOpsDashboardState;
}

export const OptimizationRecommendations: React.FC<OptimizationRecommendationsProps> = ({
  state,
}) => {
  const { loading, optimizations, handleApplyOptimization } = state;

  return (
    <Card
      title="优化建议"
      bordered={false}
      style={{ borderRadius: 8, marginBottom: spacing.md }}
      loading={loading}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {optimizations.map((opt) => (
          <Card
            key={opt.key}
            size="small"
            style={{ borderRadius: 6 }}
            extra={
              opt.status === 'pending' ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => handleApplyOptimization(opt.key)}
                >
                  应用
                </Button>
              ) : (
                <Tag color={optimizationStatusConfig[opt.status].color}>
                  {optimizationStatusConfig[opt.status].label}
                </Tag>
              )
            }
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text strong>{opt.title}</Text>
                <Tag color={effortConfig[opt.effort].color}>
                  {effortConfig[opt.effort].label}
                </Tag>
              </div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                {opt.description}
              </Text>
              <Text strong style={{ color: colors.success[500], fontSize: spacing[4] }}>
                预计节省 ¥{opt.savings.toLocaleString()}/月
              </Text>
            </Space>
          </Card>
        ))}
      </Space>
    </Card>
  );
};
