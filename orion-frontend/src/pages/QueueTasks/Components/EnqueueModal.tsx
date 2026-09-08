/**
 * EnqueueModal - 入队新任务弹窗
 * 抽取自 index.tsx (P2-9 Phase 209)
 */
import { Modal, Form, Input } from 'antd';
import type { FormInstance } from 'antd';
import type { EnqueueInput } from '@/api/queue';

interface Props {
  open: boolean;
  submitting: boolean;
  form: FormInstance<EnqueueInput>;
  onCancel: () => void;
  onSubmit: () => void;
  onFinish: (values: EnqueueInput) => void;
}

export const EnqueueModal = ({ open, submitting, form, onCancel, onSubmit, onFinish }: Props) => (
  <Modal
    title="入队新任务"
    open={open}
    onCancel={onCancel}
    onOk={onSubmit}
    confirmLoading={submitting}
    okText="入队"
    cancelText="取消"
    width={600}
  >
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        name="tenantId"
        label="租户 ID"
        rules={[{ required: true }]}
        initialValue="default"
      >
        <Input />
      </Form.Item>
      <Form.Item name="payload" label="任务数据 (JSON)" rules={[{ required: true }]}>
        <Input.TextArea rows={6} placeholder='{"key": "value"}' />
      </Form.Item>
    </Form>
  </Modal>
);
