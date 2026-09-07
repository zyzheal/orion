/**
 * RiskDashboard assess modal
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
import React from 'react';
import { Form, Input, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { RiskAssessmentInput } from '@/api/risk';

const { TextArea } = Input;

interface AssessModalProps {
  open: boolean;
  form: FormInstance<RiskAssessmentInput>;
  onCancel: () => void;
  onOk: () => void;
  onFinish: (values: RiskAssessmentInput) => Promise<void>;
}

export const AssessModal: React.FC<AssessModalProps> = ({
  open,
  form,
  onCancel,
  onOk,
  onFinish,
}) => (
  <Modal title="风险评估" open={open} onCancel={onCancel} onOk={onOk} width={600}>
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item label="目标类型" name="targetType" rules={[{ required: true }]}>
        <Select>
          <Select.Option value="deployment">部署</Select.Option>
          <Select.Option value="change">变更</Select.Option>
          <Select.Option value="pipeline">流水线</Select.Option>
          <Select.Option value="infrastructure">基础设施</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item label="目标 ID" name="targetId" rules={[{ required: true }]}>
        <Input placeholder="例如：deploy-123" />
      </Form.Item>
      <Form.Item label="元数据 (JSON)" name="metadata">
        <TextArea rows={4} placeholder='{"key": "value"}' />
      </Form.Item>
    </Form>
  </Modal>
);
