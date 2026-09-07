/**
 * PromptCanary PageHeader
 * 抽取自 index.tsx (P2-9 Phase 183)
 */
import { Typography } from 'antd';
import { BranchesOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <BranchesOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
      Prompt Canary 管理
    </Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
      管理 RAG Prompt 的灰度发布。发布新版本为 Canary 后，按 callerID 稳定散列分流，支持逐步放量。
    </Text>
  </>
);
