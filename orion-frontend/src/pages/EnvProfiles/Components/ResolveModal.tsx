/**
 * EnvProfiles ResolveModal
 * 抽取自 index.tsx (P2-9 Phase 178)
 */
import { Modal, Form, Input, Typography, Descriptions } from 'antd';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';
import type { EnvProfile } from '@/api/env-profiles';

const { Text } = Typography;

interface ResolveModalProps {
  form: FormInstance;
  open: boolean;
  resolving: boolean;
  selectedProfile: EnvProfile | null;
  result: Record<string, string>;
  onClose: () => void;
  onSubmit: () => void;
}

export const ResolveModal = ({
  form,
  open,
  resolving,
  selectedProfile,
  result,
  onClose,
  onSubmit,
}: ResolveModalProps) => (
  <Modal
    title={selectedProfile ? `解析变量 — ${selectedProfile.name}/${selectedProfile.environment}` : '解析变量'}
    open={open}
    onCancel={onClose}
    onOk={onSubmit}
    confirmLoading={resolving}
    okText="解析"
    cancelText="取消"
    width={700}
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item name="overrides" label="Overrides (JSON，可选)">
        <Input.TextArea rows={3} placeholder='{"DB_HOST": "new-host"}' />
      </Form.Item>
    </Form>
    {Object.keys(result).length > 0 && (
      <div style={{ marginTop: spacing.md }}>
        <Text strong>解析结果：</Text>
        <Descriptions bordered size="small" column={1} style={{ marginTop: 8 }}>
          {Object.entries(result).map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>
              {value}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </div>
    )}
  </Modal>
);
