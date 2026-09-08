/**
 * ComponentRegistry PageHeader
 * 抽取自 index.tsx (P2-9 Phase 194)
 */
import { Typography } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <div style={{ marginBottom: spacing.md }}>
    <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
      <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      组件注册中心
    </Title>
    <Text type="secondary" style={{ display: 'block' }}>
      低代码平台自定义组件管理 · Props Schema · 默认配置
    </Text>
  </div>
);
