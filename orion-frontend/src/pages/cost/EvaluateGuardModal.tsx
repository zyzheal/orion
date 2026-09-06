/**
 * EvaluateGuardModal.tsx - Budget Guard 评估 Modal
 * 抽取自 BudgetGuardPage.tsx (P2-9 Phase 45)
 * Form: pipelineId / estimatedCost + Evaluate 按钮
 * 显示: evalResult (Alert PASSED/BLOCKED + Descriptions: estimatedCost/budgetAmount/usagePercent/action/matchedGuard)
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Card,
  Alert,
  Descriptions,
  Tag,
} from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { spacing } from '@/tokens';
import type { EvaluationResult } from '@/api/cost-operations';

export interface EvaluateGuardModalProps {
  open: boolean;
  form: FormInstance;
  evalLoading: boolean;
  evalResult: EvaluationResult | null;
  onCancel: () => void;
  onSubmit: (values: { pipelineId: string; estimatedCost: number }) => void;
}

export const EvaluateGuardModal: React.FC<EvaluateGuardModalProps> = ({
  open,
  form,
  evalLoading,
  evalResult,
  onCancel,
  onSubmit,
}) => (
  <Modal title="Budget Evaluation" open={open} onCancel={onCancel} footer={null} width={700}>
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item
        label="Pipeline ID"
        name="pipelineId"
        rules={[{ required: true, message: 'Please enter pipeline ID' }]}
      >
        <Input placeholder="e.g., pipeline-001" />
      </Form.Item>
      <Form.Item
        label="Estimated Cost"
        name="estimatedCost"
        rules={[{ required: true, message: 'Please enter estimated cost' }]}
      >
        <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="500.00" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={evalLoading} block>
          <ThunderboltOutlined /> Evaluate
        </Button>
      </Form.Item>
    </Form>

    {evalResult && (
      <Card
        title="Evaluation Result"
        style={{ marginTop: spacing[4] }}
        styles={{ body: { padding: spacing[4] } }}
      >
        <Alert
          message={evalResult.passed ? 'PASSED' : 'BLOCKED'}
          description={evalResult.message}
          type={evalResult.passed ? 'success' : 'error'}
          showIcon
          icon={evalResult.passed ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          style={{ marginBottom: spacing[3] }}
        />
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Estimated Cost">
            ¥{evalResult.estimatedCost?.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="Budget Limit">
            ¥{evalResult.budgetAmount?.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="Usage Percent">
            {evalResult.usagePercent?.toFixed(1)}%
          </Descriptions.Item>
          <Descriptions.Item label="Action">
            <Tag
              color={
                evalResult.action === 'block'
                  ? 'error'
                  : evalResult.action === 'warn'
                    ? 'warning'
                    : 'success'
              }
            >
              {evalResult.action}
            </Tag>
          </Descriptions.Item>
          {evalResult.matchedGuard && (
            <Descriptions.Item label="Matched Guard" span={2}>
              {evalResult.matchedGuard.name}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    )}
  </Modal>
);

export default EvaluateGuardModal;
