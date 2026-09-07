/**
 * FlowVersions PageHeader
 * 抽取自 index.tsx (P2-9 Phase 184)
 */
import { Typography } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;

export const PageHeader = () => (
  <Title level={2} style={{ marginBottom: spacing.md }}>
    <HistoryOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    流程版本管理
  </Title>
);
