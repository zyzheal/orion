/**
 * MCPManagement edit service modal
 * 抽取自 index.tsx (P2-9 Phase 147)
 */
import React from 'react';
import { Form, Input, Modal, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { MCPService, MCPServiceFormValues } from '../types';

interface EditServiceModalProps {
  server: MCPService | null;
  open: boolean;
  form: FormInstance<MCPServiceFormValues>;
  onCancel: () => void;
  onOk: () => void;
}

export const EditServiceModal: React.FC<EditServiceModalProps> = ({
  server,
  open,
  form,
  onCancel,
  onOk,
}) => {
  if (!server) return null;
  return (
    <Modal
      title="编辑 MCP 服务"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="服务名称" rules={[{ required: true }]}>
          <Input placeholder="服务名称" />
        </Form.Item>
        <Form.Item name="url" label="服务 URL" rules={[{ required: true }]}>
          <Input placeholder="服务 URL" />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};
