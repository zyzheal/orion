/**
 * AuthConfig PageHeader
 * 抽取自 index.tsx (P2-9 Phase 203)
 */
import { Typography } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <SafetyOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
      认证授权管理
    </Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
      OAuth2 / OIDC / MFA / SSO 认证源配置与访问策略管理
    </Text>
  </>
);
