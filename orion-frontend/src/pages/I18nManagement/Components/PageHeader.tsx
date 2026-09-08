/**
 * I18nManagement PageHeader
 * 抽取自 index.tsx (P2-9 Phase 197)
 */
import { Typography } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;

export const PageHeader = () => (
  <Title level={2} style={{ marginBottom: spacing.md }} >
    <GlobalOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    国际化管理
  </Title>
);
