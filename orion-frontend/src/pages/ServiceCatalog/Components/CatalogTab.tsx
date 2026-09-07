/**
 * ServiceCatalog CatalogTab
 * 抽取自 index.tsx (P2-9 Phase 189)
 */
import { Button, Card, Empty, Space, Table } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ServiceCatalog } from '@/api/service-catalog';

interface CatalogTabProps {
  columns: ReturnType<typeof import('../columns').buildServiceColumns>;
  items: ServiceCatalog[];
  loading: boolean;
  onCreate: () => void;
  onRefresh: () => void;
}

export const CatalogTab = ({ columns, items, loading, onCreate, onRefresh }: CatalogTabProps) => (
  <Card
    title="服务目录"
    extra={
      <Space>
        <Button icon={<ReloadOutlined />} size="small" onClick={onRefresh} loading={loading}>
          刷新
        </Button>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onCreate}>
          新建服务
        </Button>
      </Space>
    }
  >
    {items.length === 0 ? (
      <Empty description="暂无服务，请注册第一个服务" />
    ) : (
      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 10, showTotal: (t: number) => `共 ${t} 条` }}
      />
    )}
  </Card>
);
