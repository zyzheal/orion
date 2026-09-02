/**
 * CAB Decision Form — for adding CAB meeting decisions
 *
 * Extracted from index.tsx to reduce main file size.
 */
import { Form, Input, Select } from 'antd';
import { spacing } from '@/tokens';

const { TextArea } = Input;

interface DecisionFormProps {
  formInstance: ReturnType<typeof Form.useForm>[0];
}

export function DecisionForm({ formInstance }: DecisionFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="changeRequestId"
        label="变更请求 ID"
        rules={[{ required: true, message: '请输入变更请求 ID' }]}
      >
        <Input placeholder="变更请求 ID" />
      </Form.Item>
      <Form.Item
        name="decision"
        label="决策"
        rules={[{ required: true, message: '请选择决策' }]}
      >
        <Select placeholder="选择决策">
          <Select.Option value="approved">批准</Select.Option>
          <Select.Option value="rejected">拒绝</Select.Option>
          <Select.Option value="deferred">推迟</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item name="notes" label="备注">
        <TextArea rows={3} placeholder="决策备注（可选）" />
      </Form.Item>
    </Form>
  );
}
