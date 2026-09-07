/**
 * SBOM vulnerability detail modal
 * 抽取自 index.tsx (P2-9 Phase 162)
 */
import { Modal, Table } from 'antd';
import type { SbomVulnDetail } from '../types';
import type { TableColumn } from '@/components/Table';

interface VulnDetailModalProps {
  open: boolean;
  vulnDetails: SbomVulnDetail[];
  columns: TableColumn<SbomVulnDetail>[];
  onCancel: () => void;
}

export const VulnDetailModal = ({ open, vulnDetails, columns, onCancel }: VulnDetailModalProps) => (
  <Modal title="漏洞详情" open={open} onCancel={onCancel} footer={null} width={900}>
    <Table columns={columns} dataSource={vulnDetails} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
  </Modal>
);
