import { Card, Table } from 'antd';
import type { ServiceInfo } from '@/api/apm';
import { serviceColumns } from '../Columns';

interface Props {
  services: ServiceInfo[];
}

export function ServicesCard({ services }: Props) {
  return (
    <Card title="服务列表">
      <Table
        columns={serviceColumns}
        dataSource={services}
        rowKey="service_name"
        pagination={false}
        size="small"
        locale={{ emptyText: services.length === 0 ? '暂无服务数据' : undefined }}
      />
    </Card>
  );
}
