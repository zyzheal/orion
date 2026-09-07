/**
 * AICMDBRecommendation page header
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
import React from 'react';
import { Typography } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const AICMDBRecommendationHeader: React.FC = () => (
  <>
    <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
      <RocketOutlined style={{ marginRight: 12, color: colors.purple[500] }} />
      AI CMDB 智能推荐
    </Title>
    <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
      智能关联分析 · 自动拓扑建议 · 异常检测
    </Text>
  </>
);
