/**
 * CapabilityModal.tsx - 创建/编辑能力弹窗
 * 抽取自 CapabilityAdmin/index.tsx (P2-9 Phase 86)
 */
import React from 'react';
import { Modal, Form, Input, Select, InputNumber, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { Capability } from '@/api/capability';

const { TextArea } = Input;

interface CapabilityModalProps {
  visible: boolean;
  modalType: 'create' | 'edit';
  form: FormInstance;
  capabilities: Capability[];
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}

export const CapabilityModal: React.FC<CapabilityModalProps> = ({
  visible,
  modalType,
  form,
  capabilities,
  onSubmit,
  onCancel,
}) => {
  return (
    <Modal
      title={modalType === 'create' ? '新建能力' : '编辑能力'}
      open={visible}
      onOk={onSubmit}
      onCancel={onCancel}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="capability_id"
          label="能力标识"
          rules={[{ required: true, message: '请输入能力标识' }]}
        >
          <Input placeholder="如: chatops.command.execute" disabled={modalType === 'edit'} />
        </Form.Item>

        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="如: 执行 ChatOps 命令" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea rows={2} placeholder="能力的详细描述" />
        </Form.Item>

        <Form.Item
          name="category"
          label="分类"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <Select placeholder="选择分类">
            <Select.Option value="chatops">ChatOps</Select.Option>
            <Select.Option value="pipeline">流水线</Select.Option>
            <Select.Option value="deployment">部署</Select.Option>
            <Select.Option value="config">配置</Select.Option>
            <Select.Option value="admin">管理</Select.Option>
            <Select.Option value="ai">AI 能力</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="parent_capability_id" label="父能力">
          <Select placeholder="选择父能力（可选）" allowClear>
            {capabilities.map((cap) => (
              <Select.Option key={cap.capability_id} value={cap.capability_id}>
                {cap.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="risk_level" label="风险等级" rules={[{ required: true }]}>
          <InputNumber min={1} max={4} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="requires_approval" label="是否需要审批" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="approval_role" label="审批角色">
          <Input placeholder="审批所需的角色名称" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
