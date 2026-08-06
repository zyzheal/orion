import React from 'react';
import { Card, Typography, Tag, Button } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

export interface DomainCardProps {
  title: string;
  icon: React.ReactNode;
  primaryValue: number;
  primaryLabel: string;
  secondaryItems?: { label: string; value: number | string }[];
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  color: string;
  link: string;
  loading?: boolean;
}

/**
 * 六域概览卡片
 * 展示域名称、图标、核心指标、趋势箭头、次要指标、详情页链接
 */
const DomainCard: React.FC<DomainCardProps> = ({
  title,
  icon,
  primaryValue,
  primaryLabel,
  secondaryItems = [],
  trend,
  trendPercent,
  color,
  link,
  loading = false,
}) => {
  if (loading) {
    return <Card size="small" style={{ width: '100%', borderLeft: `3px solid ${color}`, borderRadius: 12 }} loading />;
  }
  const trendIcon = trend === 'up' ? <ArrowUpOutlined /> : trend === 'down' ? <ArrowDownOutlined /> : <MinusOutlined />;
  const trendColor = trend === 'up' ? colors.success[500] : trend === 'down' ? colors.error[500] : colors.neutral[500];

  return (
    <Card
      size="small"
      style={{
        width: '100%',
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <span style={{ color }}>{icon}</span>
          <Text strong>{title}</Text>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.sm }}>
        <span style={{ fontSize: 28, fontWeight: 600, color }}>{primaryValue}</span>
        <Tag color={trendColor} style={{ margin: 0, padding: '2px 8px' }}>
          {trendIcon} {trendPercent > 0 ? `${trendPercent}%` : ''}
        </Tag>
      </div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: spacing.sm }}>
        {primaryLabel}
      </Text>
      {secondaryItems.length > 0 && (
        <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.sm }}>
          {secondaryItems.map((item) => (
            <div key={item.label} style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color }}>{item.value}</Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{item.label}</Text>
            </div>
          ))}
        </div>
      )}
      <Button type="link" href={link} target="_self" style={{ padding: 0, margin: 0 }}>
        <InfoCircleOutlined style={{ marginRight: spacing[2] }} />
        查看详情
      </Button>
    </Card>
  );
};

export default DomainCard;
