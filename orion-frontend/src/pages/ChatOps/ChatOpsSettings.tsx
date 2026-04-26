/**
 * ChatOps Settings - Platform config (dingtalk/wecom/feishu), webhook URLs
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Card, Form, Input, Switch, Select, message } from 'antd';
import { SaveOutlined, LinkOutlined } from '@ant-design/icons';
import { getChatOpsSettings, updateChatOpsSettings } from '@/api/chatops';

const { Title, Text } = Typography;

const ChatOpsSettings: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [platforms] = useState<{ name: string; enabled: boolean; webhook: string; token: string }[]>([
    { name: 'dingtalk', enabled: true, webhook: '', token: '' },
    { name: 'wecom', enabled: false, webhook: '', token: '' },
    { name: 'feishu', enabled: false, webhook: '', token: '' },
    { name: 'slack', enabled: false, webhook: '', token: '' },
  ]);

  const loadSettings = async () => {
    try {
      const res = await getChatOpsSettings();
      const data = (res as any).data?.data;
      if (data) form.setFieldsValue(data);
    } catch {
      // Use defaults
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await updateChatOpsSettings(values);
      message.success('设置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
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
        <Title level={3} style={{ margin: 0 }}>设置</Title>
        <Text type="secondary">ChatOps 平台配置与 Webhook 管理</Text>
      </div>

      <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
        {platforms.map((platform, index) => (
          <Card
            key={platform.name}
            title={<Space><LinkOutlined />{platformLabels[platform.name]}</Space>}
            style={{ marginBottom: 16 }}
            extra={
              <Form.Item name={['platforms', index, 'enabled']} valuePropName="checked" initialValue={platform.enabled}>
                <Switch size="small" />
              </Form.Item>
            }
          >
            <Form.Item name={['platforms', index, 'webhook']} label="Webhook URL">
              <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
            </Form.Item>
            <Form.Item name={['platforms', index, 'token']} label="Access Token">
              <Input.Password placeholder="输入访问令牌" />
            </Form.Item>
          </Card>
        ))}

        <Card title="全局设置" style={{ marginBottom: 16 }}>
          <Form.Item name="defaultPlatform" label="默认平台" initialValue="dingtalk">
            <Select options={[
              { label: '钉钉', value: 'dingtalk' },
              { label: '企业微信', value: 'wecom' },
              { label: '飞书', value: 'feishu' },
              { label: 'Slack', value: 'slack' },
            ]} />
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
    </div>
  );
};

export default ChatOpsSettings;
