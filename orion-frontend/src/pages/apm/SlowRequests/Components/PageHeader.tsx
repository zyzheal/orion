/**
 * PageHeader.tsx - APM 慢请求 页面标题栏
 * 抽取自 index.tsx (P2-9 Phase 245)
 */
import { Typography, Button, Space, InputNumber } from 'antd';
import { ScheduleOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  threshold: number;
  loading: boolean;
  onThresholdChange: (v: number | null) => void;
  onRefresh: () => void;
}

export function PageHeader({ threshold, loading, onThresholdChange, onRefresh }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ScheduleOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          慢请求分析
        </Title>
        <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
          追踪慢请求与 SQL 查询模式分析
        </Text>
      </div>
      <Space>
        <InputNumber
          addonBefore="阈值 (ms)"
          value={threshold}
          onChange={onThresholdChange}
          min={100}
          style={{ width: 160 }}
        />
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
      </Space>
    </div>
  );
}
