/**
 * service-portal RegisterModal
 * 抽取自 index.tsx (P2-9 Phase 182)
 */
import { Modal, Form, Input, Select, type FormInstance } from 'antd';
import { PROTOCOL_OPTIONS } from '../constants';

interface RegisterModalProps {
  open: boolean;
  submitting: boolean;
  form: FormInstance;
  onOk: () => void;
  onCancel: () => void;
}

export const RegisterModal = ({ open, submitting, form, onOk, onCancel }: RegisterModalProps) => (
  <Modal
    title="注册服务"
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    confirmLoading={submitting}
    destroyOnClose
    okText="注册"
    cancelText="取消"
    width={560}
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="serviceId"
        label="服务 ID"
        rules={[{ required: true, message: '请输入服务唯一标识' }]}
      >
        <Input placeholder="如：user-service, payment-api" />
      </Form.Item>
      <Form.Item
        name="serviceName"
        label="服务名称"
        rules={[{ required: true, message: '请输入服务显示名称' }]}
      >
        <Input placeholder="如：用户服务, 支付 API" />
      </Form.Item>
      <Form.Item
        name="serviceUrl"
        label="服务地址"
        rules={[{ required: true, message: '请输入服务 URL' }]}
      >
        <Input placeholder="如：http://localhost:8080" />
      </Form.Item>
      <Form.Item name="protocol" label="协议" initialValue="http">
        <Select options={PROTOCOL_OPTIONS} />
      </Form.Item>
      <Form.Item name="version" label="版本">
        <Input placeholder="如：1.0.0" />
      </Form.Item>
      <Form.Item name="metadata" label="元数据">
        <Input.TextArea rows={3} placeholder='JSON 格式，如：{"region":"cn-north","env":"prod"}' />
      </Form.Item>
    </Form>
  </Modal>
);
