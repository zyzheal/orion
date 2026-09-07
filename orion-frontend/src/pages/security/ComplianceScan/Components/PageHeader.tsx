/**
 * ComplianceScan PageHeader
 * 抽取自 index.tsx (P2-9 Phase 188)
 */
import { Typography } from 'antd';
import { FileProtectOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export const PageHeader = () => (
  <div>
    <Title level={2} style={{ marginBottom: spacing.sm }}>
      <FileProtectOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
      安全合规检查
    </Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
      安全基线扫描 · 合规框架检测 · 违规发现与修复跟踪
    </Text>
  </div>
);
