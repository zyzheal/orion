/**
 * Traffic Governance create/edit modal
 * 抽取自 index.tsx (P2-9 Phase 157)
 */
import { Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import type { FormInstance } from 'antd';
import { componentRadius, spacing } from '@/tokens';
import { ENVIRONMENT_OPTIONS } from '../constants';

interface TrafficRuleModalProps {
  open: boolean;
  isEdit: boolean;
  form: FormInstance;
  submitting: boolean;
  onOk: () => void;
  onCancel: () => void;
}

export const TrafficRuleModal = ({
  open,
  isEdit,
  form,
  submitting,
  onOk,
  onCancel,
}: TrafficRuleModalProps) => (
  <Modal
    title={isEdit ? '编辑流量规则' : '创建流量规则'}
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    okText={isEdit ? '保存' : '创建'}
    cancelText="取消"
    width={600}
    style={{ borderRadius: componentRadius.modal }}
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        label="服务名"
        name="serviceName"
        rules={[{ required: true, message: '请输入服务名' }]}
      >
        <Input placeholder="例如: user-service" />
      </Form.Item>
      <Form.Item
        label="环境"
        name="environment"
        rules={[{ required: true, message: '请选择环境' }]}
      >
        <Select placeholder="选择环境" options={ENVIRONMENT_OPTIONS} />
      </Form.Item>
      <Form.Item
        label="Canary 版本"
        name="canaryVersion"
        rules={[{ required: true, message: '请输入 Canary 版本' }]}
      >
        <Input placeholder="例如: v2.1.0" />
      </Form.Item>
      <Form.Item
        label="基线版本"
        name="baselineVersion"
        rules={[{ required: true, message: '请输入基线版本' }]}
      >
        <Input placeholder="例如: v2.0.0" />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Canary 流量 (%)"
            name="canaryWeight"
            rules={[{ required: true, message: '请输入流量权重' }]}
          >
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="基线流量 (%)"
            name="baselineWeight"
            rules={[{ required: true, message: '请输入流量权重' }]}
          >
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </Modal>
);
