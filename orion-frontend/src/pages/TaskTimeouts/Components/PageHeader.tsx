/**
 * TaskTimeouts PageHeader
 * 抽取自 index.tsx (P2-9 Phase 200)
 */
import { Typography } from 'antd';
import { FieldTimeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <div style={{ marginBottom: spacing.lg }}>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <FieldTimeOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
      任务超时管理
    </Title>
    <Text type="secondary">监控工作流任务超时情况，自动处理超时任务</Text>
  </div>
);
