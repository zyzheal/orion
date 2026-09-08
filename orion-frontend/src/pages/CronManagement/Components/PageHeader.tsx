/**
 * CronManagement PageHeader
 * 抽取自 index.tsx (P2-9 Phase 193)
 */
import { Button, Space, Typography } from 'antd';
import { ReloadOutlined, PlusOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export const PageHeader = ({ loading, onRefresh, onCreate }: PageHeaderProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ClockCircleOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        定时任务管理
      </Title>
      <Text type="secondary">Cron Job Management</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        新建任务
      </Button>
    </Space>
  </div>
);
