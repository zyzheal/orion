/**
 * WebhookManagement PageHeader
 * 抽取自 index.tsx (P2-9 Phase 185)
 */
import { Typography, Button, Space } from 'antd';
import { ReloadOutlined, PlusOutlined, LinkOutlined } from '@ant-design/icons';
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
        <LinkOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        Webhook 管理
      </Title>
      <Text type="secondary">平台 Webhook 配置与监控</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        新建 Webhook
      </Button>
    </Space>
  </div>
);
