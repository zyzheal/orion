/**
 * GlobalParams ParamModal
 * 抽取自 index.tsx (P2-9 Phase 201)
 */
import { Form, Input, Modal, Select } from 'antd';
import { spacing } from '@/tokens';
import type { GlobalParam } from '@/api/global-params';
import type { GlobalParamFormValues } from '../useGlobalParamsState';
import { BOOL_OPTIONS, SCOPE_OPTIONS } from '../constants';

interface Props {
  open: boolean;
  editingItem: GlobalParam | null;
  form: ReturnType<typeof Form.useForm<GlobalParamFormValues>>[0];
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const ParamModal = ({
  open,
  editingItem,
  form,
  submitting,
  onCancel,
  onOk,
}: Props) => (
  <Modal
    title={editingItem ? '编辑参数' : '创建参数'}
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    okText={editingItem ? '保存' : '创建'}
    width={500}
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item name="key" label="Key" rules={[{ required: true, message: '请输入 Key' }]}>
        <Input placeholder="参数键名" disabled={!!editingItem} />
      </Form.Item>
      <Form.Item
        name="value"
        label="Value"
        rules={[{ required: true, message: '请输入 Value' }]}
      >
        <Input.TextArea rows={3} placeholder="参数值" />
      </Form.Item>
      <Form.Item name="scope" label="Scope" rules={[{ required: true }]}>
        <Select options={SCOPE_OPTIONS} />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <Input.TextArea rows={2} placeholder="参数描述（可选）" />
      </Form.Item>
      <Form.Item name="isSecret" label="是否加密" valuePropName="checked">
        <Select options={BOOL_OPTIONS} />
      </Form.Item>
      <Form.Item name="expiresAt" label="过期时间">
        <Input placeholder="ISO 8601 格式，留空表示永不过期" />
      </Form.Item>
    </Form>
  </Modal>
);
