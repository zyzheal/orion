/**
 * GrantTemporaryModal.tsx - 授予临时权限弹窗
 * 抽取自 CapabilityAdmin/index.tsx (P2-9 Phase 86)
 */
import React from 'react';
import { Modal, Form, Input, Select, InputNumber } from 'antd';
import type { FormInstance } from 'antd';
import type { Capability } from '@/api/capability';

const { TextArea } = Input;

interface GrantTemporaryModalProps {
  visible: boolean;
  form: FormInstance;
  capabilities: Capability[];
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}

export const GrantTemporaryModal: React.FC<GrantTemporaryModalProps> = ({
  visible,
  form,
  capabilities,
  onSubmit,
  onCancel,
}) => {
  return (
    <Modal title="授予临时权限" open={visible} onOk={onSubmit} onCancel={onCancel} width={500}>
      <Form form={form} layout="vertical">
        <Form.Item
          name="user_id"
          label="用户 ID"
          rules={[{ required: true, message: '请输入用户 ID' }]}
        >
          <Input placeholder="输入要授予的用户 ID" />
        </Form.Item>

        <Form.Item
          name="capability_id"
          label="能力标识"
          rules={[{ required: true, message: '请选择能力' }]}
        >
          <Select placeholder="选择能力" showSearch>
            {capabilities.map((cap) => (
              <Select.Option key={cap.capability_id} value={cap.capability_id}>
                {cap.name} ({cap.capability_id})
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="environment_suffix" label="环境后缀">
          <Input placeholder="如: prod, staging" />
        </Form.Item>

        <Form.Item
          name="expires_in_hours"
          label="有效时长（小时）"
          rules={[{ required: true, message: '请输入有效时长' }]}
        >
          <InputNumber min={1} max={720} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="reason" label="原因">
          <TextArea rows={2} placeholder="授予临时权限的原因" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
