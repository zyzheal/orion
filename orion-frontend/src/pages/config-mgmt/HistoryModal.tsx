/**
 * HistoryModal - 配置项变更历史 Modal
 */
import React from 'react';
import { Modal, Button, Table } from 'antd';

export interface HistoryModalProps {
  open: boolean;
  historyData: any[];
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ open, historyData, onClose }) => (
  <Modal
    title="变更历史"
    open={open}
    onCancel={onClose}
    footer={<Button onClick={onClose}>关闭</Button>}
    width={700}
  >
    <Table
      dataSource={historyData}
      rowKey="id"
      size="small"
      columns={[
        { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
        { title: '新值', dataIndex: 'newValue', key: 'newValue', ellipsis: true },
        { title: '操作者', dataIndex: 'operator', key: 'operator', width: 100 },
        { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
        {
          title: '时间',
          dataIndex: 'createdAt',
          key: 'createdAt',
          width: 160,
          render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
        },
      ]}
    />
  </Modal>
);
