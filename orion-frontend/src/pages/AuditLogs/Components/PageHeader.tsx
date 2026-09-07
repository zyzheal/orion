/**
 * AuditLogs PageHeader
 * 抽取自 index.tsx (P2-9 Phase 186)
 */
import { Typography, Button, Space, InputNumber } from 'antd';
import { ReloadOutlined, ClearOutlined, AuditOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  retentionDays: number;
  onRetentionChange: (v: number) => void;
  onCleanup: () => void;
  onRefresh: () => void;
}

export const PageHeader = ({
  loading,
  retentionDays,
  onRetentionChange,
  onCleanup,
  onRefresh,
}: PageHeaderProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
    <div style={{ flex: 1 }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <AuditOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        流水线审计日志
      </Title>
      <Text type="secondary">Pipeline 执行审计轨迹，用于故障排查与合规分析</Text>
    </div>
    <Space>
      <InputNumber
        min={1}
        max={3650}
        value={retentionDays}
        onChange={(v) => onRetentionChange(v || 90)}
        style={{ width: 80 }}
      />
      <span style={{ color: colors.neutral[500], fontSize: 13 }}>天</span>
      <Button icon={<ClearOutlined />} onClick={onCleanup}>
        清理过期
      </Button>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
