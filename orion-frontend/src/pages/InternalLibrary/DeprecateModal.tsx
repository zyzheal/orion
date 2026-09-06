/**
 * DeprecateModal.tsx - 废弃二方库 Modal
 * 抽取自 InternalLibrary/index.tsx (P2-9 Phase 74)
 */
import React from 'react';
import { Modal, Form, Input, DatePicker } from 'antd';
import type { FormInstance } from 'antd';

interface DeprecateModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const DeprecateModal: React.FC<DeprecateModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => {
  return (
    <Modal
      title="废弃二方库"
      open={visible}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label="废弃原因"
          rules={[{ required: true, message: '请输入废弃原因' }]}
        >
          <Input.TextArea rows={3} placeholder="为什么废弃此二方库..." />
        </Form.Item>
        <Form.Item
          name="eolDate"
          label="EOL 日期"
          rules={[{ required: true, message: '请选择 EOL 日期' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="migrationGuide" label="迁移指南">
          <Input placeholder="https://docs.example.com/migrate" />
        </Form.Item>
        <Form.Item name="replacementLibrary" label="替代二方库">
          <Input placeholder="如: @orion/auth-v2" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
