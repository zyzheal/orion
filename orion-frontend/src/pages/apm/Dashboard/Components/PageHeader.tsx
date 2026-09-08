import { Typography, Button } from 'antd';
import { DashboardOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
}

export function PageHeader({ loading, onRefresh }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <DashboardOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          APM 性能仪表盘
        </Title>
        <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
          应用性能监控与分布式链路追踪
        </Text>
      </div>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </div>
  );
}
