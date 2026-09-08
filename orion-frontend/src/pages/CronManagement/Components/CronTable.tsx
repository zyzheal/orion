/**
 * CronManagement Table
 * 抽取自 index.tsx (P2-9 Phase 193)
 */
import { Card } from 'antd';
import Table, { type TableColumn } from '@/components/Table';
import type { CronJob } from '@/api/cron';

interface CronTableProps {
  columns: TableColumn<CronJob>[];
  jobs: CronJob[];
  loading: boolean;
}

export const CronTable = ({ columns, jobs, loading }: CronTableProps) => (
  <Card>
    <Table
      columns={columns}
      dataSource={jobs}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
    />
  </Card>
);
