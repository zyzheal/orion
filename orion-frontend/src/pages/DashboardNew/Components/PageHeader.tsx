import { Card, Typography, Button } from 'antd';
import { DashboardOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export function PageHeader({ loading, onRefresh }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <DashboardOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          工作台
        </Title>
        <Text type="secondary">个人工作与效能度量</Text>
      </div>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </div>
  );
}
