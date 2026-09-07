/**
 * TemplateMarket Header
 * 抽取自 index.tsx (P2-9 Phase 141)
 */
import React from 'react';
import { Button } from 'antd';
import { AppstoreOutlined, ExportOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface TemplateMarketHeaderProps {
  onOpenPublish: () => void;
}

export const TemplateMarketHeader: React.FC<TemplateMarketHeaderProps> = ({ onOpenPublish }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    }}
  >
    <h2 style={{ marginBottom: 0, fontWeight: 600, color: colors.neutral[900] }} >
      <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      模板市场
    </h2>
    <Button icon={<ExportOutlined />} onClick={onOpenPublish}>
      发布为模板
    </Button>
  </div>
);
