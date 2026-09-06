/**
 * NotificationCenter - Sub-components
 *
 * Presents three pure view components consumed by `index.tsx`:
 * - `NotificationStatsRow`      top stat cards (unread / critical / today / week)
 * - `BroadcastModal`            admin broadcast form
 * - `NotificationSettingsDrawer` user notification preferences
 *
 * No state lives here; every value comes through props so `index.tsx` remains
 * the single source of truth.
 */
import React from 'react';
import {
  Typography,
  Row,
  Col,
  Card,
  Statistic,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Drawer,
  Divider,
  Spin,
  Empty,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  BellOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import type { NotificationSettings } from '@/api/notifications';
import type { User } from '@/api/users';
import {
  BROADCAST_AUDIENCE_OPTIONS,
  BROADCAST_PRIORITY_OPTIONS,
  channelSettingOptions,
  eventSettingOptions,
  type SettingsKey,
} from './config';
import type { NotificationStats } from './types';

const { Title, Text } = Typography;

// ============================================================================
// Stats row
// ============================================================================

export interface NotificationStatsRowProps {
  stats: NotificationStats;
}

export const NotificationStatsRow: React.FC<NotificationStatsRowProps> = ({ stats }) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col xs={12} sm={6}>
      <Card size="small" style={{ textAlign: 'center' }}>
        <Statistic
          title="未读"
          value={stats.unread}
          valueStyle={{
            color: stats.unread > 0 ? colors.error[500] : undefined,
            fontSize: spacing[6],
          }}
          prefix={<BellOutlined />}
        />
      </Card>
    </Col>
    <Col xs={12} sm={6}>
      <Card size="small" style={{ textAlign: 'center' }}>
        <Statistic
          title="紧急"
          value={stats.critical}
          valueStyle={{
            color: stats.critical > 0 ? colors.error[500] : undefined,
            fontSize: spacing[6],
          }}
          prefix={<ExclamationCircleOutlined />}
        />
      </Card>
    </Col>
    <Col xs={12} sm={6}>
      <Card size="small" style={{ textAlign: 'center' }}>
        <Statistic
          title="今日"
          value={stats.today}
          valueStyle={{ fontSize: spacing[6] }}
          prefix={<CheckCircleOutlined />}
        />
      </Card>
    </Col>
    <Col xs={12} sm={6}>
      <Card size="small" style={{ textAlign: 'center' }}>
        <Statistic
          title="本周"
          value={stats.thisWeek}
          valueStyle={{ fontSize: spacing[6] }}
          prefix={<BellOutlined />}
        />
      </Card>
    </Col>
  </Row>
);

// ============================================================================
// Broadcast modal (admin only)
// ============================================================================

export type BroadcastAudience = 'all' | 'specific';

export interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  form: ReturnType<typeof Form.useForm>[0];
  audience: BroadcastAudience;
  onAudienceChange: (audience: BroadcastAudience) => void;
  selectedUsers: string[];
  onSelectedUsersChange: (userIds: string[]) => void;
  availableUsers: User[];
  usersLoading: boolean;
  submitLoading: boolean;
  onSubmit: () => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  open,
  onClose,
  form,
  audience,
  onAudienceChange,
  selectedUsers,
  onSelectedUsersChange,
  availableUsers,
  usersLoading,
  submitLoading,
  onSubmit,
}) => (
  <Modal
    title={
      <Space>
        <SoundOutlined /> 广播通知
      </Space>
    }
    open={open}
    onCancel={onClose}
    onOk={onSubmit}
    confirmLoading={submitLoading}
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
          onChange={(val: BroadcastAudience) => {
            onAudienceChange(val);
            if (val === 'all') onSelectedUsersChange([]);
          }}
          options={BROADCAST_AUDIENCE_OPTIONS}
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
        <Select options={BROADCAST_PRIORITY_OPTIONS} />
      </Form.Item>
    </Form>
  </Modal>
);

// ============================================================================
// Notification settings drawer
// ============================================================================

export interface NotificationSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  saving: boolean;
  settings: NotificationSettings | null;
  onToggle: (key: SettingsKey) => void;
}

const SettingSwitchRow: React.FC<{
  label: string;
  checked: boolean;
  loading: boolean;
  onChange: () => void;
}> = ({ label, checked, loading, onChange }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing[3],
    }}
  >
    <Text>{label}</Text>
    <Switch checked={checked} onChange={onChange} loading={loading} />
  </div>
);

export const NotificationSettingsDrawer: React.FC<NotificationSettingsDrawerProps> = ({
  open,
  onClose,
  loading,
  saving,
  settings,
  onToggle,
}) => (
  <Drawer
    title={
      <Space>
        <SettingOutlined /> 通知设置
      </Space>
    }
    open={open}
    onClose={onClose}
    width={480}
    destroyOnClose
  >
    {loading ? (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spin size="large" />
      </div>
    ) : settings ? (
      <div>
        {/* Channel Settings */}
        <Title level={5}>通知渠道</Title>
        <div style={{ marginBottom: spacing.md }}>
          {channelSettingOptions.map((option) => (
            <SettingSwitchRow
              key={option.key}
              label={option.label}
              checked={settings[option.key]}
              loading={saving}
              onChange={() => onToggle(option.key)}
            />
          ))}
        </div>

        <Divider />

        {/* Event Type Settings */}
        <Title level={5}>通知类型</Title>
        <div>
          {eventSettingOptions.map((option) => (
            <SettingSwitchRow
              key={option.key}
              label={option.label}
              checked={settings[option.key]}
              loading={saving}
              onChange={() => onToggle(option.key)}
            />
          ))}
        </div>
      </div>
    ) : (
      <Empty description="无法加载通知设置" />
    )}
  </Drawer>
);
