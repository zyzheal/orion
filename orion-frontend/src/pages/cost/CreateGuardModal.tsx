/**
 * CreateGuardModal.tsx - 创建 Budget Guard Modal
 * 抽取自 BudgetGuardPage.tsx (P2-9 Phase 45)
 * Form: name / description / budgetAmount / currency / action
 */
import React from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col } from 'antd';
import type { FormInstance } from 'antd';
import type { BudgetGuardInput } from '@/api/cost-operations';

export interface CreateGuardModalProps {
  open: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: BudgetGuardInput) => void;
}

export const CreateGuardModal: React.FC<CreateGuardModalProps> = ({
  open,
  form,
  submitting,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title="Create Budget Guard"
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    width={600}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item
        label="Guard Name"
        name="name"
        rules={[{ required: true, message: 'Please enter guard name' }]}
      >
        <Input placeholder="e.g., Production Budget Guard" />
      </Form.Item>
      <Form.Item label="Description" name="description">
        <Input.TextArea rows={2} placeholder="Describe the purpose of this guard" />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Budget Amount"
            name="budgetAmount"
            rules={[{ required: true, message: 'Please enter budget amount' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="10000" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Currency" name="currency" initialValue="CNY">
            <Select
              options={[
                { label: 'CNY (¥)', value: 'CNY' },
                { label: 'USD ($)', value: 'USD' },
                { label: 'EUR (€)', value: 'EUR' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        label="Action"
        name="action"
        rules={[{ required: true, message: 'Please select action' }]}
        initialValue="warn"
      >
        <Select
          options={[
            { label: 'Allow - Always allow execution', value: 'allow' },
            { label: 'Block - Block if over budget', value: 'block' },
            { label: 'Warn - Warn but allow execution', value: 'warn' },
          ]}
        />
      </Form.Item>
    </Form>
  </Modal>
);

export default CreateGuardModal;
