/**
 * ApiKeyManagement KeysTable
 * 抽取自 index.tsx (P2-9 Phase 204)
 */
import { Card } from 'antd';
import Table from '@/components/Table';
import type { TableColumn } from '@/components/Table';
import type { ApiKey } from '@/api/api-key';

interface Props {
  keys: ApiKey[];
  columns: TableColumn<ApiKey>[];
  loading: boolean;
}

export const KeysTable = ({ keys, columns, loading }: Props) => (
  <Card>
    <Table
      columns={columns}
      dataSource={keys}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
    />
  </Card>
);
