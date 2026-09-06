/**
 * EnqueueModal - 任务入队弹窗
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { QUEUE_OPTIONS } from '../constants';
import type { QueueState } from '../useQueueState';

interface EnqueueModalProps {
  state: QueueState;
}

export const EnqueueModal: React.FC<EnqueueModalProps> = ({ state }) => (
  <Modal
    title="任务入队"
    open={state.enqueueModalVisible}
    onCancel={() => state.setEnqueueModalVisible(false)}
    onOk={state.handleEnqueue}
    confirmLoading={state.submitting}
    width={560}
    destroyOnClose
  >
    <Form form={state.enqueueForm} layout="vertical">
      <Form.Item
        name="queueName"
        label="队列名称"
        rules={[{ required: true, message: '请输入队列名称' }]}
      >
        <Select
          placeholder="选择或输入队列名称"
          options={QUEUE_OPTIONS}
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
            validator: (_, value) => {
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
