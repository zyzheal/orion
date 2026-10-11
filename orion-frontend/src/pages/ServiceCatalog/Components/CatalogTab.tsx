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
    role="region"
    aria-label="服务目录列表"
    aria-busy={loading}
    extra={
      <Space>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={onRefresh}
          loading={loading}
          aria-label="刷新服务目录"
          tabIndex={0}
        >
          刷新
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={onCreate}
          aria-label="新建服务"
          tabIndex={0}
        >
          新建服务
        </Button>
      </Space>
    }
  >
    {items.length === 0 ? (
      <div role="status" aria-live="polite" aria-atomic="true">
        <Empty description="暂无服务，请注册第一个服务" />
      </div>
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
