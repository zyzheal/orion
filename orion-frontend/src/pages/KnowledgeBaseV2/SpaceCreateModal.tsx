/**
 * SpaceCreateModal - 新建知识库空间 Modal
 * 抽取自 KnowledgeBasePage.tsx (P2-9 Phase 39)
 */
import React from 'react';
import { Modal, Form, Input } from 'antd';

export interface SpaceCreateModalProps {
  visible: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  onOk: () => void;
  onCancel: () => void;
}

export const SpaceCreateModal: React.FC<SpaceCreateModalProps> = ({
  visible, form, submitting, onOk, onCancel,
}) => (
  <Modal
    title="新建知识库空间"
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={500}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="空间名称" rules={[{ required: true, message: '请输入空间名称' }]}>
        <Input placeholder="如: 技术文档库" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea rows={3} placeholder="描述该知识库空间的用途..." />
      </Form.Item>
    </Form>
  </Modal>
);
