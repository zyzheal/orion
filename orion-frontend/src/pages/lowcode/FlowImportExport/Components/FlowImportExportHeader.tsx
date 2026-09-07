/**
 * FlowImportExport page header
 * 抽取自 index.tsx (P2-9 Phase 138)
 */
import React from 'react';
import { Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

export const FlowImportExportHeader: React.FC = () => (
  <Typography.Title level={2} style={{ marginBottom: spacing.md }}>
    <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    流程导入/导出
  </Typography.Title>
);
