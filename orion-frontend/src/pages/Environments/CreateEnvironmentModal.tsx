/**
 * CreateEnvironmentModal.tsx - 创建环境弹窗
 * 抽取自 Environments/index.tsx (P2-9 Phase 82)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { environmentTypeOptions } from './constants';

interface CreateEnvironmentModalProps {
  visible: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const CreateEnvironmentModal: React.FC<CreateEnvironmentModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => (
  <Modal
    title="创建环境"
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={600}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="projectId"
        label="项目 ID"
        rules={[{ required: true, message: '请输入项目 ID' }]}
      >
        <Input placeholder="如: proj-1" />
      </Form.Item>
      <Form.Item
        name="name"
        label="环境名称"
        rules={[{ required: true, message: '请输入环境名称' }]}
      >
        <Input placeholder="如: dev-default, staging, production" />
      </Form.Item>
      <Form.Item
        name="type"
        label="环境类型"
        rules={[{ required: true, message: '请选择环境类型' }]}
      >
        <Select options={environmentTypeOptions} />
      </Form.Item>
      <Form.Item name="cluster" label="集群">
        <Input placeholder="如: k8s-dev-01" />
      </Form.Item>
      <Form.Item name="namespace" label="命名空间">
        <Input placeholder="如: default" />
      </Form.Item>
      <Form.Item name="config" label="配置 (JSON 格式)">
        <Input.TextArea
          rows={4}
          placeholder={'{ "replicas": 1, "resources": { "cpu": "100m", "memory": "256Mi" } }'}
        />
      </Form.Item>
    </Form>
  </Modal>
);
