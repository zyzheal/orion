/**
 * ApkCredentials security alert
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import React from 'react';
import { Alert } from 'antd';
import { spacing } from '@/tokens';

export const SecurityAlert: React.FC = () => (
  <Alert
    message="凭证安全说明"
    description="所有凭证都以加密形式存储在后端。在 Pipeline 配置中引用时，请使用 Secret 语法：${secrets.apk-{market}-credentials}"
    type="info"
    showIcon
    style={{ marginBottom: spacing.md }}
  />
);
