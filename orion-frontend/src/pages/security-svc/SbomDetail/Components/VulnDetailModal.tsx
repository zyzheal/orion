/**
 * SBOM Vulnerability detail modal
 */
import React from 'react';
import { Modal, Table as AntTable } from 'antd';
import type { TableColumn } from '@/components/Table';
import type { SbomVulnDetail } from '../types';

interface VulnDetailModalProps {
  open: boolean;
  details: SbomVulnDetail[];
  columns: TableColumn<SbomVulnDetail>[];
  onClose: () => void;
}

export const VulnDetailModal: React.FC<VulnDetailModalProps> = ({
  open,
  details,
  columns,
  onClose,
}) => (
  <Modal title="漏洞详情" open={open} onCancel={onClose} footer={null} width={900}>
    <AntTable
      columns={columns}
      dataSource={details}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 10 }}
    />
  </Modal>
);
