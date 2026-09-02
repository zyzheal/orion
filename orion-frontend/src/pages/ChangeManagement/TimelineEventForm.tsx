/**
 * Timeline Event Form — used in "Add Timeline Event" modal
 *
 * Extracted from index.tsx modal section.
 */
import { Form, Input, Select } from 'antd';
import { spacing } from '@/tokens';
import { eventTypeConfig } from './config';

const { TextArea } = Input;

interface TimelineEventFormProps {
  formInstance: ReturnType<typeof Form.useForm>[0];
}

export function TimelineEventForm({ formInstance }: TimelineEventFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="event_type"
        label="事件类型"
        rules={[{ required: true, message: '请选择事件类型' }]}
      >
        <Select placeholder="选择事件类型">
          {Object.entries(eventTypeConfig).map(([key, cfg]) => (
            <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        name="description"
        label="事件描述"
        rules={[{ required: true, message: '请输入事件描述' }]}
      >
        <TextArea rows={4} placeholder="详细描述此事件记录" />
      </Form.Item>
    </Form>
  );
}
