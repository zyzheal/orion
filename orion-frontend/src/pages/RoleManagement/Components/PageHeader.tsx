/**
 * Role Management page header
 * 抽取自 index.tsx (P2-9 Phase 165)
 */
import { Button, Space, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export const PageHeader = ({ loading, onRefresh, onCreate }: PageHeaderProps) => (
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
        <TeamOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        角色管理
      </Title>
      <Text type="secondary">管理系统角色及其权限分配 (RBAC)</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        创建角色
      </Button>
    </Space>
  </div>
);
