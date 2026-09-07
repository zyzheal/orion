/**
 * EnvProfiles EditModal
 * 抽取自 index.tsx (P2-9 Phase 178)
 */
import { Modal, Form, Input, Select } from 'antd';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';
import type { EnvProfile } from '@/api/env-profiles';
import { ENVIRONMENT_OPTIONS } from '../constants';

interface EditModalProps {
  form: FormInstance;
  open: boolean;
  submitting: boolean;
  editingItem: EnvProfile | null;
  onClose: () => void;
  onSubmit: () => void;
}

export const EditModal = ({ form, open, submitting, editingItem, onClose, onSubmit }: EditModalProps) => (
  <Modal
    title={editingItem ? '编辑环境配置' : '创建环境配置'}
    open={open}
    onCancel={onClose}
    onOk={onSubmit}
    confirmLoading={submitting}
    okText={editingItem ? '保存' : '创建'}
    cancelText="取消"
    width={600}
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item name="name" label="Name" rules={[{ required: true, message: '请输入 Name' }]}>
        <Input placeholder="配置名称（如 default）" />
      </Form.Item>
      <Form.Item
        name="environment"
        label="Environment"
        rules={[{ required: true, message: '请选择环境' }]}
      >
        <Select options={ENVIRONMENT_OPTIONS} />
      </Form.Item>
      <Form.Item
        name="variables"
        label="Variables (JSON)"
        rules={[{ required: true, message: '请输入 Variables JSON' }]}
      >
        <Input.TextArea rows={6} placeholder='{"DB_HOST": "localhost", "DB_PORT": "5432"}' />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <Input.TextArea rows={2} placeholder="配置描述（可选）" />
      </Form.Item>
    </Form>
  </Modal>
);
