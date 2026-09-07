/**
 * AISecurityStatsRow - 4 个 MetricCard 统计
 * 抽取自 index.tsx (P2-9 Phase 118)
 */
import React from 'react';
import { Col, Row } from 'antd';
import { SafetyOutlined, SecurityScanOutlined, StopOutlined } from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import type { AISecurityState } from '../useAISecurityState';

interface AISecurityStatsRowProps {
  state: AISecurityState;
}

export const AISecurityStatsRow: React.FC<AISecurityStatsRowProps> = ({ state }) => {
  const { stats, getComplianceColor } = state;

  if (!stats) return null;

  return (
    <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
      <Col span={6}>
        <MetricCard
          title="策略活跃数"
          value={stats.policiesActive}
          icon={<SecurityScanOutlined style={{ fontSize: 20, color: colors.success[500] }} />}
          color={colors.success[500]}
        />
      </Col>
      <Col span={6}>
        <MetricCard
          title="请求已拦截"
          value={stats.requestsBlocked}
          icon={<StopOutlined style={{ fontSize: 20, color: colors.error[500] }} />}
          color={colors.error[500]}
        />
      </Col>
      <Col span={6}>
        <MetricCard
          title="敏感数据检测"
          value={stats.sensitiveDataDetected}
          icon={<SafetyOutlined style={{ fontSize: 20, color: colors.warning[500] }} />}
          color={colors.warning[500]}
        />
      </Col>
      <Col span={6}>
        <MetricCard
          title="合规评分"
          value={`${stats.complianceScore}%`}
          icon={
            <SafetyOutlined
              style={{ fontSize: 20, color: getComplianceColor(stats.complianceScore) }}
            />
          }
          color={getComplianceColor(stats.complianceScore)}
        />
      </Col>
    </Row>
  );
};
