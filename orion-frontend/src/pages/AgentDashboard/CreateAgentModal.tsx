/**
 * CreateAgentModal - Modal for creating or editing an Agent Profile
 */
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Space, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { createAgentProfile, updateAgentProfile, type AgentProfile } from '@/api/agents';
import { ROLE_OPTIONS } from './constants';
import { spacing } from '@/tokens';

interface CreateAgentModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  agent?: AgentProfile | null; // 当提供时进入编辑模式
}

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ open, onCancel, onSuccess, agent }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const isEdit = !!agent;

  useEffect(() => {
    if (open && agent) {
      form.setFieldsValue({
        name: agent.name,
        role: agent.role,
        description: agent.description,
        tools: JSON.stringify(agent.tools ?? [], null, 2),
        llmModel: agent.llmConfig?.model,
        temperature: agent.llmConfig?.temperature?.toString(),
        maxTokens: agent.llmConfig?.maxTokens?.toString(),
        capabilities: agent.capabilities ? JSON.stringify(agent.capabilities, null, 2) : undefined,
        constraints: agent.constraints ? JSON.stringify(agent.constraints, null, 2) : undefined,
        enabled: agent.enabled,
      });
    } else if (open && !agent) {
      form.resetFields();
      form.setFieldsValue({ enabled: true });
    }
  }, [open, agent, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const toolsStr = values.tools || '[]';
      let tools: Array<{ toolName: string; permission: string; config?: Record<string, unknown> }> = [];
      try {
        tools = JSON.parse(toolsStr);
      } catch {
        message.error('工具配置必须是有效的 JSON 数组');
        setSaving(false);
        return;
      }

      let capabilities: Record<string, unknown> | undefined;
      if (values.capabilities) {
        try {
          capabilities = JSON.parse(values.capabilities);
        } catch {
          message.error('能力配置必须是有效的 JSON');
          setSaving(false);
          return;
        }
      }

      let constraints: Record<string, unknown> | undefined;
      if (values.constraints) {
        try {
          constraints = JSON.parse(values.constraints);
        } catch {
          message.error('约束配置必须是有效的 JSON');
          setSaving(false);
          return;
        }
      }

      if (isEdit && agent) {
        await updateAgentProfile(agent.id, {
          name: values.name,
          role: values.role,
          description: values.description,
          tools,
          enabled: values.enabled ?? true,
          capabilities,
          constraints,
          llmConfig: values.llmModel
            ? {
                model: values.llmModel,
                temperature: values.temperature ? parseFloat(values.temperature) : undefined,
                maxTokens: values.maxTokens ? parseInt(values.maxTokens, 10) : undefined,
              }
            : undefined,
        });
        message.success(`Agent ${values.name} 更新成功`);
      } else {
        await createAgentProfile({
          name: values.name,
          role: values.role,
          description: values.description,
          tools,
          enabled: values.enabled ?? true,
          capabilities,
          constraints,
          llmConfig: values.llmModel
            ? {
                model: values.llmModel,
                temperature: values.temperature ? parseFloat(values.temperature) : undefined,
                maxTokens: values.maxTokens ? parseInt(values.maxTokens, 10) : undefined,
              }
            : undefined,
        });
        message.success(`Agent ${values.name} 创建成功`);
      }

      form.resetFields();
      setSaving(false);
      onSuccess();
    } catch (err: unknown) {
      setSaving(false);
      if (err instanceof Error && 'errorFields' in err) return;
      const message_text = err instanceof Error ? err.message : 'Unknown error';
      message.error(`${isEdit ? '更新' : '创建'}失败：${message_text}`);
    }
  };

  return (
    <Modal
      title={
        <Space>
          {isEdit ? <EditOutlined /> : <PlusOutlined />}
          {isEdit ? '编辑 Agent Profile' : '创建 Agent Profile'}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleSave}
      confirmLoading={saving}
      okText={isEdit ? '保存' : '创建'}
      cancelText="取消"
      width={700}
      data-testid={isEdit ? 'edit-agent-modal' : 'create-agent-modal'}
    >
      <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item
          label="Agent 名称"
          name="name"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input placeholder="例如：BugFixer-v1" />
        </Form.Item>

        <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
          <Select placeholder="选择 Agent 角色" options={ROLE_OPTIONS} />
        </Form.Item>

        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} placeholder="Agent 的描述信息" />
        </Form.Item>

        <Form.Item
          label="工具集 (JSON 数组)"
          name="tools"
          rules={[{ required: true, message: '请配置工具集' }]}
        >
          <Input.TextArea rows={3} placeholder='[{"toolName": "git_read", "permission": "read"}]' />
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
          <Input.TextArea
            rows={2}
            placeholder='{"maxSteps": 20, "timeoutSec": 3600, "retryCount": 3}'
          />
        </Form.Item>

        <Form.Item label="约束配置 (JSON)" name="constraints">
          <Input.TextArea
            rows={2}
            placeholder='{"maxTokens": 8192, "allowedBranches": ["main", "develop"]}'
          />
        </Form.Item>

        <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue={true}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateAgentModal;
