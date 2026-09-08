/**
 * AuthConfig PoliciesCard
 * 抽取自 index.tsx (P2-9 Phase 203)
 */
import { Card, Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AuthPolicy } from '../types';

interface Props {
  policies: AuthPolicy[];
  columns: ColumnsType<AuthPolicy>;
  loading: boolean;
}

export const PoliciesCard = ({ policies, columns, loading }: Props) => (
  <Card title="访问策略规则">
    <Table
      dataSource={policies}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="small"
      pagination={false}
      locale={{ emptyText: <Empty description="暂无访问策略规则" /> }}
    />
  </Card>
);
