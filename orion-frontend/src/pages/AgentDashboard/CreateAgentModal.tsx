/**
 * CreateAgentModal - Modal for creating a new Agent Profile
 */
import React, { useState } from 'react';
import { Modal, Form, Input, Select, Switch, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { createAgentProfile } from '@/api/agents';
import { ROLE_OPTIONS } from './constants';

interface CreateAgentModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);

      const toolsStr = values.tools || '[]';
      let tools: Array<{ toolName: string; permission: string; config?: Record<string, unknown> }> = [];
      try {
        tools = JSON.parse(toolsStr);
      } catch {
        message.error('工具配置必须是有效的 JSON 数组');
        setCreating(false);
        return;
      }

      await createAgentProfile({
        name: values.name,
        role: values.role,
        description: values.description,
        tools,
        enabled: values.enabled ?? true,
        capabilities: values.capabilities ? JSON.parse(values.capabilities) : undefined,
        constraints: values.constraints ? JSON.parse(values.constraints) : undefined,
        llmConfig: values.llmModel
          ? {
              model: values.llmModel,
              temperature: values.temperature ? parseFloat(values.temperature) : undefined,
              maxTokens: values.maxTokens ? parseInt(values.maxTokens, 10) : undefined,
            }
          : undefined,
      });

      message.success(`Agent ${values.name} 创建成功`);
      form.resetFields();
      setCreating(false);
      onSuccess();
    } catch (err: unknown) {
      setCreating(false);
      if (err instanceof Error && 'errorFields' in err) return;
      const message_text = err instanceof Error ? err.message : 'Unknown error';
      message.error(`创建失败：${message_text}`);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <PlusOutlined />
          创建 Agent Profile
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleCreate}
      confirmLoading={creating}
      okText="创建"
      cancelText="取消"
      width={700}
      data-testid="create-agent-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="Agent 名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="例如：BugFixer-v1" />
        </Form.Item>

        <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
          <Select placeholder="选择 Agent 角色" options={ROLE_OPTIONS} />
        </Form.Item>

        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} placeholder="Agent 的描述信息" />
        </Form.Item>

        <Form.Item label="工具集 (JSON 数组)" name="tools" rules={[{ required: true, message: '请配置工具集' }]}>
          <Input.TextArea
            rows={3}
            placeholder='[{"toolName": "git_read", "permission": "read"}]'
          />
        </Form.Item>

        <Form.Item label="LLM 模型" name="llmModel">
          <Select placeholder="选择模型" allowClear>
            <Select.Option value="gpt-4">GPT-4</Select.Option>
            <Select.Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Select.Option>
            <Select.Option value="claude-3-opus">Claude 3 Opus</Select.Option>
            <Select.Option value="claude-3-sonnet">Claude 3 Sonnet</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Temperature" name="temperature">
          <Input type="number" placeholder="0.0 - 1.0" />
        </Form.Item>

        <Form.Item label="Max Tokens" name="maxTokens">
          <Input type="number" placeholder="4096" />
        </Form.Item>

        <Form.Item label="能力配置 (JSON)" name="capabilities">
          <Input.TextArea rows={2} placeholder='{"maxSteps": 20, "timeoutSec": 3600, "retryCount": 3}' />
        </Form.Item>

        <Form.Item label="约束配置 (JSON)" name="constraints">
          <Input.TextArea rows={2} placeholder='{"maxTokens": 8192, "allowedBranches": ["main", "develop"]}' />
        </Form.Item>

        <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateAgentModal;
