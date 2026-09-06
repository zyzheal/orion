/**
 * EditBreakerModal.tsx - 编辑熔断器弹窗
 * 抽取自 CircuitBreakerPage.tsx (P2-9 Phase 81)
 */
import React from 'react';
import { Modal, Form, Input, InputNumber, Row, Col } from 'antd';

interface EditBreakerModalProps {
  visible: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const EditBreakerModal: React.FC<EditBreakerModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => (
  <Modal
    title="编辑熔断器"
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={600}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="熔断器名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="service" label="服务名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="endpoint" label="端点">
        <Input />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="failureThreshold" label="失败阈值" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="successThreshold" label="恢复阈值" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="timeoutSeconds" label="超时时间 (秒)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="halfOpenMaxRequests"
            label="半开最大请求"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </Modal>
);
