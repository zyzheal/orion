import { Typography, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export function PageHeader({ loading, onRefresh, onCreate }: Props) {
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
          制品管理
        </Title>
        <Text type="secondary">管理制品仓库、生命周期晋升、标签和安全扫描</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          创建制品
        </Button>
      </Space>
    </div>
  );
}
