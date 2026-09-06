/**
 * PromotionModal.tsx - 制品晋升 Modal
 * 抽取自 Artifacts/index.tsx (P2-9 Phase 75)
 */
import React from 'react';
import { Modal, Form, Input, Typography, Tag } from 'antd';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';
import type { Artifact } from '@/api/artifacts';
import { promotionStageOrder } from './constants';

const { Text } = Typography;

interface PromotionModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  selectedArtifact: Artifact | null;
  onCancel: () => void;
  onOk: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
  visible,
  form,
  submitting,
  selectedArtifact,
  onCancel,
  onOk,
}) => {
  return (
    <Modal
      title="制品晋升"
      open={visible}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      width={480}
    >
      {selectedArtifact && (
        <div style={{ marginBottom: spacing.md }}>
          <Text>
            当前制品: <Text strong>{selectedArtifact.name}</Text> ({selectedArtifact.version})
          </Text>
          <br />
          <Text>
            当前阶段: <Tag color={selectedArtifact.stage}>{selectedArtifact.stage}</Tag>
          </Text>
          {(() => {
            const idx = promotionStageOrder.indexOf(selectedArtifact.stage);
            if (idx < 0 || idx >= promotionStageOrder.length - 1) return null;
            const nextStage = promotionStageOrder[idx + 1];
            return (
              <>
                <br />
                <Text>
                  目标阶段: <Tag color={nextStage}>{nextStage}</Tag>
                </Text>
              </>
            );
          })()}
        </div>
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="promotedBy" label="操作人" rules={[{ required: true }]}>
          <Input placeholder="用户名" />
        </Form.Item>
        <Form.Item name="approvedBy" label="审批人 (可选)">
          <Input placeholder="审批人用户名" />
        </Form.Item>
        <Form.Item name="reason" label="晋升原因">
          <Input.TextArea rows={2} placeholder="晋升原因..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};
