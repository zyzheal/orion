/**
 * DequeueModal.tsx - 任务出队弹窗
 * 抽取自 Queue/index.tsx (P2-9 Phase 87)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { QUEUE_NAME_OPTIONS } from '../constants';

interface DequeueModalProps {
  open: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const DequeueModal: React.FC<DequeueModalProps> = ({ open, form, submitting, onCancel, onOk }) => (
  <Modal
    title="任务出队"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={480}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="queueName"
        label="队列名称"
        rules={[{ required: true, message: '请选择队列名称' }]}
      >
        <Select placeholder="选择队列" options={QUEUE_NAME_OPTIONS} />
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
