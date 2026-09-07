/**
 * ContainerScan Vuln Distribution Card
 * 抽取自 index.tsx (P2-9 Phase 133)
 */
import React from 'react';
import { Card, Typography, Space, Progress } from 'antd';
import {
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import type { VulnDistribution } from '../types';

const { Text } = Typography;

interface VulnDistributionCardProps {
  vulnDist: VulnDistribution[];
}

const getIcon = (severity: string, color: string) => {
  if (severity === 'Critical')
    return <ExclamationCircleOutlined style={{ color }} />;
  if (severity === 'High') return <WarningOutlined style={{ color }} />;
  if (severity === 'Medium') return <InfoCircleOutlined style={{ color }} />;
  return <CheckCircleOutlined style={{ color }} />;
};

export const VulnDistributionCard: React.FC<VulnDistributionCardProps> = ({ vulnDist }) => (
  <Card
    title={
      <Space>
        <WarningOutlined />
        <span>漏洞分布</span>
      </Space>
    }
    style={{
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {vulnDist.map((v) => (
        <div
          key={v.severity}
          style={{
            padding: spacing.sm,
            borderRadius: 8,
            backgroundColor: themeVars.bgSecondary,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Space size={8}>
              {getIcon(v.severity, v.color)}
              <Text strong>{v.severity}</Text>
            </Space>
            <Text strong style={{ color: v.color }}>
              {v.count} ({v.percentage}%)
            </Text>
          </div>
          <Progress
            percent={v.percentage}
            strokeColor={v.color}
            trailColor={colors.neutral[100]}
            showInfo={false}
            style={{ marginTop: 4 }}
          />
        </div>
      ))}
    </div>
  </Card>
);
