/**
 * NotificationCenter broadcast modal (admin only)
 * 抽取自 index.tsx (P2-9 Phase 159)
 */
import { Form, Input, Modal, Select, Space } from 'antd';
import { SoundOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';

export interface UserItem {
  id: string;
  name?: string | null;
  username?: string;
}

interface BroadcastModalProps {
  open: boolean;
  form: FormInstance;
  submitting: boolean;
  audience: string;
  selectedUsers: string[];
  availableUsers: UserItem[];
  usersLoading: boolean;
  onOk: () => void;
  onCancel: () => void;
  onAudienceChange: (val: string) => void;
  onSelectedUsersChange: (ids: string[]) => void;
}

export const BroadcastModal = ({
  open,
  form,
  submitting,
  audience,
  selectedUsers,
  availableUsers,
  usersLoading,
  onOk,
  onCancel,
  onAudienceChange,
  onSelectedUsersChange,
}: BroadcastModalProps) => (
  <Modal
    title={
      <Space>
        <SoundOutlined /> 广播通知
      </Space>
    }
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={560}
    destroyOnClose
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="title"
        label="标题"
        rules={[{ required: true, message: '请输入广播标题' }]}
      >
        <Input placeholder="如: 系统维护通知" />
      </Form.Item>
      <Form.Item
        name="message"
        label="消息内容"
        rules={[{ required: true, message: '请输入消息内容' }]}
      >
        <Input.TextArea rows={4} placeholder="请输入广播消息内容..." />
      </Form.Item>
      <Form.Item label="目标受众" initialValue="all">
        <Select
          value={audience}
          onChange={onAudienceChange}
          options={[
            { label: '全体用户', value: 'all' },
            { label: '指定用户', value: 'specific' },
          ]}
        />
      </Form.Item>
      {audience === 'specific' && (
        <Form.Item label="选择用户">
          <Select
            mode="multiple"
            loading={usersLoading}
            value={selectedUsers}
            onChange={onSelectedUsersChange}
            options={availableUsers.map((u) => ({
              label: u.name || u.username,
              value: u.id,
            }))}
            placeholder="搜索并选择用户"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
      )}
      <Form.Item name="priority" label="优先级" initialValue="medium">
        <Select
          options={[
            { label: '紧急', value: 'critical' },
            { label: '高', value: 'high' },
            { label: '中', value: 'medium' },
            { label: '低', value: 'low' },
          ]}
        />
      </Form.Item>
    </Form>
  </Modal>
);
