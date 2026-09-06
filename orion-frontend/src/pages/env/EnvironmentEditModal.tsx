/**
 * EnvironmentEditModal
 * 编辑环境 Modal（抽取自 EnvironmentPage.tsx）
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { FormInstance } from 'antd';
import { envTypeOptions } from './constants';

const { TextArea } = Input;

export interface EnvironmentEditModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onOk: () => Promise<void> | void;
  onCancel: () => void;
}

export const EnvironmentEditModal: React.FC<EnvironmentEditModalProps> = ({
  visible,
  form,
  submitting,
  onOk,
  onCancel,
}) => (
  <Modal
    title="编辑环境"
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={640}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="环境名称">
        <Input />
      </Form.Item>
      <Form.Item name="type" label="环境类型">
        <Select options={envTypeOptions} />
      </Form.Item>
      <Form.Item name="cluster" label="集群">
        <Input />
      </Form.Item>
      <Form.Item name="namespace" label="命名空间">
        <Input />
      </Form.Item>
      <Form.Item name="config" label="配置 (JSON 格式)">
        <TextArea rows={5} />
      </Form.Item>
    </Form>
  </Modal>
);
