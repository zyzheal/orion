/**
 * DequeueModal - 任务出队弹窗
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { QUEUE_OPTIONS } from '../constants';
import type { QueueState } from '../useQueueState';

interface DequeueModalProps {
  state: QueueState;
}

export const DequeueModal: React.FC<DequeueModalProps> = ({ state }) => (
  <Modal
    title="任务出队"
    open={state.dequeueModalVisible}
    onCancel={() => state.setDequeueModalVisible(false)}
    onOk={state.handleDequeue}
    confirmLoading={state.submitting}
    width={480}
    destroyOnClose
  >
    <Form form={state.dequeueForm} layout="vertical">
      <Form.Item
        name="queueName"
        label="队列名称"
        rules={[{ required: true, message: '请选择队列名称' }]}
      >
        <Select placeholder="选择队列" options={QUEUE_OPTIONS} />
      </Form.Item>
      <Form.Item
        name="limit"
        label="出队数量"
        rules={[{ required: true, message: '请输入出队数量' }]}
        initialValue="1"
      >
        <Input type="number" min={1} max={100} placeholder="1" />
      </Form.Item>
    </Form>
  </Modal>
);
