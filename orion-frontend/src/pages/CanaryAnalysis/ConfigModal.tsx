/**
 * ConfigModal.tsx - 配置管理 Modal
 * 抽取自 CanaryAnalysis/index.tsx (P2-9 Phase 80)
 */
import React from 'react';
import { Modal, Form, Input, Select, Row, Col } from 'antd';
import type { FormInstance } from 'antd';
import { type ConfigFormValues } from './types';

interface ConfigModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onOk: (values: ConfigFormValues) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  visible,
  form,
  submitting,
  onCancel,
  onOk,
}) => (
  <Modal
    title="创建分析配置"
    open={visible}
    onCancel={onCancel}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    okText="创建"
    cancelText="取消"
    width={600}
    destroyOnClose
  >
    <Form form={form} layout="vertical" onFinish={onOk}>
      <Form.Item name="serviceName" label="服务名" rules={[{ required: true }]}>
        <Input placeholder="my-service" />
      </Form.Item>
      <Form.Item name="environment" label="环境" rules={[{ required: true }]}>
        <Select
          options={[
            { label: 'Development', value: 'development' },
            { label: 'Staging', value: 'staging' },
            { label: 'Production', value: 'production' },
          ]}
        />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="analysisIntervalSec" label="分析间隔(秒)" initialValue={300}>
            <Input type="number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="maxRounds" label="最大轮数" initialValue={5}>
            <Input type="number" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="warmupPeriodSec" label="预热期(秒)" initialValue={600}>
            <Input type="number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="trafficStep" label="流量步长(%)" initialValue={20}>
            <Input type="number" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="promoteThreshold" label="升级阈值" initialValue={0.75}>
            <Input type="number" step={0.01} min={0} max={1} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="rollbackThreshold" label="回滚阈值" initialValue={0.6}>
            <Input type="number" step={0.01} min={0} max={1} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </Modal>
);
