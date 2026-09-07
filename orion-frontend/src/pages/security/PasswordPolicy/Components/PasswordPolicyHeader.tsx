/**
 * PasswordPolicy header
 * 抽取自 index.tsx (P2-9 Phase 144)
 */
import React from 'react';
import { Divider, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { COMMON_STYLE } from '../helpers';

const { Title, Text } = Typography;

export const PasswordPolicyHeader: React.FC = () => (
  <>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <LockOutlined style={{ marginRight: 12, color: COMMON_STYLE.primary }} />
      密码策略配置
    </Title>
    <Text type="secondary">密码强度 · 过期策略 · 历史密码 · bcrypt 轮数</Text>
    <Divider />
  </>
);
