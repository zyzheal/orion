/**
 * EditGuardModal.tsx - 编辑 Budget Guard Modal
 * 抽取自 BudgetGuardPage.tsx (P2-9 Phase 45)
 * Form: name / description / budgetAmount / currency / action (与 Create 相同，无 initialValue)
 */
import React from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col } from 'antd';
import type { FormInstance } from 'antd';
import type { BudgetGuardInput } from '@/api/cost-operations';

export interface EditGuardModalProps {
  open: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: BudgetGuardInput) => void;
}

export const EditGuardModal: React.FC<EditGuardModalProps> = ({
  open,
  form,
  submitting,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title="Edit Budget Guard"
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
        <Input />
      </Form.Item>
      <Form.Item label="Description" name="description">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="Budget Amount" name="budgetAmount" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Currency" name="currency">
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
      <Form.Item label="Action" name="action" rules={[{ required: true }]}>
        <Select
          options={[
            { label: 'Allow', value: 'allow' },
            { label: 'Block', value: 'block' },
            { label: 'Warn', value: 'warn' },
          ]}
        />
      </Form.Item>
    </Form>
  </Modal>
);

export default EditGuardModal;
