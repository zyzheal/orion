/**
 * RegisterServiceModal
 * 抽取自 index.tsx (P2-9 Phase 142)
 */
import React from 'react';
import { Modal, Form, Input, Select, Button, Space } from 'antd';
import { spacing } from '@/tokens';
import { PROTOCOL_OPTIONS } from '../constants';
import type { RegisterFormValues } from '../types';

const { Option } = Select;

interface RegisterServiceModalProps {
  visible: boolean;
  loading: boolean;
  form: import('antd').FormInstance<RegisterFormValues>;
  onClose: () => void;
  onSubmit: (values: RegisterFormValues) => void | Promise<void>;
}

export const RegisterServiceModal: React.FC<RegisterServiceModalProps> = ({
  visible,
  loading,
  form,
  onClose,
  onSubmit,
}) => (
  <Modal
    title="注册新服务"
    open={visible}
    onCancel={onClose}
    footer={null}
    destroyOnClose
  >
    <Form form={form} layout="vertical" onFinish={onSubmit} style={{ marginTop: spacing.md }}>
      <Form.Item
        label="服务 ID"
        name="serviceId"
        rules={[
          { required: true, message: '请输入服务 ID' },
          { pattern: /^[a-zA-Z0-9_-]+$/, message: '仅支持字母、数字、下划线和连字符' },
        ]}
      >
        <Input placeholder="例如：user-service" />
      </Form.Item>
      <Form.Item
        label="服务名称"
        name="serviceName"
        rules={[{ required: true, message: '请输入服务名称' }]}
      >
        <Input placeholder="例如：用户服务" />
      </Form.Item>
      <Form.Item
        label="服务地址"
        name="serviceUrl"
        rules={[
          { required: true, message: '请输入服务地址' },
          { type: 'url', message: '请输入有效的 URL' },
        ]}
      >
        <Input placeholder="例如：http://user-service.default.svc.cluster.local" />
      </Form.Item>
      <Form.Item
        label="协议"
        name="protocol"
        initialValue="http"
        rules={[{ required: true, message: '请选择协议' }]}
      >
        <Select>
          {PROTOCOL_OPTIONS.map((o) => (
            <Option key={o.value} value={o.value}>
              {o.label}
            </Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item label="版本" name="version">
        <Input placeholder="例如：1.0.0" />
      </Form.Item>
      <Form.Item style={{ marginBottom: 0, marginTop: spacing.lg }}>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            注册
          </Button>
        </Space>
      </Form.Item>
    </Form>
  </Modal>
);
