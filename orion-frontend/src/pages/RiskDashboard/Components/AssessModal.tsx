/**
 * AssessModal - 风险评估弹窗
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import { Modal, Form, Select, Input } from 'antd';
import type { RiskDashboardState } from '../useRiskDashboardState';

const { TextArea } = Input;

interface AssessModalProps {
  state: RiskDashboardState;
}

export const AssessModal: React.FC<AssessModalProps> = ({ state }) => {
  const { assessModalOpen, form, setAssessModalOpen, handleAssess } = state;

  return (
    <Modal
      title="风险评估"
      open={assessModalOpen}
      onCancel={() => setAssessModalOpen(false)}
      onOk={() => form.submit()}
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={handleAssess}>
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
};
