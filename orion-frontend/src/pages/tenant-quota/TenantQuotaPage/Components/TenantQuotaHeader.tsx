/**
 * TenantQuotaPage Header
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import React from 'react';
import { Typography } from 'antd';
import { ClusterOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

export const TenantQuotaHeader: React.FC = () => (
  <>
    <Typography.Title level={2} style={{ marginBottom: 8 }}>
      <ClusterOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      多租户配额管理
    </Typography.Title>
    <Typography.Text
      type="secondary"
      style={{ marginBottom: spacing.md, display: 'block' }}
    >
      配额计划配置 · 用量实时监控 · 超额告警
    </Typography.Text>
  </>
);
