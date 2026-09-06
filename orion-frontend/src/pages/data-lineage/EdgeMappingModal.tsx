/**
 * EdgeMappingModal.tsx - Edge Mapping 详情 Modal
 * 抽取自 DataLineagePage.tsx (P2-9 Phase 61)
 */
import React from 'react';
import { Modal, Descriptions, Tag, Typography } from 'antd';
import type { LineageEdge } from '@/api/data-lineage';

const { Text } = Typography;

export interface EdgeMappingModalProps {
  edgeMapping: LineageEdge | null;
  onClose: () => void;
}

export const EdgeMappingModal: React.FC<EdgeMappingModalProps> = ({
  edgeMapping,
  onClose,
}) => {
  return (
    <Modal
      title="Edge Mapping Detail"
      open={!!edgeMapping}
      onCancel={onClose}
      footer={null}
    >
      {edgeMapping && (
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="ID">{edgeMapping.id}</Descriptions.Item>
          <Descriptions.Item label="From">{edgeMapping.from}</Descriptions.Item>
          <Descriptions.Item label="To">{edgeMapping.to}</Descriptions.Item>
          <Descriptions.Item label="Relationship">
            <Tag>{edgeMapping.relationship.toUpperCase()}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Field Mapping">
            {edgeMapping.fieldMapping && Object.keys(edgeMapping.fieldMapping).length > 0 ? (
              Object.entries(edgeMapping.fieldMapping).map(([k, v]) => (
                <div key={String(k)}>
                  <Text code>{k}</Text> → <Text code>{v}</Text>
                </div>
              ))
            ) : (
              <Text type="secondary">无字段映射</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
};
