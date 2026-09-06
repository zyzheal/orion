/**
 * EnqueueModal.tsx - 任务入队弹窗
 * 抽取自 Queue/index.tsx (P2-9 Phase 87)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { QUEUE_NAME_OPTIONS } from '../constants';

interface EnqueueModalProps {
  open: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const EnqueueModal: React.FC<EnqueueModalProps> = ({ open, form, submitting, onCancel, onOk }) => (
  <Modal
    title="任务入队"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={560}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="queueName"
        label="队列名称"
        rules={[{ required: true, message: '请输入队列名称' }]}
      >
        <Select
          placeholder="选择或输入队列名称"
          options={QUEUE_NAME_OPTIONS}
          mode="tags"
          maxCount={1}
        />
      </Form.Item>
      <Form.Item
        name="tenantId"
        label="租户 ID"
        rules={[{ required: true, message: '请输入租户 ID' }]}
      >
        <Input placeholder="tenant-1" />
      </Form.Item>
      <Form.Item
        name="payload"
        label="Payload (JSON)"
        rules={[
          { required: true, message: '请输入 Payload' },
          {
            validator: (_: unknown, value: string) => {
              if (!value) return Promise.resolve();
              try {
                JSON.parse(value);
                return Promise.resolve();
              } catch {
                return Promise.reject(new Error('请输入有效的 JSON'));
              }
            },
          },
        ]}
      >
        <Input.TextArea
          rows={6}
          placeholder='{"pipelineId": "pipe-101", "action": "build"}'
          style={{ fontFamily: 'monospace' }}
        />
      </Form.Item>
    </Form>
  </Modal>
);
