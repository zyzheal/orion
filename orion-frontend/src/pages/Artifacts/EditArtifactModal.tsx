/**
 * EditArtifactModal.tsx - 编辑制品 Modal
 * 抽取自 Artifacts/index.tsx (P2-9 Phase 75)
 */
import React from 'react';
import { Modal, Form, Input } from 'antd';
import type { FormInstance } from 'antd';

interface EditArtifactModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const EditArtifactModal: React.FC<EditArtifactModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => {
  return (
    <Modal
      title="编辑制品"
      open={visible}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      width={640}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="displayName" label="显示名称">
          <Input />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="retentionDays" label="保留天数">
          <Input type="number" placeholder="如: 90" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
