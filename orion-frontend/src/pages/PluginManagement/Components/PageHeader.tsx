import { Typography, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, AppstoreOutlined } from '@ant-design/icons';
import { spacing, colors } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  pluginCount: number;
  loading: boolean;
  onRefresh: () => void;
  onInstall: () => void;
}

export function PageHeader({ pluginCount, loading, onRefresh, onInstall }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing[5],
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <AppstoreOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          插件管理
        </Title>
        <Text type="secondary">共 {pluginCount} 个插件</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onInstall}
          data-testid="install-plugin-button"
        >
          安装插件
        </Button>
      </Space>
    </div>
  );
}
