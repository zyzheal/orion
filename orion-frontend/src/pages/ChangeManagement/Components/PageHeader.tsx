/**
 * Change Management page header
 * 抽取自 index.tsx (P2-9 Phase 160)
 */
import { Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <div style={{ marginBottom: spacing.lg }}>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
      变更管理
    </Title>
    <Text type="secondary">管理变更请求、RFC 审批、CAB 会议与变更生命周期</Text>
  </div>
);
