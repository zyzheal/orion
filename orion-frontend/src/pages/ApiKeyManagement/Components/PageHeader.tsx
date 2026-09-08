/**
 * ApiKeyManagement PageHeader
 * 抽取自 index.tsx (P2-9 Phase 204)
 */
import { Button, Space, Typography } from 'antd';
import { KeyOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export const PageHeader = ({ loading, onRefresh, onCreate }: Props) => (
  <div style={ { display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg } } >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <KeyOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        API Key 管理
      </Title>
      <Text type="secondary">API Key Management</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        新建 Key
      </Button>
    </Space>
  </div>
);
