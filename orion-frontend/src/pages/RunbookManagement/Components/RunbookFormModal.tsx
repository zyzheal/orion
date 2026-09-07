/**
 * Runbook create/edit modal
 * 抽取自 index.tsx (P2-9 Phase 163)
 */
import { Form, Input, Modal, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import { categoryOptions } from '../constants';

const { TextArea } = Input;

interface RunbookFormModalProps {
  open: boolean;
  form: FormInstance;
  isEdit: boolean;
  onOk: () => void | Promise<void>;
  onCancel: () => void;
}

export const RunbookFormModal = ({ open, form, isEdit, onOk, onCancel }: RunbookFormModalProps) => (
  <Modal
    title={isEdit ? '编辑 Runbook' : '创建 Runbook'}
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    width={700}
  >
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
        <Input placeholder="输入 Runbook 名称" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <TextArea rows={2} placeholder="输入描述" />
      </Form.Item>
      <Form.Item
        name="category"
        label="分类"
        rules={[{ required: true, message: '请选择分类' }]}
      >
        <Select placeholder="选择分类" options={categoryOptions} />
      </Form.Item>
      <Form.Item name="enabled" label="启用" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  </Modal>
);
