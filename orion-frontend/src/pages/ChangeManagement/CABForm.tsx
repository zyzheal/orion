/**
 * CAB Meeting Create/Edit Form — shared between create and edit modals
 *
 * Extracted from index.tsx to reduce main file size.
 */
import { Form, Input, DatePicker } from 'antd';
import { spacing } from '@/tokens';

const { TextArea } = Input;

interface CABFormProps {
  formInstance: ReturnType<typeof Form.useForm>[0];
}

export function CABForm({ formInstance }: CABFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="title"
        label="会议标题"
        rules={[{ required: true, message: '请输入会议标题' }]}
      >
        <Input placeholder="CAB 会议标题" />
      </Form.Item>
      <Form.Item name="description" label="会议描述">
        <TextArea rows={2} placeholder="会议描述（可选）" />
      </Form.Item>
      <Form.Item
        name="scheduled_at"
        label="会议时间"
        rules={[{ required: true, message: '请选择会议时间' }]}
      >
        <DatePicker showTime style={{ width: '100%' }} placeholder="选择会议时间" />
      </Form.Item>
      <Form.Item name="location" label="会议地点">
        <Input placeholder="会议地点（可选）" />
      </Form.Item>
      <Form.Item name="attendees" label="参会人" help="多人用逗号分隔">
        <Input placeholder="张三, 李四, 王五" />
      </Form.Item>
    </Form>
  );
}
