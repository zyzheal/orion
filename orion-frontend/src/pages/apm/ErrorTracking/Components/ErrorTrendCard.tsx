/**
 * ErrorTrendCard.tsx - 错误时间分布图
 * 抽取自 index.tsx (P2-9 Phase 223)
 */
import { Card, Typography } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface Props {
  trend: [string, number][];
}

export const ErrorTrendCard = ({ trend }: Props) => (
  <Card title="错误时间分布" style={{ marginBottom: spacing.md }}>
    {trend.length > 0 ? (
      <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'end', height: 80 }}>
        {trend.map(([hour, count]) => (
          <div
            key={hour}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: 40,
            }}
          >
            <span style={{ fontSize: 10, color: colors.neutral[500] }}>{count}</span>
            <div
              style={{
                width: 30,
                height: count * 15,
                backgroundColor: count > 5 ? colors.error[500] : colors.warning[500],
                borderRadius: 4,
              }}
            />
            <span style={{ fontSize: 10, color: colors.neutral[500] }}>{hour}</span>
          </div>
        ))}
      </div>
    ) : (
      <Text type="secondary">暂无错误数据</Text>
    )}
  </Card>
);
