/**
 * EnvironmentCreateModal
 * 创建环境 Modal（抽取自 EnvironmentPage.tsx）
 */
import React from 'react';
import { Modal, Form, Input, Select, Button, Space } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { EnvTemplate } from './constants';
import { envTypeOptions } from './constants';

const { TextArea } = Input;

export interface EnvironmentCreateModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  templates: EnvTemplate[];
  onOk: () => Promise<void> | void;
  onCancel: () => void;
  onApplyTemplate: (template: EnvTemplate) => void;
}

export const EnvironmentCreateModal: React.FC<EnvironmentCreateModalProps> = ({
  visible,
  form,
  submitting,
  templates,
  onOk,
  onCancel,
  onApplyTemplate,
}) => (
  <Modal
    title="创建环境"
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={640}
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
        <Select options={envTypeOptions} />
      </Form.Item>
      <Form.Item name="cluster" label="集群">
        <Input placeholder="如: k8s-dev-01" />
      </Form.Item>
      <Form.Item name="namespace" label="命名空间">
        <Input placeholder="如: default" />
      </Form.Item>
      <Form.Item label="应用模板">
        <Space wrap>
          {templates.map((t) => (
            <Button
              key={t.name}
              size="small"
              icon={<CopyOutlined />}
              onClick={() => onApplyTemplate(t)}
            >
              {t.name}
            </Button>
          ))}
        </Space>
      </Form.Item>
      <Form.Item name="config" label="配置 (JSON 格式)">
        <TextArea
          rows={5}
          placeholder={
            '{ "replicas": 1, "resources": { "cpu": "100m", "memory": "256Mi" }, "autoSleep": true, "ttlHours": 8 }'
          }
        />
      </Form.Item>
    </Form>
  </Modal>
);
