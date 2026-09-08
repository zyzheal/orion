/**
 * GlobalParams ResolveModal
 * 抽取自 index.tsx (P2-9 Phase 201)
 */
import { Form, Input, Modal, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import type { ResolveFormValues } from '../useGlobalParamsState';

const { Text } = Typography;

interface Props {
  open: boolean;
  form: ReturnType<typeof Form.useForm<ResolveFormValues>>[0];
  resolving: boolean;
  result: Record<string, string>;
  onCancel: () => void;
  onOk: () => void;
}

export const ResolveModal = ({ open, form, resolving, result, onCancel, onOk }: Props) => (
  <Modal
    title="批量解析参数"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={resolving}
    okText="解析"
    width={600}
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="keys"
        label="Keys (JSON)"
        rules={[{ required: true, message: '请输入 keys JSON' }]}
      >
        <Input.TextArea rows={4} placeholder='{"DB_HOST": "prod-db", "DB_PORT": "5432"}' />
      </Form.Item>
    </Form>
    {Object.keys(result).length > 0 && (
      <div style={{ marginTop: spacing.md }}>
        <Text strong>解析结果：</Text>
        <pre
          style={{
            background: colors.neutral[200],
            padding: spacing.md,
            borderRadius: 6,
            marginTop: spacing.sm,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    )}
  </Modal>
);
