/**
 * ApplyTemplateModal - 应用模板弹窗
 * 抽取自 index.tsx (P2-9 Phase 141)
 */
import React from 'react';
import { Modal, Form, Input, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { LowcodeTemplate } from '@/api/lowcode';
import type { ApplyTemplateInput } from '../types';

const { TextArea } = Input;

interface ApplyTemplateModalProps {
  templateToApply: LowcodeTemplate | null;
  visible: boolean;
  applying: boolean;
  form: import('antd').FormInstance<ApplyTemplateInput>;
  onClose: () => void;
  onSubmit: (values: ApplyTemplateInput) => void | Promise<void>;
}

export const ApplyTemplateModal: React.FC<ApplyTemplateModalProps> = ({
  templateToApply,
  visible,
  applying,
  form,
  onClose,
  onSubmit,
}) => (
  <Modal
    title={`应用模板: ${templateToApply?.name}`}
    open={visible}
    onCancel={onClose}
    footer={null}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item
        name="workflowName"
        label="新流程名称"
        rules={[{ required: true, message: '请输入新流程名称' }]}
      >
        <Input placeholder="输入新流程的名称" />
      </Form.Item>
      <Form.Item name="description" label="描述（可选）">
        <TextArea placeholder="流程描述" rows={3} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block icon={<PlusOutlined />} loading={applying}>
          创建流程
        </Button>
      </Form.Item>
    </Form>
  </Modal>
);
