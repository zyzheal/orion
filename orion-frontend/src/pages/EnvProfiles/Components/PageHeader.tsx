/**
 * EnvProfiles PageHeader
 * 抽取自 index.tsx (P2-9 Phase 178)
 */
import { Typography, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  onCreate: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export const PageHeader = ({ onCreate, onRefresh, loading }: PageHeaderProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
    <div style={{ flex: 1 }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <SettingOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        环境配置管理
      </Title>
      <Text type="secondary">按环境管理变量配置，支持变量解析与覆盖</Text>
    </div>
    <Space>
      <Button icon={<PlusOutlined />} type="primary" onClick={onCreate}>
        创建配置
      </Button>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
