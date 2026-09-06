/**
 * TagModal.tsx - 添加标签 Modal
 * 抽取自 Artifacts/index.tsx (P2-9 Phase 75)
 */
import React from 'react';
import { Modal, Form, Input } from 'antd';
import type { FormInstance } from 'antd';

interface TagModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const TagModal: React.FC<TagModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => {
  return (
    <Modal
      title="添加标签"
      open={visible}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="tags" label="标签 (逗号分隔)" rules={[{ required: true }]}>
          <Input placeholder="如: stable, v2.5, production-ready" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
