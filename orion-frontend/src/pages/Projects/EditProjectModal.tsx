/**
 * EditProjectModal.tsx - 编辑项目弹窗
 * 抽取自 Projects/index.tsx (P2-9 Phase 83)
 */
import React from 'react';
import { Modal, Form, Input } from 'antd';

interface EditProjectModalProps {
  visible: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => (
  <Modal
    title="编辑项目"
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={640}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="项目名称"
        rules={[{ required: true, message: '请输入项目名称' }]}
      >
        <Input />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item name="teamLead" label="负责人">
        <Input />
      </Form.Item>
      <Form.Item name="teamMembers" label="团队成员 (逗号分隔)">
        <Input />
      </Form.Item>
      <Form.Item name="environments" label="环境 (逗号分隔)">
        <Input />
      </Form.Item>
    </Form>
  </Modal>
);
