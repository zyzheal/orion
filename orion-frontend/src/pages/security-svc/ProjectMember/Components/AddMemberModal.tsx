import { Form, Input, Modal, Select } from 'antd';

const { Option } = Select;

interface Props {
  open: boolean;
  form: any;
  onOk: () => void;
  onCancel: () => void;
}

export function AddMemberModal({ open, form, onOk, onCancel }: Props) {
  return (
    <Modal title="添加项目成员" open={open} onOk={onOk} onCancel={onCancel}>
      <Form form={form} layout="vertical">
        <Form.Item
          name="userId"
          label="用户ID"
          rules={[{ required: true, message: '请输入用户ID' }]}
        >
          <Input placeholder="请输入用户ID" />
        </Form.Item>
        <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
          <Select placeholder="选择角色">
            <Option value="admin">管理员</Option>
            <Option value="developer">开发者</Option>
            <Option value="viewer">查看者</Option>
            <Option value="approver">审批者</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
