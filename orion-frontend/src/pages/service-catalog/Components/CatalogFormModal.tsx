/**
 * ServiceCatalog create/edit modal
 */
import React from 'react';
import { Form, Input, Modal, Switch } from 'antd';
import type { FormInstance } from 'antd';

interface CatalogFormModalProps {
  open: boolean;
  form: FormInstance;
  editingItem: unknown | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export const CatalogFormModal: React.FC<CatalogFormModalProps> = ({
  open,
  form,
  editingItem,
  submitting,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title={editingItem ? '编辑服务目录' : '新建服务目录'}
    open={open}
    onOk={onSubmit}
    onCancel={onCancel}
    confirmLoading={submitting}
    destroyOnClose
    okText={editingItem ? '保存' : '创建'}
    cancelText="取消"
    width={520}
  >
    <Form form={form} layout="vertical" initialValues={{ enabled: true }}>
      <Form.Item
        name="name"
        label="名称"
        rules={[{ required: true, message: '请输入服务目录名称' }]}
      >
        <Input placeholder="请输入服务目录名称" />
      </Form.Item>
      <Form.Item name="value" label="值">
        <Input.TextArea rows={3} placeholder="请输入服务目录值（可选）" />
      </Form.Item>
      <Form.Item name="enabled" label="状态" valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="停用" />
      </Form.Item>
    </Form>
  </Modal>
);
