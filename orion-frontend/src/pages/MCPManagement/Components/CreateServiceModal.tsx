/**
 * MCPManagement create service modal
 * 抽取自 index.tsx (P2-9 Phase 147)
 */
import React from 'react';
import { Form, Input, Modal, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { MCPServiceFormValues } from '../types';

interface CreateServiceModalProps {
  open: boolean;
  form: FormInstance<MCPServiceFormValues>;
  onCancel: () => void;
  onOk: () => void;
}

export const CreateServiceModal: React.FC<CreateServiceModalProps> = ({ open, form, onCancel, onOk }) => (
  <Modal
    title="注册 MCP 服务"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    okText="注册"
    cancelText="取消"
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="服务名称"
        rules={[{ required: true, message: '请输入服务名称' }]}
      >
        <Input placeholder="例: github-mcp" />
      </Form.Item>
      <Form.Item
        name="url"
        label="服务 URL"
        rules={[{ required: true, message: '请输入服务 URL' }]}
      >
        <Input placeholder="例: http://localhost:3017/mcp" />
      </Form.Item>
      <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
        <Switch />
      </Form.Item>
    </Form>
  </Modal>
);
