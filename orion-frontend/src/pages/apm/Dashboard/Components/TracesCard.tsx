import { Card, Table } from 'antd';
import type { TraceSummary } from '@/api/apm';
import { spacing } from '@/tokens';
import { traceColumns } from '../Columns';

interface Props {
  traces: TraceSummary[];
}

export function TracesCard({ traces }: Props) {
  return (
    <Card title="最近链路" style={{ marginBottom: spacing.md }}>
      <Table
        columns={traceColumns}
        dataSource={traces}
        rowKey="traceId"
        pagination={{ pageSize: 10 }}
        size="small"
        locale={{ emptyText: traces.length === 0 ? '暂无链路数据' : undefined }}
      />
    </Card>
  );
}
