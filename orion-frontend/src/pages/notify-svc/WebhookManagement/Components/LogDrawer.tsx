/**
 * WebhookManagement LogDrawer
 * 抽取自 index.tsx (P2-9 Phase 185)
 */
import { Drawer } from 'antd';
import Table, { type TableColumn } from '@/components/Table';
import type { Webhook, WebhookLog } from '@/api/webhook';

interface LogDrawerProps {
  open: boolean;
  selectedWebhook: Webhook | null;
  logs: WebhookLog[];
  columns: TableColumn<WebhookLog>[];
  onClose: () => void;
}

export const LogDrawer = ({ open, selectedWebhook, logs, columns, onClose }: LogDrawerProps) => (
  <Drawer
    title={`Webhook 日志: ${selectedWebhook?.url ?? ''}`}
    open={open}
    onClose={onClose}
    width={720}
  >
    <Table columns={columns} dataSource={logs} rowKey="id" size="small" />
  </Drawer>
);
