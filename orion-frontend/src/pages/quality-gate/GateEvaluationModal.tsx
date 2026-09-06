/**
 * GateEvaluationModal.tsx - 门禁评估 Modal
 * 抽取自 quality-gate/QualityGatePage.tsx (P2-9 Phase 77)
 */
import React from 'react';
import { Modal, Form, Button, Typography } from 'antd';
import { Select } from 'antd';
import type { FormInstance } from 'antd';
import type { PolicyDefinition } from '@/api/policies';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;

interface GateEvaluationModalProps {
  visible: boolean;
  form: FormInstance;
  policies: PolicyDefinition[];
  gateResult: Record<string, unknown> | null;
  submitting: boolean;
  onOk: () => void;
  onCancel: () => void;
}

export const GateEvaluationModal: React.FC<GateEvaluationModalProps> = ({
  visible,
  form,
  policies,
  gateResult,
  submitting,
  onOk,
  onCancel,
}) => {
  return (
    <Modal
      title="门禁评估"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={700}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="gateId"
          label="门禁 ID"
          rules={[{ required: true, message: '请选择门禁' }]}
        >
          <Select
            options={policies
              .filter((p) => p.gateId)
              .map((p) => ({
                label: p.name,
                value: p.gateId!,
              }))}
            placeholder="选择门禁"
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={onOk} loading={submitting}>
            执行评估
          </Button>
        </Form.Item>
      </Form>
      {gateResult && (
        <div style={{ marginTop: spacing.md }}>
          <Title level={5}>评估结果</Title>
          <pre
            style={{
              background: colors.neutral[100],
              padding: spacing.md,
              borderRadius: 4,
              fontSize: 13,
              overflow: 'auto',
              maxHeight: 300,
            }}
          >
            {JSON.stringify(gateResult, null, 2)}
          </pre>
        </div>
      )}
    </Modal>
  );
};
