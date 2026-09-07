/**
 * ScriptVersions CreateVersionModal
 * 抽取自 index.tsx (P2-9 Phase 187)
 */
import { Modal, Form, Input } from 'antd';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';

interface CreateFormValues {
  version?: string;
  content?: string;
  parameters?: string;
  changeDescription?: string;
  createdBy?: string;
}

interface CreateVersionModalProps {
  form: FormInstance<CreateFormValues>;
  open: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export const CreateVersionModal = ({ form, open, onSubmit, onClose }: CreateVersionModalProps) => (
  <Modal
    title="创建版本"
    open={open}
    onCancel={onClose}
    onOk={onSubmit}
    okText="创建"
    width={700}
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="version"
        label="Version"
        rules={[{ required: true, message: '请输入版本号' }]}
      >
        <Input placeholder="如: v1.0.0" />
      </Form.Item>
      <Form.Item
        name="content"
        label="Content"
        rules={[{ required: true, message: '请输入脚本内容' }]}
      >
        <Input.TextArea rows={8} placeholder="脚本内容" />
      </Form.Item>
      <Form.Item name="parameters" label="Parameters (JSON)">
        <Input.TextArea rows={3} placeholder='{"timeout": 30}' />
      </Form.Item>
      <Form.Item name="changeDescription" label="Change Description">
        <Input placeholder="变更说明" />
      </Form.Item>
      <Form.Item name="createdBy" label="Created By">
        <Input placeholder="创建人" />
      </Form.Item>
    </Form>
  </Modal>
);
