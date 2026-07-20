import React from 'react';
import { Card, Form, Input, InputNumber, Select, Button, Space, message } from 'antd';
import { colors, spacing } from '@/tokens';

export interface StepConfigurationPanelProps {
  plugin: { name: string; version: string; tier: string; trust: string } | null;
  onSave: (config: Record<string, unknown>) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export const StepConfigurationPanel: React.FC<StepConfigurationPanelProps> = ({
  plugin,
  onSave,
  onDelete,
  onCancel,
}) => {
  const [form] = Form.useForm();

  if (!plugin) {
    return <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[500] }}>Select a plugin to configure</div>;
  }

  const handleSave = () => {
    form.validateFields().then((values) => {
      onSave(values);
      message.success('Step configuration saved');
    });
  };

  const handleTest = () => {
    message.info('Test step execution coming soon');
  };

  return (
    <Card title={`Step Configuration: ${plugin.name}`} size="small">
      <div style={{ marginBottom: spacing.md }}>
        <span>Plugin: </span><strong>{plugin.name}</strong> v{plugin.version}
        <br />
        <span>Tier: </span>{plugin.tier}
        <span style={{ marginLeft: spacing.md }}>Trust: </span>{plugin.trust}
      </div>

      <Form form={form} layout="vertical" initialValues={{ timeout: 300, retryMax: 2 }}>
        <Form.Item label="Configuration" name="config">
          <Input.TextArea rows={3} placeholder="key: value pairs" />
        </Form.Item>

        <Form.Item label="Timeout (seconds)" name="timeout">
          <InputNumber min={10} max={3600} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="Retry Policy" name="retryPolicy">
          <Select defaultValue="exponential">
            <Select.Option value="none">None</Select.Option>
            <Select.Option value="fixed">Fixed Delay</Select.Option>
            <Select.Option value="exponential">Exponential Backoff</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Max Retries" name="retryMax">
          <InputNumber min={0} max={5} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="Condition" name="condition">
          <Select defaultValue="always">
            <Select.Option value="always">Always Execute</Select.Option>
            <Select.Option value="on-success">On Previous Success</Select.Option>
            <Select.Option value="on-failure">On Previous Failure</Select.Option>
          </Select>
        </Form.Item>
      </Form>

      <Space>
        <Button onClick={handleTest}>Test Step</Button>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={handleSave}>Save</Button>
        <Button danger onClick={onDelete}>Delete</Button>
      </Space>
    </Card>
  );
};

export default StepConfigurationPanel;
