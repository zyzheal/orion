/**
 * DeprecateVersionModal.tsx - 废弃版本 Modal
 * 抽取自 InternalLibrary/index.tsx (P2-9 Phase 74)
 */
import React from 'react';
import { Modal, Form, Input, DatePicker } from 'antd';
import type { FormInstance } from 'antd';

interface DeprecateVersionModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const DeprecateVersionModal: React.FC<DeprecateVersionModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => {
  return (
    <Modal
      title="废弃版本"
      open={visible}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="targetVersion"
          label="目标版本"
          rules={[{ required: true, message: '请输入版本号' }]}
        >
          <Input placeholder="版本号" />
        </Form.Item>
        <Form.Item
          name="reason"
          label="废弃原因"
          rules={[{ required: true, message: '请输入废弃原因' }]}
        >
          <Input.TextArea rows={3} placeholder="为什么废弃此版本..." />
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
      </Form>
    </Modal>
  );
};
