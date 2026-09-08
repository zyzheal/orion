/**
 * ABACPolicy PolicyModal
 * 抽取自 index.tsx (P2-9 Phase 202)
 */
import { Form, Input, Modal, Select } from 'antd';
import type { AbacPolicy } from '@/api/abac-policy';
import { ACTION_OPTIONS, EFFECT_OPTIONS, RESOURCE_OPTIONS } from '../constants';

const { TextArea } = Input;

interface Props {
  open: boolean;
  selectedPolicy: AbacPolicy | null;
  form: ReturnType<typeof Form.useForm>[0];
  onOk: () => void;
  onCancel: () => void;
}

export const PolicyModal = ({ open, selectedPolicy, form, onOk, onCancel }: Props) => (
  <Modal
    title={selectedPolicy ? '编辑策略' : '新建策略'}
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    width={600}
  >
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="策略名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input />
      </Form.Item>
      <Form.Item name="resourceType" label="资源类型" rules={[{ required: true }]}>
        <Select mode="multiple" placeholder="选择资源类型" options={RESOURCE_OPTIONS} />
      </Form.Item>
      <Form.Item name="actionType" label="操作类型" rules={[{ required: true }]}>
        <Select mode="multiple" placeholder="选择操作类型" options={ACTION_OPTIONS} />
      </Form.Item>
      <Form.Item name="effect" label="效果" rules={[{ required: true }]}>
        <Select placeholder="选择效果" options={EFFECT_OPTIONS} />
      </Form.Item>
      <Form.Item name="priority" label="优先级" initialValue={50}>
        <Input type="number" />
      </Form.Item>
      <Form.Item name="conditions" label="条件 (JSON)">
        <TextArea
          rows={4}
          placeholder='{"condition": {"attribute": "user.role", "operator": "equals", "value": "admin"}}'
        />
      </Form.Item>
    </Form>
  </Modal>
);
