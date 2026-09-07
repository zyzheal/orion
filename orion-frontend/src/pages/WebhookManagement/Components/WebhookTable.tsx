/**
 * WebhookManagement WebhookTable
 * 抽取自 index.tsx (P2-9 Phase 172)
 */
import { Card } from 'antd';
import Table, { type TableColumn } from '@/components/Table';
import DataState from '@/components/DataState';
import type { Webhook } from '@/api/webhook';

interface WebhookTableProps {
  columns: TableColumn<Webhook>[];
  dataSource: Webhook[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export const WebhookTable = ({
  columns,
  dataSource,
  loading,
  error,
  onRetry,
}: WebhookTableProps) => (
  <DataState
    loading={loading && dataSource.length === 0}
    error={error}
    empty={dataSource.length === 0 && !loading}
    emptyText="暂无 Webhook"
    loadingText="加载 Webhook..."
    retry={onRetry}
  >
    <Card>
      <Table
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </Card>
  </DataState>
);
