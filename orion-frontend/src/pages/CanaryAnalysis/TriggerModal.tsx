/**
 * TriggerModal.tsx - 触发分析 Modal
 * 抽取自 CanaryAnalysis/index.tsx (P2-9 Phase 80)
 */
import React from 'react';
import { Modal, Form, Input } from 'antd';
import type { FormInstance } from 'antd';
import { type TriggerFormValues } from './types';

interface TriggerModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onOk: (values: TriggerFormValues) => void;
}

export const TriggerModal: React.FC<TriggerModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => (
  <Modal
    title="触发金丝雀分析"
    open={visible}
    onCancel={onCancel}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    okText="触发分析"
    cancelText="取消"
    destroyOnClose
  >
    <Form form={form} layout="vertical" onFinish={onOk}>
      <Form.Item name="deploymentId" label="部署 ID" rules={[{ required: true }]}>
        <Input placeholder="deployment-uuid" />
      </Form.Item>
      <Form.Item name="roundNumber" label="轮次" rules={[{ required: true }]} initialValue={1}>
        <Input type="number" min={1} />
      </Form.Item>
    </Form>
  </Modal>
);
