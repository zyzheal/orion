/**
 * AddDependentModal.tsx - 添加依赖关系 Modal
 * 抽取自 InternalLibrary/index.tsx (P2-9 Phase 74)
 */
import React from 'react';
import { Modal, Form, Input } from 'antd';
import type { FormInstance } from 'antd';

interface AddDependentModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const AddDependentModal: React.FC<AddDependentModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => {
  return (
    <Modal
      title="添加依赖关系"
      open={visible}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="repoName"
          label="项目名称"
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder="如: orion-platform-service" />
        </Form.Item>
        <Form.Item
          name="teamName"
          label="团队名称"
          rules={[{ required: true, message: '请输入团队名称' }]}
        >
          <Input placeholder="如: platform-team" />
        </Form.Item>
        <Form.Item
          name="version"
          label="使用版本"
          rules={[{ required: true, message: '请输入版本号' }]}
        >
          <Input placeholder="如: 2.3.0" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
