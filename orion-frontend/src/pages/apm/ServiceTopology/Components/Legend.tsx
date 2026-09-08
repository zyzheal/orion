/**
 * Legend - APM Service Topology 图例
 * 抽取自 index.tsx (P2-9 Phase 218)
 */
import { Card, Space, Tag, Typography } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Text } = Typography;

export const Legend = () => (
  <Card size="small" style={{ marginTop: spacing.md }}>
    <Space>
      <Text type="secondary">图例：</Text>
      <Tag color={colors.primary[500]}>正常服务</Tag>
      <Tag color={colors.error[500]}>高错误率 (&gt;5%)</Tag>
      <Tag color={colors.neutral[400]}>调用关系</Tag>
      <Tag color={colors.error[500]}>高错误调用</Tag>
    </Space>
  </Card>
);
