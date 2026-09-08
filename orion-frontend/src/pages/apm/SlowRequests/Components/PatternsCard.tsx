/**
 * PatternsCard.tsx - SQL 查询模式统计卡片
 * 抽取自 index.tsx (P2-9 Phase 245)
 */
import { Card, Table } from 'antd';
import { patternColumns } from '../Columns';

interface Props {
  patterns: unknown[];
}

export function PatternsCard({ patterns }: Props) {
  return (
    <Card title="SQL 查询模式统计">
      <Table
        columns={patternColumns}
        dataSource={patterns}
        rowKey="query_hash"
        pagination={{ pageSize: 10 }}
        size="small"
        locale={{ emptyText: patterns.length === 0 ? '暂无查询模式数据' : undefined }}
      />
    </Card>
  );
}
