/**
 * EventBus Monitoring page header
 * 抽取自 index.tsx (P2-9 Phase 164)
 */
import { Button, Space, Typography } from 'antd';
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export const PageHeader = ({ loading, onRefresh }: PageHeaderProps) => (
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
        <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        EventBus
      </Title>
      <Text type="secondary">事件总线监控</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
