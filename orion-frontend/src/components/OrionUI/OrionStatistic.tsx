import React from 'react';
import { Card, Statistic } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { shadows } from '@/tokens/shadows';
import type { OrionStatisticProps } from './types';

const OrionStatistic: React.FC<OrionStatisticProps> = ({
  title,
  value,
  prefix,
  valueStyle,
  trend,
  trendValue,
}) => {
  const trendNode = trend === 'up' || trend === 'down' ? (
    <span
      style={{
        color: trend === 'up' ? colors.success[500] : colors.error[500],
        marginLeft: spacing.sm,
        fontSize: 14,
      }}
    >
      {trend === 'up' ? (
        <ArrowUpOutlined />
      ) : (
        <ArrowDownOutlined />
      )}
      {trendValue && <span style={{ marginLeft: 4 }}>{trendValue}</span>}
    </span>
  ) : null;

  return (
    <Card
      bordered={false}
      style={{
        background: colors.light.bg.primary,
        borderRadius: 12,
        boxShadow: shadows.card,
        padding: spacing.md,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: colors.neutral[500], fontSize: 13 }}>{title}</span>
        {trendNode}
      </div>
      <Statistic
        value={value}
        prefix={prefix}
        valueStyle={{ ...valueStyle, fontSize: 24, fontWeight: 600 }}
      />
    </Card>
  );
};

export default OrionStatistic;
