/**
 * ServiceCatalog ServiceModal
 * 抽取自 index.tsx (P2-9 Phase 189)
 */
import { Form, Input, Modal, Switch } from 'antd';
import type { FormInstance } from 'antd';

interface ServiceModalProps {
  form: FormInstance;
  open: boolean;
  submitting: boolean;
  isEdit: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export const ServiceModal = ({ form, open, submitting, isEdit, onSubmit, onClose }: ServiceModalProps) => (
  <Modal
    title={isEdit ? '编辑服务' : '新建服务'}
    open={open}
    onOk={onSubmit}
    confirmLoading={submitting}
    okText={isEdit ? '保存' : '创建'}
    onCancel={onClose}
    width={560}
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="服务名称"
        rules={[{ required: true, message: '请输入服务名称' }]}
      >
        <Input placeholder="e.g. user-service" />
      </Form.Item>
      <Form.Item name="value" label="服务值">
        <Input.TextArea rows={3} placeholder="服务描述或配置值" />
      </Form.Item>
      <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
        <Switch />
      </Form.Item>
    </Form>
  </Modal>
);
