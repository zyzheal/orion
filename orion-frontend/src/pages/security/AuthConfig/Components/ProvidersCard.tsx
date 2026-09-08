/**
 * AuthConfig ProvidersCard
 * 抽取自 index.tsx (P2-9 Phase 203)
 */
import { Button, Card, Empty, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { AuthProvider } from '../types';

interface Props {
  providers: AuthProvider[];
  columns: ColumnsType<AuthProvider>;
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export const ProvidersCard = ({ providers, columns, loading, onRefresh, onCreate }: Props) => (
  <Card
    title="认证源列表"
    extra={
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>刷新</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新建认证源
        </Button>
      </Space>
    }
    style={{ marginBottom: spacing.md }}
  >
    <Table
      dataSource={providers}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="small"
      pagination={false}
      locale={{ emptyText: <Empty description="暂无认证源配置，请添加 OAuth2/OIDC/MFA/SSO 认证源" /> }}
    />
  </Card>
);
