/**
 * service-portal ServiceTable
 * 抽取自 index.tsx (P2-9 Phase 182)
 */
import { Card, Table, Button, Space, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ServiceInfo } from '@/api/service-registry';

interface ServiceTableProps {
  columns: ColumnsType<ServiceInfo>;
  dataSource: ServiceInfo[];
  loading: boolean;
  onRegister: () => void;
  onRefresh: () => void;
}

export const ServiceTable = ({
  columns,
  dataSource,
  loading,
  onRegister,
  onRefresh,
}: ServiceTableProps) => (
  <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
    <Space style={{ marginBottom: 16 }}>
      <Button type="primary" icon={<PlusOutlined />} onClick={onRegister}>
        注册服务
      </Button>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
    <Table<ServiceInfo>
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      loading={loading}
      pagination={
        {
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (t: number) => `共 ${t} 项`,
        } as any
      }
      locale={{ emptyText: <Empty description="暂无注册服务" /> }}
      scroll={{ x: 1000 }}
    />
  </Card>
);
