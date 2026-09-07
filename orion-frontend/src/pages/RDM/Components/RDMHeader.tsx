/**
 * RDM page header
 */
import React from 'react';
import { Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;

export const RDMHeader: React.FC = () => (
  <Title level={2} style={{ marginBottom: spacing.md }}>
    <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    研发管理 RDM
  </Title>
);
