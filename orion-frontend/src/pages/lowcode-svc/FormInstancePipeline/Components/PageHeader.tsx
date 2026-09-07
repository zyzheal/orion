/**
 * FormInstancePipeline PageHeader
 * 抽取自 index.tsx (P2-9 Phase 176)
 */
import { Typography } from 'antd';
import { FileOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <div>
    <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
      <FileOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      表单实例流水线
    </Title>
    <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
      表单提交 → 审批 → 完成 全流程追踪
    </Text>
  </div>
);
