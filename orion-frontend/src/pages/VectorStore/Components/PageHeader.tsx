import { Button, Space, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined, DatabaseOutlined } from '@ant-design/icons';
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
          <DatabaseOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          <DatabaseOutlined style={{ marginRight: spacing.sm }} />
          向量存储管理
        </Title>
        <Text type="secondary">管理向量集合、文档上传和语义相似度检索</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          创建集合
        </Button>
      </Space>
    </div>
  );
}
