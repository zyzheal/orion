/**
 * PageHeader.tsx - AI Dashboard 页头
 * 抽取自 index.tsx (P2-9 Phase 224)
 */
import { Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <RobotOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
      AI 能力平台
    </Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: spacing.lg }}>
      AI 驱动的研发效能提升，让工具链更智能
    </Text>
  </>
);
