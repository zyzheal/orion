/**
 * KnowledgeBase Table
 * 抽取自 index.tsx (P2-9 Phase 169)
 */
import { Card } from 'antd';
import Table from '@/components/Table';
import type { TableColumn } from '@/components/Table';
import type { KnowledgeItem } from '../types';

interface KnowledgeTableProps {
  columns: TableColumn<KnowledgeItem>[];
  dataSource: KnowledgeItem[];
  loading: boolean;
}

export const KnowledgeTable = ({ columns, dataSource, loading }: KnowledgeTableProps) => (
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
);
