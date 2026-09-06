/**
 * PolicyDetailModal.tsx - 策略详情弹窗
 * 抽取自 AlertClosurePage/index.tsx (P2-9 Phase 88)
 */
import React from 'react';
import { Modal, Descriptions, Button, Tag } from 'antd';
import { themeVars } from '@/tokens';
import type { EscalationPolicy } from '@/api/alertEscalation';
import { SEVERITY_MAP } from '../constants';

interface PolicyDetailModalProps {
  open: boolean;
  selectedItem: EscalationPolicy | null;
  onClose: () => void;
}

export const PolicyDetailModal: React.FC<PolicyDetailModalProps> = ({ open, selectedItem, onClose }) => (
  <Modal
    title="策略详情"
    open={open}
    onCancel={onClose}
    footer={<Button onClick={onClose}>关闭</Button>}
    width={600}
  >
    {selectedItem && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="策略名称">{selectedItem.name}</Descriptions.Item>
        <Descriptions.Item label="严重度">
          <Tag color={SEVERITY_MAP[selectedItem.severity]?.color}>
            {SEVERITY_MAP[selectedItem.severity]?.label || selectedItem.severity}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建者">{selectedItem.createdBy}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : '-'}
        </Descriptions.Item>
        {selectedItem.description && (
          <Descriptions.Item label="描述">{selectedItem.description}</Descriptions.Item>
        )}
        {selectedItem.rules && (
          <Descriptions.Item label="升级规则">
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
              {JSON.stringify(selectedItem.rules, null, 2)}
            </pre>
          </Descriptions.Item>
        )}
      </Descriptions>
    )}
  </Modal>
);
