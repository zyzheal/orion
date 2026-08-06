import React, { useMemo } from 'react';
import { Card, Typography } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

export interface TrendDataPoint {
  week: string;
  [key: string]: number | string;
}

export interface TrendChartProps {
  data: TrendDataPoint[];
  series: { name: string; dataKey: string; color: string }[];
  loading?: boolean;
  height?: number;
}

/**
 * 跨域趋势折线图
 * 展示最近 8 周各域评分变化趋势
 */
const TrendChart: React.FC<TrendChartProps> = ({ data, series, loading = false, height = 300 }) => {
  const defaultColor = useMemo(() => {
    const palette = ['#3370E6', '#52c41a', '#722ed1', '#fa8c16', '#13c2c2', '#f5222d'];
    return palette;
  }, []);

  if (loading) {
    return <Card style={{ height }}><div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Text type="secondary">加载中...</Text></div></Card>;
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Text strong>跨域趋势（最近 8 周）</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>各域评分折线图</Text>
        </div>
      }
      style={{ width: '100%' }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="week" stroke={colors.neutral[500]} fontSize={12} />
          <YAxis domain={[0, 100]} stroke={colors.neutral[500]} fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8,
            }}
            formatter={(value) => [`${value}`, '评分']}
          />
          <Legend />
          {series.map((s, idx) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              stroke={s.color || defaultColor[idx % defaultColor.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={s.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default TrendChart;
