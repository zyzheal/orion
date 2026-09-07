/**
 * DataQualityFix header
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import React from 'react';
import { Typography } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

export const DataQualityFixHeader: React.FC = () => (
  <>
    <Title level={2} style={{ marginBottom: 8 }}>
      <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      数据质量自动修复
    </Title>
    <Text type="secondary">质量检测 · 自动修复建议 · 数据血缘追踪</Text>
  </>
);
