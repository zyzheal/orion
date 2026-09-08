/**
 * EditProfileModal - 编辑个人资料弹窗
 * 抽取自 index.tsx (P2-9 Phase 206)
 */
import { Modal, Form, Input } from 'antd';
import type { FormInstance } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import type { EditProfileFormValues } from '../useUserProfileState';

interface Props {
  open: boolean;
  form: FormInstance<EditProfileFormValues>;
  onOk: () => void;
  onCancel: () => void;
}

export const EditProfileModal = ({ open, form, onOk, onCancel }: Props) => (
  <Modal title="编辑个人资料" open={open} onOk={onOk} onCancel={onCancel} okText="保存" cancelText="取消">
    <Form form={form} layout="vertical">
      <Form.Item
        label="用户名"
        name="username"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input prefix={<UserOutlined />} />
      </Form.Item>
      <Form.Item
        label="邮箱"
        name="email"
        rules={[{ type: 'email', message: '请输入有效邮箱' }]}
      >
        <Input prefix={<MailOutlined />} />
      </Form.Item>
      <Form.Item label="手机" name="phone">
        <Input prefix={<PhoneOutlined />} />
      </Form.Item>
    </Form>
  </Modal>
);
