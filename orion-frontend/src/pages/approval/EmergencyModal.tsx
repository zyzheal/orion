/**
 * EmergencyModal - 紧急审批通道弹窗
 * 抽取自 ApprovalPage.tsx (P2-9 Phase 40)
 */
import React from 'react';
import type { FormInstance } from 'antd';
import { Modal, Alert, Form, Input, Select } from 'antd';
import { FireOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

export interface EmergencyModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: () => void;
  confirmLoading: boolean;
  form: FormInstance;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  visible,
  onCancel,
  onOk,
  confirmLoading,
  form,
}) => (
  <Modal
    title={
      <span>
        <FireOutlined style={{ color: colors.error[400], marginRight: spacing.sm }} />
        紧急审批通道
      </span>
    }
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={confirmLoading}
    width={600}
    destroyOnClose
  >
    <Alert
      message="紧急审批仅需 1 人审批即可通过，请确保情况属实"
      type="warning"
      showIcon
      style={{ marginBottom: spacing.md }}
    />
    <Form form={form} layout="vertical">
      <Form.Item name="title" label="审批标题" rules={[{ required: true }]}>
        <Input placeholder="紧急审批标题" />
      </Form.Item>
      <Form.Item name="description" label="紧急原因说明" rules={[{ required: true }]}>
        <Input.TextArea rows={3} placeholder="详细说明为什么需要紧急审批..." />
      </Form.Item>
      <Form.Item name="requesterId" label="申请人">
        <Input placeholder="申请人 ID" />
      </Form.Item>
      <Form.Item name="resourceType" label="资源类型" rules={[{ required: true }]}>
        <Select
          options={[
            { label: '紧急部署', value: 'emergency-deployment' },
            { label: '紧急回滚', value: 'emergency-rollback' },
            { label: '安全修复', value: 'security-fix' },
            { label: '基础设施', value: 'infrastructure' },
          ]}
        />
      </Form.Item>
      <Form.Item name="approverIds" label="审批人 (逗号分隔)" rules={[{ required: true }]}>
        <Input placeholder="如: on-call-lead" />
      </Form.Item>
    </Form>
  </Modal>
);
