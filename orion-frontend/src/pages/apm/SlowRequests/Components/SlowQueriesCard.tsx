/**
 * SlowQueriesCard.tsx - 慢请求排行卡片
 * 抽取自 index.tsx (P2-9 Phase 245)
 */
import { Card, Table } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { queryColumns } from '../Columns';

interface Props {
  slowQueries: unknown[];
}

export function SlowQueriesCard({ slowQueries }: Props) {
  return (
    <Card
      title={(<><BarChartOutlined /> 慢请求排行</>)}
      style={{ marginBottom: spacing.md }}
    >
      <Table
        columns={queryColumns}
        dataSource={slowQueries}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        size="small"
        locale={{ emptyText: slowQueries.length === 0 ? '暂无慢请求数据' : undefined }}
      />
    </Card>
  );
}
