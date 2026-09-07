/**
 * ContainerScan Header
 * 抽取自 index.tsx (P2-9 Phase 133)
 */
import React from 'react';
import { Typography, Divider } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { commonStyle } from '../constants';

const { Title, Text } = Typography;

export const ContainerScanHeader: React.FC = () => (
  <>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <SafetyOutlined style={{ marginRight: 12, color: commonStyle.primary }} />
      容器镜像安全扫描
    </Title>
    <Text type="secondary">Trivy/Clair 漏洞扫描 · 镜像合规 · 修复建议</Text>
    <Divider />
  </>
);
