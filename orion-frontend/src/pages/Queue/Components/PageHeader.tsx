import { Button, Space, Typography } from 'antd';
import { InboxOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
  onEnqueue: () => void;
  onDequeue: () => void;
}

export function PageHeader({ loading, onRefresh, onEnqueue, onDequeue }: Props) {
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
          <InboxOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          队列管理
        </Title>
        <Text type="secondary">管理异步任务队列，监控任务执行状态</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Button icon={<InboxOutlined />} onClick={onDequeue}>
          出队
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onEnqueue}>
          入队
        </Button>
      </Space>
    </div>
  );
}
