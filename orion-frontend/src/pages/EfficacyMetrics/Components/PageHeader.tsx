/**
 * PageHeader - 效能度量中心页头
 * 抽取自 index.tsx (P2-9 Phase 212)
 */
import { Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <BarChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        效能度量中心
      </Title>
      <Text type="secondary">六域研效指标聚合 · 整体评分 · 趋势分析</Text>
    </div>
  </div>
);
