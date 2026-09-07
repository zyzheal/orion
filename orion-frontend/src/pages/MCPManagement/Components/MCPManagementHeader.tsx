/**
 * MCPManagement header
 * 抽取自 index.tsx (P2-9 Phase 147)
 */
import React from 'react';
import { Typography } from 'antd';
import { CloudServerOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const MCPManagementHeader: React.FC = () => (
  <>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <CloudServerOutlined style={{ marginRight: spacing.sm, color: colors.info[500] }} />
      MCP 服务管理
    </Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
      管理 Model Context Protocol 服务注册、启停与工具发现（A7 + B6）。
    </Text>
  </>
);
