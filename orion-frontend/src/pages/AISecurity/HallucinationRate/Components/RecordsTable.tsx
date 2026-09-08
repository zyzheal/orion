import { Card, Empty, Table } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { HallucinationRecord } from '../types';

interface Props {
  records: HallucinationRecord[] | undefined;
  columns: ColumnsType<HallucinationRecord>;
  loading: boolean;
}

export function RecordsTable({ records, columns, loading }: Props) {
  return (
    <Card title="幻觉检测明细" extra={<LineChartOutlined />}>
      <Table
        dataSource={records}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 8 }}
        loading={loading}
        locale={{ emptyText: <Empty description="暂无幻觉检测记录" /> }}
      />
    </Card>
  );
}
