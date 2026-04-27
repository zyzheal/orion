/**
 * TriggerRunModal - Modal for triggering an agent run
 */
import React, { useState } from 'react';
import { Modal, Form, Input, Select, Space, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { triggerAgentRun } from '@/api/agents';
import { TRIGGER_EVENT_OPTIONS } from './constants';

interface TriggerRunModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const TriggerRunModal: React.FC<TriggerRunModalProps> = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [triggering, setTriggering] = useState(false);

  const handleTrigger = async () => {
    try {
      const values = await form.validateFields();
      setTriggering(true);

      let payload: Record<string, unknown> = {};
      if (values.payload) {
        try {
          payload = JSON.parse(values.payload);
        } catch {
          message.error('触发载荷必须是有效的 JSON');
          setTriggering(false);
          return;
        }
      }

      await triggerAgentRun({
        workflowId: values.workflowId || undefined,
        triggerEvent: values.triggerEvent,
        triggerPayload: payload,
      });

      message.success('Agent 运行已触发');
      form.resetFields();
      setTriggering(false);
      onSuccess();
    } catch (err: unknown) {
      setTriggering(false);
      if (err instanceof Error && 'errorFields' in err) return;
      const message_text = err instanceof Error ? err.message : 'Unknown error';
      message.error(`触发失败：${message_text}`);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <PlayCircleOutlined />
          触发 Agent 运行
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleTrigger}
      confirmLoading={triggering}
      okText="触发"
      cancelText="取消"
      width={600}
      data-testid="trigger-run-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="触发事件" name="triggerEvent" rules={[{ required: true, message: '请选择触发事件' }]}>
          <Select placeholder="选择触发事件" options={TRIGGER_EVENT_OPTIONS} />
        </Form.Item>

        <Form.Item label="工作流 ID" name="workflowId">
          <Input placeholder="可选，指定工作流" />
        </Form.Item>

        <Form.Item label="触发载荷 (JSON)" name="payload">
          <Input.TextArea rows={6} placeholder='{"issue_id": "123", "repo": "org/repo"}' />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TriggerRunModal;
