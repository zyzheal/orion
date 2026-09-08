/**
 * PageHeader.tsx - ErrorTracking 页头
 * 抽取自 index.tsx (P2-9 Phase 223)
 */
import { Button, Select, Space, Typography } from 'antd';
import { FilterOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  errorCount: number;
  services: string[];
  serviceFilter: string | undefined;
  setServiceFilter: (v: string | undefined) => void;
  onRefresh: () => void;
}

export const PageHeader = ({
  loading,
  errorCount,
  services,
  serviceFilter,
  setServiceFilter,
  onRefresh,
}: Props) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <WarningOutlined style={{ marginRight: spacing[3], color: colors.error[500] }} />
        错误追踪
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
        应用错误采集与堆栈分析（共 {errorCount} 个错误）
      </Text>
    </div>
    <Space>
      <Select
        allowClear
        placeholder="按服务筛选"
        style={{ width: 200 }}
        onChange={setServiceFilter}
        value={serviceFilter}
        suffixIcon={<FilterOutlined />}
      >
        {services.map((s) => (
          <Select.Option key={s} value={s}>
            {s}
          </Select.Option>
        ))}
      </Select>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
