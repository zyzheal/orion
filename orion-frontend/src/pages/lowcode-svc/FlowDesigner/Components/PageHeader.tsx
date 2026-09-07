/**
 * FlowDesigner PageHeader
 * 抽取自 index.tsx (P2-9 Phase 190)
 */
import { Typography } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';

const { Title } = Typography;

export const PageHeader = () => (
  <Title level={2} style={{ marginBottom: spacing.md }}>
    <PlayCircleOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
    流程设计器
  </Title>
);
