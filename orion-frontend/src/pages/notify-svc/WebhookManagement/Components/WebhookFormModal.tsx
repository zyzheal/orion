/**
 * WebhookManagement WebhookFormModal
 * 抽取自 index.tsx (P2-9 Phase 185)
 */
import { Modal, Form, Input, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { WebhookInput } from '@/api/webhook';
import { EVENT_OPTIONS } from '../constants';

interface WebhookFormModalProps {
  form: FormInstance<WebhookInput>;
  open: boolean;
  editingWebhook: unknown;
  onSubmit: (values: WebhookInput) => void;
  onClose: () => void;
}

export const WebhookFormModal = ({
  form,
  open,
  editingWebhook,
  onSubmit,
  onClose,
}: WebhookFormModalProps) => (
  <Modal
    title={editingWebhook ? '编辑 Webhook' : '新建 Webhook'}
    open={open}
    onCancel={onClose}
    onOk={() => form.submit()}
    width={600}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
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
