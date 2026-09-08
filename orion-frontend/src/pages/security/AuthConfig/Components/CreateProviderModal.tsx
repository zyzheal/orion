/**
 * AuthConfig CreateProviderModal
 * 抽取自 index.tsx (P2-9 Phase 203)
 */
import { Form, Input, Modal, Select } from 'antd';
import type { CreateProviderFormValues } from '../types';
import { TYPE_OPTIONS } from '../constants';

interface Props {
  open: boolean;
  creating: boolean;
  form: ReturnType<typeof Form.useForm<CreateProviderFormValues>>[0];
  onOk: () => Promise<void>;
  onCancel: () => void;
}

export const CreateProviderModal = ({ open, creating, form, onOk, onCancel }: Props) => (
  <Modal
    title="新建认证源"
    open={open}
    confirmLoading={creating}
    onCancel={onCancel}
    onOk={onOk}
    okText="创建"
    cancelText="取消"
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        label="认证源名称"
        name="name"
        rules={ [{ required: true, message: '请输入认证源名称' }] }
      >
        <Input placeholder="例: Google OAuth2" />
      </Form.Item>
      <Form.Item
        label="认证类型"
        name="type"
        rules={ [{ required: true, message: '请选择认证类型' }] }
      >
        <Select placeholder="选择认证类型" options={TYPE_OPTIONS} />
      </Form.Item>
      <Form.Item label="Client ID" name="clientId">
        <Input placeholder="OAuth2/OIDC Client ID" />
      </Form.Item>
      <Form.Item label="Client Secret" name="clientSecret">
        <Input.Password placeholder="OAuth2/OIDC Client Secret" />
      </Form.Item>
      <Form.Item label="Discovery URL" name="discoveryUrl">
        <Input placeholder="OIDC Discovery URL" />
      </Form.Item>
    </Form>
  </Modal>
);
