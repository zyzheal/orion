import { Card, Table } from 'antd';
import type { SpaceDetailRow } from '../types';

interface Props {
  rows: SpaceDetailRow[];
  columns: any;
  loading: boolean;
}

export function DetailTable({ rows, columns, loading }: Props) {
  return (
    <Card title="指标明细">
      <Table dataSource={rows} columns={columns} rowKey="key"
        size="middle" pagination={false} loading={loading} />
    </Card>
  );
}
