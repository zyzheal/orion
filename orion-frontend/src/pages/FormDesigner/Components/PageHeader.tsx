/**
 * FormDesigner page header
 * 抽取自 index.tsx (P2-9 Phase 161)
 */
import { Typography } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;

export const PageHeader = () => (
  <Title level={2} style={{ marginBottom: spacing.md }}>
    <CodeOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    表单引擎与条件引擎
  </Title>
);
