/**
 * FlowVersions CreateVersionModal
 * 抽取自 index.tsx (P2-9 Phase 184)
 */
import { Modal, Form, Input, Button, type FormInstance } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import type { VersionCreateInput } from '../useFlowVersionsState';

interface CreateVersionModalProps {
  open: boolean;
  form: FormInstance<VersionCreateInput>;
  onFinish: (values: VersionCreateInput) => void;
  onCancel: () => void;
}

export const CreateVersionModal = ({ open, form, onFinish, onCancel }: CreateVersionModalProps) => (
  <Modal title="创建版本快照" open={open} onCancel={onCancel} footer={null}>
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        name="changeLog"
        label="变更说明"
        rules={[{ required: true, message: '请输入变更说明' }]}
      >
        <Input.TextArea placeholder="描述本次版本的变更内容..." rows={4} maxLength={500} showCount />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block icon={<SaveOutlined />}>
          创建快照
        </Button>
      </Form.Item>
    </Form>
  </Modal>
);
