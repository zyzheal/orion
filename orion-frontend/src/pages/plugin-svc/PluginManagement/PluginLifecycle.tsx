/**
 * PluginLifecycle Modal Component
 * Execute plugin task with configuration (taskId, pipelineRunId, stageId, config, env, timeout)
 */
import React, { useState } from 'react';
import { Modal, Form, Input, Space, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { executePlugin, type PluginExecutionResult } from '@/api/plugins';
import { type ApiPlugin } from './types';

// ============================================================================
// Props
// ============================================================================

interface PluginLifecycleModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (result: PluginExecutionResult) => void;
  plugin: ApiPlugin | null;
}

// ============================================================================
// Component
// ============================================================================

const PluginLifecycleModal: React.FC<PluginLifecycleModalProps> = ({
  open,
  onCancel,
  onSuccess,
  plugin,
}) => {
  const [form] = Form.useForm();
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    try {
      const values = await form.validateFields();
      setExecuting(true);

      const response = await executePlugin(plugin!.id, {
        taskId: values.taskId,
        pipelineRunId: values.pipelineRunId,
        stageId: values.stageId,
        config: values.config ? JSON.parse(values.config) : undefined,
        env: values.env ? JSON.parse(values.env) : undefined,
        timeout: values.timeout ? parseInt(values.timeout, 10) : undefined,
      });

      message.success('任务执行成功');
      form.resetFields();
      setExecuting(false);
      onSuccess(response.data as unknown as PluginExecutionResult);
    } catch (err: unknown) {
      setExecuting(false);
      const msg = err instanceof Error ? err.message : '执行失败';
      message.error(`执行失败：${msg}`);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <PlayCircleOutlined />
          执行插件任务 - {plugin?.name}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleExecute}
      confirmLoading={executing}
      okText="执行"
      cancelText="取消"
      width={700}
      data-testid="execute-plugin-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          label="任务 ID"
          name="taskId"
          rules={[{ required: true, message: '请输入任务 ID' }]}
        >
          <Input placeholder="例如：task-001" />
        </Form.Item>

        <Form.Item label="流水线运行 ID" name="pipelineRunId" rules={[{ required: false }]}>
          <Input placeholder="可选，例如：run-123" />
        </Form.Item>

        <Form.Item label="阶段 ID" name="stageId" rules={[{ required: false }]}>
          <Input placeholder="可选，例如：stage-456" />
        </Form.Item>

        <Form.Item label="超时时间 (ms)" name="timeout" rules={[{ required: false }]}>
          <Input placeholder="默认 60000ms" type="number" />
        </Form.Item>

        <Form.Item label="配置 (JSON)" name="config" rules={[{ required: false }]}>
          <Input.TextArea rows={4} placeholder='{"key": "value"}' />
        </Form.Item>

        <Form.Item label="环境变量 (JSON)" name="env" rules={[{ required: false }]}>
          <Input.TextArea rows={4} placeholder='{"ENV": "production"}' />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PluginLifecycleModal;
