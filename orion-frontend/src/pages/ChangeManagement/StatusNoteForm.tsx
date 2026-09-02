/**
 * Status Change Note Form
 *
 * Extracted from index.tsx modal section.
 */
import { Form, Input } from 'antd';
import { spacing } from '@/tokens';

const { TextArea } = Input;

interface StatusNoteFormProps {
  formInstance: ReturnType<typeof Form.useForm>[0];
}

export function StatusNoteForm({ formInstance }: StatusNoteFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item name="note" label="备注（可选）">
        <TextArea rows={3} placeholder="添加状态变更备注" />
      </Form.Item>
    </Form>
  );
}
