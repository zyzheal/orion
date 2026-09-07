/**
 * FormInstancePipeline SubmitModal
 * 抽取自 index.tsx (P2-9 Phase 176)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { FormInstance as AntFormInstance } from 'antd';
import type { FormDefinition } from '@/api/lowcode';

const { Option } = Select;
const { TextArea } = Input;

interface SubmitFormValues {
  formId: string;
  data: Record<string, unknown>;
}

interface SubmitModalProps {
  open: boolean;
  submitting: boolean;
  forms: FormDefinition[];
  form: AntFormInstance<SubmitFormValues>;
  onCancel: () => void;
  onSubmit: (values: SubmitFormValues) => void;
}

export const SubmitModal: React.FC<SubmitModalProps> = ({
  open,
  submitting,
  forms,
  form,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title="提交表单实例"
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    okText="提交"
    cancelText="取消"
    width={600}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item name="formId" label="选择表单" rules={[{ required: true }]}>
        <Select>
          {forms.map((f) => (
            <Option key={f.id} value={f.id}>
              {f.name}
            </Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="data" label="表单数据 (JSON)" rules={[{ required: true }]}>
        <TextArea rows={6} placeholder='{"name": "example", "value": 123}' />
      </Form.Item>
    </Form>
  </Modal>
);
