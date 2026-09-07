/**
 * WebhookManagement LogDrawer
 * 抽取自 index.tsx (P2-9 Phase 172)
 */
import { Drawer } from 'antd';
import Table, { type TableColumn } from '@/components/Table';
import type { WebhookLog } from '@/api/webhook';

interface LogDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  logColumns: TableColumn<WebhookLog>[];
  logs: WebhookLog[];
}

export const LogDrawer = ({ open, title, onClose, logColumns, logs }: LogDrawerProps) => (
  <Drawer title={`Webhook 日志: ${title}`} open={open} onClose={onClose} width={720}>
    <Table columns={logColumns} dataSource={logs} rowKey="id" size="small" />
  </Drawer>
);
