/**
 * PageHeader.tsx - ScriptRunner 页面头部
 * 抽取自 index.tsx (P2-9 Phase 230)
 */
import React from 'react';
import { Typography } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

export const PageHeader: React.FC = () => (
  <div style={{ marginBottom: spacing.lg }}>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <CodeOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
      在线脚本执行
    </Title>
    <Text type="secondary">在线编写、执行和安全扫描脚本代码</Text>
  </div>
);
