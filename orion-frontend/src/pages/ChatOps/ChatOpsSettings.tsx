/**
 * ChatOps Settings - Platform config, notification preferences, DND settings
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Form,
  Input,
  Switch,
  Select,
  message,
  TimePicker,
  Checkbox,
} from 'antd';
import { SaveOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getDNDSettings,
  updateDNDSettings,
  toggleDND,
  getPlatformConfigs,
  updatePlatformConfigs,
  type DNDSettings,
  type PlatformConfig,
} from '@/api/chatops';

const { Title, Text } = Typography;

const WEEKDAYS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 },
];

const DEFAULT_PLATFORMS: PlatformConfig[] = [
  { platform: 'dingtalk', enabled: true, webhook: '', token: '' },
  { platform: 'wecom', enabled: false, webhook: '', token: '' },
  { platform: 'feishu', enabled: false, webhook: '', token: '' },
  { platform: 'slack', enabled: false, webhook: '', token: '' },
];

const ChatOpsSettings: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const [platformSaving, setPlatformSaving] = useState(false);
  const [form] = Form.useForm();
  const [dndForm] = Form.useForm();
  const [platformForm] = Form.useForm();
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndSaving, setDndSaving] = useState(false);
  const [platforms, setPlatforms] = useState<PlatformConfig[]>(DEFAULT_PLATFORMS);

  const loadSettings = async () => {
    try {
      const res = await getNotificationPreferences();
      const data = (res as any).data?.data;
      if (data) form.setFieldsValue(data);
    } catch {
      // Use defaults - optional settings load
    }
  };

  const loadDNDSettings = async () => {
    try {
      const res = await getDNDSettings();
      const data = (res as any).data?.data as DNDSettings | null;
      if (data) {
        setDndEnabled(data.enabled);
        dndForm.setFieldsValue({
          startTime: data.startTime ? dayjs(data.startTime, 'HH:mm') : undefined,
          endTime: data.endTime ? dayjs(data.endTime, 'HH:mm') : undefined,
          repeatDays: data.repeatDays || [1, 2, 3, 4, 5],
          allowCritical: data.allowCritical,
        });
      }
    } catch {
      // Use defaults
    }
  };

  const loadPlatformConfigs = async () => {
    try {
      const res = await getPlatformConfigs();
      const data = (res as any).data?.data as PlatformConfig[];
      if (data && data.length > 0) {
        setPlatforms(data);
        // 填充表单
        data.forEach((p, index) => {
          platformForm.setFieldsValue({
            [`platform_${index}_enabled`]: p.enabled,
            [`platform_${index}_webhook`]: p.webhook,
            [`platform_${index}_token`]: p.token,
          });
        });
      }
    } catch {
      // Use defaults
    }
  };

  useEffect(() => {
    loadSettings();
    loadDNDSettings();
    loadPlatformConfigs();
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await updateNotificationPreferences(values);
      message.success('设置已保存');
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '保存失败';
        message.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDNDSave = async () => {
    try {
      const values = await dndForm.validateFields();
      setDndSaving(true);
      await updateDNDSettings({
        enabled: dndEnabled,
        startTime: values.startTime ? values.startTime.format('HH:mm') : '22:00',
        endTime: values.endTime ? values.endTime.format('HH:mm') : '08:00',
        repeatDays: values.repeatDays || [1, 2, 3, 4, 5],
        allowCritical: values.allowCritical ?? true,
      });
      message.success('免打扰设置已保存');
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '保存失败';
        message.error(msg);
      }
    } finally {
      setDndSaving(false);
    }
  };

  const handleDNDToggle = async (checked: boolean) => {
    setDndEnabled(checked);
    try {
      await toggleDND(checked);
      message.success(checked ? '已开启免打扰' : '已关闭免打扰');
    } catch {
      // Toggle failure is non-critical
    }
  };

  const handlePlatformSave = async () => {
    try {
      const values = await platformForm.validateFields();
      setPlatformSaving(true);
      // 构造平台配置数组
      const configs: PlatformConfig[] = platforms.map((p, index) => ({
        platform: p.platform,
        enabled: values[`platform_${index}_enabled`] ?? false,
        webhook: values[`platform_${index}_webhook`] || '',
        token: values[`platform_${index}_token`] || '',
      }));
      await updatePlatformConfigs(configs);
      setPlatforms(configs);
      message.success('平台配置已保存');
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '保存失败';
        message.error(msg);
      }
    } finally {
      setPlatformSaving(false);
    }
  };

  const platformLabels: Record<string, string> = {
    dingtalk: '钉钉',
    wecom: '企业微信',
    feishu: '飞书',
    slack: 'Slack',
  };

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          设置
        </Title>
        <Text type="secondary">ChatOps 平台配置与 Webhook 管理</Text>
      </div>

      {/* 平台配置 */}
      <Form form={platformForm} layout="vertical" style={{ maxWidth: 700 }}>
        {platforms.map((platform, index) => (
          <Card
            key={platform.platform}
            title={
              <Space>
                <LinkOutlined />
                {platformLabels[platform.platform]}
              </Space>
            }
            style={{ marginBottom: 16 }}
            extra={
              <Form.Item
                name={`platform_${index}_enabled`}
                valuePropName="checked"
                initialValue={platform.enabled}
              >
                <Switch size="small" />
              </Form.Item>
            }
          >
            <Form.Item
              name={`platform_${index}_webhook`}
              label="Webhook URL"
              initialValue={platform.webhook}
            >
              <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
            </Form.Item>
            <Form.Item
              name={`platform_${index}_token`}
              label="Access Token"
              initialValue={platform.token}
            >
              <Input.Password placeholder="输入访问令牌" />
            </Form.Item>
          </Card>
        ))}

        <Form.Item>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handlePlatformSave}
            loading={platformSaving}
          >
            保存平台配置
          </Button>
        </Form.Item>
      </Form>

      {/* 全局设置 */}
      <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
        <Card title="全局设置" style={{ marginBottom: 16 }}>
          <Form.Item name="defaultPlatform" label="默认平台" initialValue="dingtalk">
            <Select
              options={[
                { label: '钉钉', value: 'dingtalk' },
                { label: '企业微信', value: 'wecom' },
                { label: '飞书', value: 'feishu' },
                { label: 'Slack', value: 'slack' },
              ]}
            />
          </Form.Item>
          <Form.Item name="commandPrefix" label="命令前缀" initialValue="/">
            <Input style={{ width: 80 }} />
          </Form.Item>
          <Form.Item name="timeoutSeconds" label="超时时间（秒）" initialValue={30}>
            <Input type="number" style={{ width: 120 }} />
          </Form.Item>
        </Card>

        <Form.Item>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存设置
          </Button>
        </Form.Item>
      </Form>

      {/* 免打扰设置 */}
      <Card
        title="免打扰 (DND)"
        style={{ maxWidth: 700 }}
        extra={<Switch checked={dndEnabled} onChange={handleDNDToggle} />}
      >
        <Form form={dndForm} layout="vertical">
          <Form.Item label="免打扰时段">
            <Space>
              <Form.Item name="startTime" noStyle>
                <TimePicker format="HH:mm" placeholder="开始时间" />
              </Form.Item>
              <Text>至</Text>
              <Form.Item name="endTime" noStyle>
                <TimePicker format="HH:mm" placeholder="结束时间" />
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item name="repeatDays" label="重复日期" initialValue={[1, 2, 3, 4, 5]}>
            <Checkbox.Group options={WEEKDAYS.map((d) => ({ label: d.label, value: d.value }))} />
          </Form.Item>

          <Form.Item name="allowCritical" valuePropName="checked" initialValue={true}>
            <Checkbox>允许紧急告警 (critical) 穿透</Checkbox>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleDNDSave}
              loading={dndSaving}
            >
              保存免打扰设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ChatOpsSettings;
