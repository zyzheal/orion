import { Empty } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import { TrendChart } from '../TrendChart';

interface Props {
  dailyStats: any[];
  formatDuration: (ms: number) => string;
}

export function TrendChartCard({ dailyStats, formatDuration }: Props) {
  return (
    <div style={{ marginBottom: spacing.md }}>
      <CardPanel
        title={
          <span>
            <LineChartOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
            运行趋势
          </span>
        }
        bodyStyle={{ padding: spacing.lg }}
      >
        {dailyStats.length > 0 ? (
          <TrendChart dailyStats={dailyStats} formatDuration={formatDuration} />
        ) : (
          <Empty description="暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </CardPanel>
    </div>
  );
}
