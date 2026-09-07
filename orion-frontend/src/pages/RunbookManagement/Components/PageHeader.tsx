/**
 * Runbook Management page header
 * 抽取自 index.tsx (P2-9 Phase 163)
 */
import { Typography } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;

export const PageHeader = () => (
  <Title level={2} style={{ marginBottom: spacing.md }}>
    <BookOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    Runbook 管理
  </Title>
);
