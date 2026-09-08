import { Empty } from 'antd';
import { RadarChartOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';

export function EmptyState() {
  return (
    <div style={{ padding: spacing.xl }}>
      <h2
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: spacing.sm,
          fontSize: 20,
          fontWeight: 600,
          color: colors.neutral[900],
        }}
      >
        <RadarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        运行监控
      </h2>
      <CardPanel>
        <Empty
          description={
            <div>
              <span style={{ color: colors.neutral[500] }}>暂无 Pipeline 运行记录</span>
              <div style={{ marginTop: spacing.sm, fontSize: 13, color: colors.neutral[400] }}>
                创建并运行 Pipeline 后，此处将显示运行监控数据
              </div>
            </div>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </CardPanel>
    </div>
  );
}
