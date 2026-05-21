/**
 * Notification Settings - Channel preferences, DND schedule, auto-approve rules
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Card, Form, Switch, Select, Input, TimePicker, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/api/confirmations';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const channelOptions = [
  { label: '钉钉', value: 'dingtalk' },
  { label: '企业微信', value: 'wecom' },
  { label: '飞书', value: 'feishu' },
  { label: '邮件', value: 'email' },
  { label: '短信', value: 'sms' },
  { label: '站内通知', value: 'inapp' },
];

const NotificationSettingsPage: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [_settings, setSettings] = useState<Partial<NotificationSettings>>({
    channels: ['dingtalk', 'inapp'],
    dndStart: '22:00',
    dndEnd: '08:00',
    autoApproveP3: false,
    autoApproveAfterMinutes: 30,
  });

  const loadSettings = async () => {
    try {
      const res = await getNotificationSettings();
      const data = res.data.data || {};
      setSettings(data);
      form.setFieldsValue(data);
    } catch {
      message.error('Failed to load settings');
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await updateNotificationSettings({
        channels: values.channels,
        dndStart: values.dndStart?.format('HH:mm') || '22:00',
        dndEnd: values.dndEnd?.format('HH:mm') || '08:00',
        autoApproveP3: values.autoApproveP3,
        autoApproveAfterMinutes: values.autoApproveAfterMinutes,
      });
      message.success('设置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
            <SettingOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          通知设置
        </Title>
        <Text type="secondary">配置确认通知渠道和自动化规则</Text>
      </div>

      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Card title="通知渠道">
          <Form.Item name="channels" label="启用的通知渠道">
            <Select mode="multiple" options={channelOptions} placeholder="选择通知渠道" />
          </Form.Item>
          <Text type="secondary">选择接收确认通知的渠道，支持多选</Text>
        </Card>

        <Card title="免打扰时段" style={{ marginTop: 16 }}>
          <Form.Item name="dndStart" label="开始时间" initialValue={dayjs('22:00', 'HH:mm')}>
            <TimePicker format="HH:mm" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="dndEnd" label="结束时间" initialValue={dayjs('08:00', 'HH:mm')}>
            <TimePicker format="HH:mm" style={{ width: 120 }} />
          </Form.Item>
          <Text type="secondary">免打扰时段内不发送通知（P0 除外）</Text>
        </Card>

        <Card title="自动确认规则" style={{ marginTop: 16 }}>
          <Form.Item
            name="autoApproveP3"
            label="自动确认 P3 请求"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>
          <Form.Item name="autoApproveAfterMinutes" label="超时自动确认（分钟）" initialValue={30}>
            <Input type="number" style={{ width: 120 }} />
          </Form.Item>
          <Text type="secondary">开启后，P3 请求将在超时后自动确认</Text>
        </Card>

        <Form.Item style={{ marginTop: 24 }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存设置
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default NotificationSettingsPage;
