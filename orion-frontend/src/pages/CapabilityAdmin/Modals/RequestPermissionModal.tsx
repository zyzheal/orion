/**
 * RequestPermissionModal.tsx - 申请权限弹窗
 * 抽取自 CapabilityAdmin/index.tsx (P2-9 Phase 86)
 */
import React from 'react';
import { Modal, Form, Input, Select, InputNumber } from 'antd';
import type { FormInstance } from 'antd';
import type { Capability } from '@/api/capability';

const { TextArea } = Input;

interface RequestPermissionModalProps {
  visible: boolean;
  form: FormInstance;
  capabilities: Capability[];
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}

export const RequestPermissionModal: React.FC<RequestPermissionModalProps> = ({
  visible,
  form,
  capabilities,
  onSubmit,
  onCancel,
}) => {
  return (
    <Modal title="申请权限" open={visible} onOk={onSubmit} onCancel={onCancel} width={500}>
      <Form form={form} layout="vertical">
        <Form.Item
          name="capability_id"
          label="能力标识"
          rules={[{ required: true, message: '请选择能力' }]}
        >
          <Select placeholder="选择要申请的能力" showSearch>
            {capabilities.map((cap) => (
              <Select.Option key={cap.capability_id} value={cap.capability_id}>
                {cap.name} ({cap.capability_id})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="environment_suffix" label="环境">
          <Input placeholder="如: prod, staging" />
        </Form.Item>

        <Form.Item
          name="duration_hours"
          label="申请时长（小时）"
          rules={[{ required: true, message: '请输入申请时长' }]}
        >
          <InputNumber min={1} max={720} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="reason"
          label="申请原因"
          rules={[{ required: true, message: '请输入申请原因' }]}
        >
          <TextArea rows={3} placeholder="请说明申请此权限的原因" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
