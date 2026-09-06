/**
 * NamespaceModal - 创建命名空间 Modal
 */
import React from 'react';
import { Modal, Form, Input } from 'antd';

export interface NamespaceModalProps {
  open: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  onOk: (values: { name: string; description?: string }) => void;
  onCancel: () => void;
}

export const NamespaceModal: React.FC<NamespaceModalProps> = ({ open, form, onOk, onCancel }) => (
  <Modal title="创建命名空间" open={open} onCancel={onCancel} onOk={() => form.submit()} width={500}>
    <Form form={form} layout="vertical" onFinish={onOk}>
      <Form.Item name="name" label="命名空间名称" rules={[{ required: true }]}>
        <Input placeholder="e.g. production, dev" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input />
      </Form.Item>
    </Form>
  </Modal>
);
