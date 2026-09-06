/**
 * WaiveModal.tsx - 申请豁免 Modal
 * 抽取自 quality-gate/QualityGatePage.tsx (P2-9 Phase 77)
 */
import React from 'react';
import { Modal, Form, Input, Select, Descriptions } from 'antd';
import type { FormInstance } from 'antd';
import type { PolicyViolation } from '@/api/policies';
import { spacing } from '@/tokens';

interface WaiveModalProps {
  visible: boolean;
  form: FormInstance;
  selectedViolation: PolicyViolation | null;
  submitting: boolean;
  onOk: () => void;
  onCancel: () => void;
}

export const WaiveModal: React.FC<WaiveModalProps> = ({
  visible,
  form,
  selectedViolation,
  submitting,
  onOk,
  onCancel,
}) => {
  return (
    <Modal
      title="申请豁免"
      open={visible}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      destroyOnClose
    >
      {selectedViolation && (
        <div style={{ marginBottom: spacing.md }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="策略">{selectedViolation.policyName}</Descriptions.Item>
            <Descriptions.Item label="违规消息">{selectedViolation.message}</Descriptions.Item>
          </Descriptions>
        </div>
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label="豁免原因"
          rules={[{ required: true, message: '请输入豁免原因' }]}
        >
          <Input.TextArea rows={3} placeholder="请说明豁免原因..." />
        </Form.Item>
        <Form.Item
          name="expiresAt"
          label="豁免有效期"
          rules={[{ required: true, message: '请选择有效期' }]}
        >
          <Input placeholder="如: 2026-06-01T00:00:00Z" />
        </Form.Item>
        <Form.Item name="scope" label="豁免范围">
          <Select
            options={[
              { label: '项目级', value: 'project' },
              { label: '全局', value: 'global' },
              { label: '环境级', value: 'environment' },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
