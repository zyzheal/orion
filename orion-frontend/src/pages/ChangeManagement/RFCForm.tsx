/**
 * RFC Create/Edit Form — shared between create and edit modals
 *
 * Extracted from index.tsx to reduce main file size.
 */
import { Form, Input } from 'antd';
import { spacing } from '@/tokens';

const { TextArea } = Input;

interface RFCFormProps {
  formInstance: ReturnType<typeof Form.useForm>[0];
}

export function RFCForm({ formInstance }: RFCFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="change_request_id"
        label="关联变更请求 ID"
        rules={[{ required: true, message: '请输入变更请求 ID' }]}
      >
        <Input placeholder="变更请求 ID" />
      </Form.Item>
      <Form.Item name="justification" label="变更理由">
        <TextArea rows={3} placeholder="说明变更的必要性" />
      </Form.Item>
      <Form.Item name="risk_assessment" label="风险评估">
        <TextArea rows={2} placeholder="评估变更风险" />
      </Form.Item>
      <Form.Item name="test_plan" label="测试计划">
        <TextArea rows={2} placeholder="变更测试方案" />
      </Form.Item>
      <Form.Item name="communication_plan" label="沟通计划">
        <TextArea rows={2} placeholder="变更沟通方案" />
      </Form.Item>
      <Form.Item name="backout_plan" label="退出计划">
        <TextArea rows={2} placeholder="变更退出/回滚方案" />
      </Form.Item>
    </Form>
  );
}
