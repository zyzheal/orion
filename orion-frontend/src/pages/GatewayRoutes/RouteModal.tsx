/**
 * RouteModal
 * 新建/编辑路由 Modal（抽取自 index.tsx）
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Row,
  Col,
} from 'antd';
import { spacing } from '@/tokens';
import type { FormInstance } from 'antd';
import { HTTP_METHODS, METHOD_LABELS } from './constants';

const { TextArea } = Input;
const { Option } = Select;

export interface RouteModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  form: FormInstance;
  confirmLoading: boolean;
  onSubmit: () => Promise<void> | void;
  onClose: () => void;
}

export const RouteModal: React.FC<RouteModalProps> = ({
  visible,
  mode,
  form,
  confirmLoading,
  onSubmit,
  onClose,
}) => (
  <Modal
    title={mode === 'create' ? '新建路由' : '编辑路由'}
    open={visible}
    onOk={onSubmit}
    onCancel={onClose}
    confirmLoading={confirmLoading}
    okText={mode === 'create' ? '创建' : '保存'}
    cancelText="取消"
    width={640}
    destroyOnClose
  >
    <Form
      form={form}
      layout="vertical"
      style={{ marginTop: spacing.md }}
      initialValues={{ enabled: true, authRequired: true, method: 'GET' }}
    >
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item
            name="path"
            label="路由路径"
            rules={[{ required: true, message: '请输入路由路径' }]}
          >
            <Input placeholder="/api/v1/example" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="method"
            label="HTTP 方法"
            rules={[{ required: true, message: '请选择 HTTP 方法' }]}
          >
            <Select placeholder="选择方法">
              {HTTP_METHODS.map((m) => (
                <Option key={m} value={m}>
                  {METHOD_LABELS[m] || m}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item
            name="targetService"
            label="目标服务"
            rules={[{ required: true, message: '请输入目标服务名称' }]}
          >
            <Input placeholder="e.g. user-service" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="targetUrl" label="目标 URL (可选)">
            <Input placeholder="http://user-service:8080" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="description" label="描述">
        <TextArea rows={2} placeholder="路由用途描述" />
      </Form.Item>

      <Row gutter={spacing.md}>
        <Col span={8}>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="authRequired" label="需要认证" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="timeoutMs" label="超时 (ms)">
            <InputNumber min={1000} max={120000} placeholder="30000" style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name={['rateLimit', 'maxRequests']} label="限流: 最大请求数">
            <InputNumber min={1} placeholder="100" style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={['rateLimit', 'windowMs']} label="限流: 时间窗口 (ms)">
            <InputNumber min={1000} placeholder="60000" style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="allowedRoles" label="允许的角色 (逗号分隔)">
        <Select mode="tags" placeholder="admin, platform_admin" allowClear />
      </Form.Item>
    </Form>
  </Modal>
);
