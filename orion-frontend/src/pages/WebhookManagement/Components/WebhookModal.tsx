/**
 * WebhookManagement WebhookModal (Create/Edit)
 * 抽取自 index.tsx (P2-9 Phase 172)
 */
import type { FormInstance } from 'antd';
import { Form, Input, Modal, Select, Switch } from 'antd';
import type { WebhookInput } from '@/api/webhook';
import { EVENT_OPTIONS } from '../constants';

interface WebhookModalProps {
  open: boolean;
  isEdit: boolean;
  form: FormInstance;
  submitting: boolean;
  onOk: () => void;
  onCancel: () => void;
  onFinish: (values: WebhookInput) => void;
}

export const WebhookModal = ({
  open,
  isEdit,
  form,
  submitting,
  onOk,
  onCancel,
  onFinish,
}: WebhookModalProps) => (
  <Modal
    title={isEdit ? '编辑 Webhook' : '新建 Webhook'}
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    okText={isEdit ? '保存' : '创建'}
    cancelText="取消"
    width={600}
  >
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item name="url" label="URL" rules={[{ required: true, type: 'url' }]}>
        <Input placeholder="https://example.com/webhook" />
      </Form.Item>
      <Form.Item name="events" label="订阅事件" rules={[{ required: true }]}>
        <Select mode="multiple" options={EVENT_OPTIONS.map((e) => ({ label: e, value: e }))} />
      </Form.Item>
      <Form.Item name="secret" label="Signing Secret">
        <Input.Password placeholder="用于验证 webhook 签名的密钥" />
      </Form.Item>
      <Form.Item name="enabled" label="启用" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  </Modal>
);
