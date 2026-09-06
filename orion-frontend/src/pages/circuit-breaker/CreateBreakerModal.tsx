/**
 * CreateBreakerModal.tsx - 创建熔断器弹窗
 * 抽取自 CircuitBreakerPage.tsx (P2-9 Phase 81)
 */
import React from 'react';
import { Modal, Form, Input, InputNumber, Row, Col, Select } from 'antd';

interface CreateBreakerModalProps {
  visible: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export const CreateBreakerModal: React.FC<CreateBreakerModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => (
  <Modal
    title="创建熔断器"
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={600}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="熔断器名称" rules={[{ required: true }]}>
        <Input placeholder="如: 用户服务熔断器" />
      </Form.Item>
      <Form.Item name="service" label="服务名称" rules={[{ required: true }]}>
        <Input placeholder="user-service" />
      </Form.Item>
      <Form.Item name="endpoint" label="端点 (可选)">
        <Input placeholder="/api/users" />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="failureThreshold" label="失败阈值" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="5" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="successThreshold" label="恢复阈值" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="3" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="timeoutSeconds" label="超时时间 (秒)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="30" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="halfOpenMaxRequests"
            label="半开最大请求"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="3" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
        <Select>
          <Select.Option value={true}>启用</Select.Option>
          <Select.Option value={false}>禁用</Select.Option>
        </Select>
      </Form.Item>
    </Form>
  </Modal>
);
