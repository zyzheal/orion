import { Button, Card, Empty, Table } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { Contract } from '../types';
import type { ColumnsType } from 'antd/es/table';

interface Props {
  contracts: Contract[];
  columns: ColumnsType<Contract>;
  load: () => void;
}

export function ContractsTable({ contracts, columns, load }: Props) {
  return (
    <Card title="API 契约列表" extra={<Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>}>
      <Table
        dataSource={contracts}
        columns={columns}
        rowKey="endpoint"
        size="small"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无契约" /> }}
      />
    </Card>
  );
}
