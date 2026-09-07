/**
 * FormInstancePipeline DetailModal
 * 抽取自 index.tsx (P2-9 Phase 176)
 */
import React from 'react';
import { Modal, Button, Descriptions, Tag } from 'antd';
import { themeVars } from '@/tokens';
import type { FormInstance } from '@/api/lowcode';
import { STATUS_CONFIG } from '../constants';

interface DetailModalProps {
  open: boolean;
  instance: FormInstance | null;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ open, instance, onClose }) => (
  <Modal
    title="实例详情"
    open={open}
    onCancel={onClose}
    footer={<Button onClick={onClose}>关闭</Button>}
    width={600}
  >
    {instance && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="实例 ID">{instance.id}</Descriptions.Item>
        <Descriptions.Item label="表单 ID">{instance.formId}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={STATUS_CONFIG[instance.status]?.color}>
            {STATUS_CONFIG[instance.status]?.label || instance.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="提交者">{instance.submittedBy}</Descriptions.Item>
        <Descriptions.Item label="审批人">{instance.approvedBy || '-'}</Descriptions.Item>
        <Descriptions.Item label="提交时间">
          {instance.submittedAt ? new Date(instance.submittedAt).toLocaleString() : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="审批时间">
          {instance.approvedAt ? new Date(instance.approvedAt).toLocaleString() : '-'}
        </Descriptions.Item>
        {instance.data && (
          <Descriptions.Item label="数据">
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                maxHeight: 200,
                overflow: 'auto',
                background: themeVars.bgSecondary,
                padding: 8,
                borderRadius: 4,
              }}
            >
              {JSON.stringify(instance.data, null, 2)}
            </pre>
          </Descriptions.Item>
        )}
      </Descriptions>
    )}
  </Modal>
);
