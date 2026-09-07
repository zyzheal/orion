/**
 * SBOM Dashboard header
 * 抽取自 index.tsx (P2-9 Phase 148)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined, SafetyOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface SbomDashboardHeaderProps {
  loading: boolean;
  onRefresh: () => void;
  onCreateWaiver: () => void;
}

export const SbomDashboardHeader: React.FC<SbomDashboardHeaderProps> = ({
  loading,
  onRefresh,
  onCreateWaiver,
}) => (
  <div
    style={
      {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      } as React.CSSProperties
    }
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <SafetyOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        SBOM 供应链仪表盘
      </Title>
      <Text type="secondary">软件物料清单与漏洞管理</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreateWaiver}>
        创建豁免
      </Button>
    </Space>
  </div>
);
