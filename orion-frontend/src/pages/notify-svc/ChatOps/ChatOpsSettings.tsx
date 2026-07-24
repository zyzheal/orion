/**
 * ChatOps Settings - Platform config, notification preferences, DND settings,
 * and configurable question cards & commands
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
  Tabs,
  Tag,
} from 'antd';
import {
  SaveOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  CodeOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
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
import { useChatOpsConfigStore } from '@/stores/chatOpsConfigStore';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

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

// 可用图标列表
const AVAILABLE_ICONS = [
  'RocketOutlined', 'BarChartOutlined', 'BugOutlined', 'CloudServerOutlined',
  'SecurityScanOutlined', 'SettingOutlined', 'DashboardOutlined', 'SearchOutlined',
  'FileTextOutlined', 'BulbOutlined', 'ThunderboltOutlined', 'WarningOutlined',
  'InfoCircleOutlined', 'ClockCircleOutlined', 'PlayCircleOutlined', 'CloseOutlined',
];

// ============================================================================
// 问答卡片配置 Tab
// ============================================================================
const QuestionConfigTab: React.FC = () => {
  const { questions, updateQuestion, addQuestion, removeQuestion, saveConfig, resetToDefault } = useChatOpsConfigStore();

  const handleSave = () => {
    saveConfig();
    message.success('问答卡片配置已保存');
  };

  const handleReset = () => {
    resetToDefault();
    message.info('已恢复默认配置');
  };

  const handleAdd = () => {
    const key = `custom-${Date.now()}`;
    addQuestion({
      key,
      icon: 'BulbOutlined',
      title: '新卡片',
      desc: '描述',
      question: '输入你的问题...',
      enabled: true,
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text type="secondary">配置 ChatOps 启动时展示的问答卡片</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>恢复默认</Button>
          <Button icon={<PlusOutlined />} onClick={handleAdd}>添加卡片</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存配置</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
        {questions.map((q) => (
          <Card
            key={q.key}
            size="small"
            style={{
              opacity: q.enabled ? 1 : 0.5,
              borderLeft: `3px solid ${q.enabled ? colors.primary[500] : colors.neutral[300]}`,
            }}
            extra={
              <Space>
                <Switch
                  size="small"
                  checked={q.enabled}
                  onChange={(checked) => updateQuestion(q.key, { enabled: checked })}
                />
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeQuestion(q.key)}
                />
              </Space>
            }
          >
            <div style={{ display: 'flex', gap: spacing[3], flexWrap: 'wrap' }}>
              <Input
                value={q.title}
                onChange={(e) => updateQuestion(q.key, { title: e.target.value })}
                placeholder="标题"
                style={{ width: 120 }}
                size="small"
              />
              <Input
                value={q.desc}
                onChange={(e) => updateQuestion(q.key, { desc: e.target.value })}
                placeholder="描述"
                style={{ width: 160 }}
                size="small"
              />
              <Input
                value={q.question}
                onChange={(e) => updateQuestion(q.key, { question: e.target.value })}
                placeholder="问题内容"
                style={{ flex: 1, minWidth: 200 }}
                size="small"
              />
              <Select
                value={q.icon}
                onChange={(v) => updateQuestion(q.key, { icon: v })}
                style={{ width: 160 }}
                size="small"
                options={AVAILABLE_ICONS.map((icon) => ({ label: icon.replace('Outlined', '').replace('Icon', ''), value: icon }))}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 命令配置 Tab
// ============================================================================
const CommandConfigTab: React.FC = () => {
  const { commands, updateCommand, addCommand, removeCommand, saveConfig, resetToDefault } = useChatOpsConfigStore();

  const handleSave = () => {
    saveConfig();
    message.success('命令配置已保存');
  };

  const handleReset = () => {
    resetToDefault();
    message.info('已恢复默认配置');
  };

  const handleAdd = () => {
    const key = `cmd-${Date.now()}`;
    addCommand({
      key,
      label: '新命令',
      command: '/command args=xxx',
      enabled: true,
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text type="secondary">配置 ChatOps 底部快捷命令</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>恢复默认</Button>
          <Button icon={<PlusOutlined />} onClick={handleAdd}>添加命令</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存配置</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        {commands.map((cmd) => (
          <Card
            key={cmd.key}
            size="small"
            style={{
              opacity: cmd.enabled ? 1 : 0.5,
              borderLeft: `3px solid ${cmd.enabled ? colors.primary[500] : colors.neutral[300]}`,
            }}
            extra={
              <Space>
                <Switch
                  size="small"
                  checked={cmd.enabled}
                  onChange={(checked) => updateCommand(cmd.key, { enabled: checked })}
                />
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeCommand(cmd.key)}
                />
              </Space>
            }
          >
            <div style={{ display: 'flex', gap: spacing[3] }}>
              <Input
                value={cmd.label}
                onChange={(e) => updateCommand(cmd.key, { label: e.target.value })}
                placeholder="命令标签"
                style={{ width: 120 }}
                size="small"
              />
              <Input
                value={cmd.command}
                onChange={(e) => updateCommand(cmd.key, { command: e.target.value })}
                placeholder="命令内容"
                style={{ flex: 1 }}
                size="small"
                prefix={<CodeOutlined style={{ color: colors.neutral[500] }} />}
              />
              <Tag>{cmd.key}</Tag>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Platform Config Tab (原有内容)
// ============================================================================
const PlatformConfigTab: React.FC = () => {
  const [platformSaving, setPlatformSaving] = useState(false);
  const [platformForm] = Form.useForm();
  const [platforms, setPlatforms] = useState<PlatformConfig[]>(DEFAULT_PLATFORMS);

  const loadPlatformConfigs = async () => {
    try {
      const res = await getPlatformConfigs();
      const data = (res as { data?: { data?: PlatformConfig[] } })?.data?.data as PlatformConfig[];
      if (data && data.length > 0) {
        setPlatforms(data);
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
    loadPlatformConfigs();
  }, []);

  const handlePlatformSave = async () => {
    try {
      const values = await platformForm.validateFields();
      setPlatformSaving(true);
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
    <div>
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
            style={{ marginBottom: spacing.md }}
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
    </div>
  );
};

// ============================================================================
// 通知与免打扰 Tab
// ============================================================================
const NotificationDNDTab: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [dndForm] = Form.useForm();
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndSaving, setDndSaving] = useState(false);

  const loadSettings = async () => {
    try {
      const res = await getNotificationPreferences();
      const data = (res as { data?: { data?: Record<string, unknown> } })?.data?.data;
      if (data) form.setFieldsValue(data);
    } catch {
      // Use defaults
    }
  };

  const loadDNDSettings = async () => {
    try {
      const res = await getDNDSettings();
      const data = (res as { data?: { data?: DNDSettings | null } })?.data?.data as DNDSettings | null;
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

  useEffect(() => {
    loadSettings();
    loadDNDSettings();
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {/* 全局设置 */}
      <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
        <Card title="全局设置" style={{ marginBottom: spacing.md }}>
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

// ============================================================================
// Main Settings Component
// ============================================================================
const ChatOpsSettings: React.FC = () => {
  return (
    <div style={{ padding: '0 0 16px' }}>
      <Tabs
        defaultActiveKey="questions"
        items={[
          {
            key: 'questions',
            label: (
              <span>
                <QuestionCircleOutlined /> 问答卡片
              </span>
            ),
            children: <QuestionConfigTab />,
          },
          {
            key: 'commands',
            label: (
              <span>
                <CodeOutlined /> 命令配置
              </span>
            ),
            children: <CommandConfigTab />,
          },
          {
            key: 'platforms',
            label: (
              <span>
                <LinkOutlined /> 平台配置
              </span>
            ),
            children: <PlatformConfigTab />,
          },
          {
            key: 'notifications',
            label: '通知与免打扰',
            children: <NotificationDNDTab />,
          },
        ]}
      />
    </div>
  );
};

export default ChatOpsSettings;
