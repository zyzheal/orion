/**
 * CodeScan create scan modal
 */
import React from 'react';
import { Form, Input, Modal } from 'antd';
import type { FormInstance } from 'antd';
import type { ScanCreateInput } from '../types';

interface CreateScanModalProps {
  open: boolean;
  form: FormInstance<ScanCreateInput>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ScanCreateInput) => void;
}

export const CreateScanModal: React.FC<CreateScanModalProps> = ({
  open,
  form,
  submitting,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title="新建代码扫描"
    open={open}
    confirmLoading={submitting}
    onCancel={onCancel}
    onOk={async () => {
      const values = await form.validateFields();
      onSubmit(values);
    }}
    okText="创建"
    cancelText="取消"
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        label="扫描目标"
        name="target"
        rules={[{ required: true, message: '请输入扫描目标' }]}
      >
        <Input placeholder="例: orion-frontend 或 git@github.com:orion/orion-frontend.git" />
      </Form.Item>
      <Form.Item label="分支" name="branch">
        <Input placeholder="默认 main" />
      </Form.Item>
    </Form>
  </Modal>
);
