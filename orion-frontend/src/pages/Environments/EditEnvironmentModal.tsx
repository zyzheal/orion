/**
 * EditEnvironmentModal.tsx - 编辑环境弹窗
 * 抽取自 Environments/index.tsx (P2-9 Phase 82)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { environmentTypeOptions } from './constants';

interface EditEnvironmentModalProps {
  visible: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const EditEnvironmentModal: React.FC<EditEnvironmentModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => (
  <Modal
    title="编辑环境"
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={600}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="环境名称">
        <Input />
      </Form.Item>
      <Form.Item name="type" label="环境类型">
        <Select options={environmentTypeOptions} />
      </Form.Item>
      <Form.Item name="cluster" label="集群">
        <Input />
      </Form.Item>
      <Form.Item name="namespace" label="命名空间">
        <Input />
      </Form.Item>
      <Form.Item name="config" label="配置 (JSON 格式)">
        <Input.TextArea rows={4} />
      </Form.Item>
    </Form>
  </Modal>
);
