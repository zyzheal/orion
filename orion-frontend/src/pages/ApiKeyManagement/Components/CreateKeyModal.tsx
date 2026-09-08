/**
 * ApiKeyManagement CreateKeyModal
 * 抽取自 index.tsx (P2-9 Phase 204)
 */
import { Alert, Button, DatePicker, Form, Input, Modal } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

interface Props {
  open: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  createdKey: string | null;
  onCopyKey: (key: string) => void;
  onSubmit: (values: unknown) => Promise<void>;
  onCancel: () => void;
}

export const CreateKeyModal = ({
  open,
  form,
  createdKey,
  onCopyKey,
  onSubmit,
  onCancel,
}: Props) => (
  <Modal
    title="新建 API Key"
    open={open}
    onCancel={onCancel}
    footer={
      createdKey
        ? [
            <Button key="close" type="primary" onClick={onCancel}>
              完成
            </Button>,
          ]
        : undefined
    }
    width={480}
  >
    {createdKey ? (
      <div>
        <Alert
          message="请妥善保存此 API Key，关闭后将无法再次查看"
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
        <Input
          value={createdKey}
          readOnly
          addonAfter={
            <Button type="link" onClick={() => onCopyKey(createdKey)}>
              <CopyOutlined /> 复制
            </Button>
          }
        />
      </div>
    ) : (
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input placeholder="e.g. ci-pipeline-key" />
        </Form.Item>
        <Form.Item name="expiresAt" label="过期时间">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            创建
          </Button>
        </Form.Item>
      </Form>
    )}
  </Modal>
);
