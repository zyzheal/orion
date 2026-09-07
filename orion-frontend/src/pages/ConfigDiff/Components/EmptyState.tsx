/**
 * EmptyState - 未选择配置时的空状态提示
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { Card, Typography } from 'antd';
import { DiffOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const EmptyState: React.FC = () => (
  <Card>
    <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.neutral[500] }}>
      <DiffOutlined style={{ fontSize: 48, marginBottom: spacing.md, display: 'block' }} />
      <Title level={4}>Select a config to compare versions</Title>
      <Text type="secondary">
        Choose a config from the list above, pick two versions, and hit Compare
      </Text>
    </div>
  </Card>
);
