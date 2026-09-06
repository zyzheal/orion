/**
 * PolicyModal.tsx - 新建/编辑策略弹窗
 * 抽取自 AlertClosurePage/index.tsx (P2-9 Phase 88)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { EscalationPolicy } from '@/api/alertEscalation';

const { TextArea } = Input;
const { Option } = Select;

interface PolicyModalProps {
  open: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  selectedItem: EscalationPolicy | null;
  onOk: () => void;
  onCancel: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ open, form, selectedItem, onOk, onCancel }) => (
  <Modal
    title={selectedItem ? '编辑策略' : '新建策略'}
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    width={640}
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="策略名称"
        rules={[{ required: true, message: '请输入策略名称' }]}
      >
        <Input placeholder="e.g. 生产环境致命告警升级策略" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <TextArea rows={2} />
      </Form.Item>
      <Form.Item name="severity" label="严重度" rules={[{ required: true }]}>
        <Select>
          <Option value="critical">致命</Option>
          <Option value="warning">警告</Option>
          <Option value="info">信息</Option>
        </Select>
      </Form.Item>
      <Form.Item
        name="rules"
        label="升级规则 (JSON 数组)"
        rules={[{ required: true, message: '请配置升级规则' }]}
      >
        <TextArea
          rows={6}
          placeholder={JSON.stringify(
            [
              { level: 1, delayMinutes: 5, target: 'oncall', channel: 'webhook' },
              { level: 2, delayMinutes: 15, target: 'manager', channel: 'sms' },
            ],
            null,
            2
          )}
        />
      </Form.Item>
    </Form>
  </Modal>
);
