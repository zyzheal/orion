/**
 * CodeScan header
 */
import React from 'react';
import { Typography } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const CodeScanHeader: React.FC = () => (
  <>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <CodeOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
      代码安全扫描 (SAST)
    </Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
      OWASP Top 10 静态分析 · 漏洞检测 · 修复建议
    </Text>
  </>
);
