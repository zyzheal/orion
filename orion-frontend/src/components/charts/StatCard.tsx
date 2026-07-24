import React, { useMemo } from 'react';
import { Card, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useChartTheme } from './ChartProvider';

const { Text } = Typography;

export interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
    good: 'up' | 'down';
  };
  sparklineData?: number[];
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  suffix,
  icon,
  trend,
  sparklineData,
  color,
}) => {
  const theme = useChartTheme();

  const sparklineOption = useMemo(() => {
    if (!sparklineData) return null;
    return {
      grid: { top: 2, right: 2, bottom: 2, left: 2 },
      xAxis: { show: false, type: 'category' as const, data: sparklineData.map((_, i) => i) },
      yAxis: { show: false, type: 'value' as const },
      series: [
        {
          type: 'line' as const,
          data: sparklineData,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1.5, color: color ?? theme.palette[0] },
          areaStyle: { opacity: 0.1, color: color ?? theme.palette[0] },
        },
      ],
    };
  }, [sparklineData, color, theme]);

  const trendColor = trend
    ? trend.direction === trend.good
      ? theme.success
      : theme.error
    : undefined;

  return (
    <Card size="small" style={{ height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
            {title}
          </Text>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <Text
              strong
              style={{ fontSize: 24, color: color ?? theme.textColor }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Text>
            {suffix && (
              <Text type="secondary" style={{ fontSize: 14 }}>
                {suffix}
              </Text>
            )}
          </div>
          {trend && (
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              {trend.direction === 'up' ? (
                <ArrowUpOutlined style={{ color: trendColor, fontSize: 12 }} />
              ) : trend.direction === 'down' ? (
                <ArrowDownOutlined style={{ color: trendColor, fontSize: 12 }} />
              ) : null}
              <Text style={{ fontSize: 12, color: trendColor }}>
                {trend.direction === 'down' ? '-' : trend.direction === 'up' ? '+' : ''}
                {trend.value}%
              </Text>
            </div>
          )}
        </div>
        {sparklineData && sparklineOption && (
          <div style={{ width: 80, height: 40 }} data-testid="stat-card-sparkline">
            <ReactECharts option={sparklineOption} style={{ width: 80, height: 40 }} />
          </div>
        )}
      </div>
    </Card>
  );
};
