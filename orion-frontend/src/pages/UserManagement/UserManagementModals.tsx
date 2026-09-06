/**
 * UserManagement Modals & Drawers
 */
import React from 'react';
import {
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Popconfirm,
  Typography,
} from 'antd';
import {
  LockOutlined,
  UnlockOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { User } from '@/api/users';

type FormInstance = ReturnType<typeof Form.useForm>[0];
const { Text } = Typography;

interface UserManagementModalsProps {
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  editModalVisible: boolean;
  setEditModalVisible: (v: boolean) => void;
  editingUser: User | null;
  setEditingUser: (v: User | null) => void;
  detailDrawerVisible: boolean;
  setDetailDrawerVisible: (v: boolean) => void;
  selectedUser: User | null;
  setSelectedUser: (v: User | null) => void;
  changePwModalVisible: boolean;
  setChangePwModalVisible: (v: boolean) => void;
  createForm: FormInstance;
  editForm: FormInstance;
  changePwForm: FormInstance;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  handleCreate: () => void;
  handleEdit: () => void;
  handleChangePassword: () => void;
  handleEnable: (id: string) => void;
  handleDisable: (id: string) => void;
  openEdit: (u: User) => void;
  roleOptions: { label: string; value: string }[];
  detailItems: React.ReactNode;
}

export const UserManagementModals: React.FC<UserManagementModalsProps> = (props) => (
  <>
          {/* Create Modal */}
          <Modal
            title="创建用户"
            open={props.createModalVisible}
            onCancel={() => props.setCreateModalVisible(false)}
            onOk={props.handleCreate}
            confirmLoading={props.submitting}
            width={560}
            destroyOnClose
          >
            <Form form={props.createForm} layout="vertical" initialValues={{ role: 'user' }}>
              <Form.Item
                name="username"
                label="用户名"
                rules={[
                  { required: true, message: '请输入用户名' },
                  {
                    pattern: /^[a-zA-Z0-9_-]+$/,
                    message: '用户名只能包含字母、数字、连字符和下划线',
                  },
                ]}
              >
                <Input placeholder="如: zhangsan" />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码至少8个字符' },
                ]}
              >
                <Input.Password placeholder="至少8个字符" />
              </Form.Item>
              <Form.Item name="name" label="显示名称">
                <Input placeholder="用户显示名称" />
              </Form.Item>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
              >
                <Input placeholder="user@example.com" />
              </Form.Item>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select options={props.roleOptions} />
              </Form.Item>
            </Form>
          </Modal>

          {/* Edit Modal */}
          <Modal
            title="编辑用户"
            open={props.editModalVisible}
            onCancel={() => props.setEditModalVisible(false)}
            onOk={props.handleEdit}
            confirmLoading={props.submitting}
            width={560}
            destroyOnClose
          >
            <Form form={props.editForm} layout="vertical">
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="name" label="显示名称">
                <Input />
              </Form.Item>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="role"
                label="角色"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select options={props.roleOptions} />
              </Form.Item>
            </Form>
          </Modal>

          {/* Change Password Modal */}
          <Modal
            title="重置密码"
            open={props.changePwModalVisible}
            onCancel={() => props.setChangePwModalVisible(false)}
            onOk={props.handleChangePassword}
            confirmLoading={props.submitting}
            width={480}
          >
            {props.selectedUser && (
              <div style={{ marginBottom: spacing.md }}>
                <Text>
                  用户: <Text strong>{props.selectedUser.name || props.selectedUser.username}</Text> (
                  {props.selectedUser.username})
                </Text>
              </div>
            )}
            <Form form={props.changePwForm} layout="vertical">
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 8, message: '密码至少8个字符' },
                ]}
              >
                <Input.Password placeholder="至少8个字符" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="再次输入新密码" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Detail Drawer */}
          <Drawer
            title={
              props.selectedUser
                ? `${props.selectedUser.name || props.selectedUser.username} (${props.selectedUser.username})`
                : '用户详情'
            }
            open={props.detailDrawerVisible}
            onClose={() => props.setDetailDrawerVisible(false)}
            width={720}
            destroyOnClose
          >
            {props.detailItems}
            <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing.sm }}>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  props.setDetailDrawerVisible(false);
                  if (props.selectedUser) props.openEdit(props.selectedUser);
                }}
              >
                编辑
              </Button>
              {props.selectedUser && props.selectedUser.status === 'active' && (
                <Popconfirm title="确认禁用?" onConfirm={() => props.handleDisable(props.selectedUser.id)}>
                  <Button danger icon={<LockOutlined />}>
                    禁用
                  </Button>
                </Popconfirm>
              )}
              {props.selectedUser &&
                props.selectedUser.status !== 'active' &&
                props.selectedUser.status !== 'deleted' && (
                  <Popconfirm title="确认启用?" onConfirm={() => props.handleEnable(props.selectedUser.id)}>
                    <Button icon={<UnlockOutlined />}>启用</Button>
                  </Popconfirm>
                )}
            </div>
          </Drawer>
  </>
);
