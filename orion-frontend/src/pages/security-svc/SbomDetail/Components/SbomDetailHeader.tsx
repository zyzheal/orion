/**
 * SBOM Detail page header
 */
import React from 'react';
import { Button, Typography } from 'antd';
import { ArrowLeftOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;

interface SbomDetailHeaderProps {
  onBack: () => void;
}

export const SbomDetailHeader: React.FC<SbomDetailHeaderProps> = ({ onBack }) => (
  <div style={{ marginBottom: spacing.lg }}>
    <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginBottom: spacing.md }}>
      返回
    </Button>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <SafetyCertificateOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
      SBOM 详情
    </Title>
  </div>
);
