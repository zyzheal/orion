/**
 * SBOM Header
 * 抽取自 index.tsx (P2-9 Phase 134)
 */
import React from 'react';
import { Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { cPrimary } from '../constants';

const { Title, Text } = Typography;

export const SBOMHeader: React.FC = () => (
  <>
    <Title level={2} style={{ marginBottom: 8 }}>
      <SafetyCertificateOutlined style={{ marginRight: 12, color: cPrimary }} />
      SBOM 供应链安全
    </Title>
    <Text type="secondary" style={{ marginBottom: spacing.lg, display: 'block' }}>
      软件物料清单 · 漏洞追踪 · 许可证合规
    </Text>
  </>
);
