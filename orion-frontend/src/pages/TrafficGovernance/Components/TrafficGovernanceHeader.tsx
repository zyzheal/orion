/**
 * Traffic Governance page header
 * 抽取自 index.tsx (P2-9 Phase 157)
 */
import { Typography } from 'antd';
import { GatewayOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const TrafficGovernanceHeader = () => (
  <>
    <Title
      level={2}
      style={{
        marginBottom: 8,
        fontWeight: 600,
        color: colors.neutral[900],
      }}
    >
      <GatewayOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      流量治理
    </Title>
    <Text
      type="secondary"
      style={{
        marginBottom: spacing.md,
        display: 'block',
        fontSize: 14,
        color: colors.neutral[500],
      }}
    >
      管理灰度发布和流量切分规则，支持全量发布和快速回滚
    </Text>
  </>
);
