import { Typography, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, AppstoreOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
  onCreateClick: () => void;
}

export function PageHeader({ loading, onRefresh, onCreateClick }: PageHeaderProps) {
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
          <AppstoreOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          多分支产品线
        </Title>
        <Text type="secondary">管理产品线的分支策略、环境映射、发布列车和紧急修复通道</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreateClick}>
          创建产品线
        </Button>
      </Space>
    </div>
  );
}
