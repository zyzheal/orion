/**
 * PromptCanary PublishCanaryModal
 * 抽取自 index.tsx (P2-9 Phase 183)
 */
import { Modal, Form, Input, Slider, type FormInstance } from 'antd';

export interface PublishFormValues {
  name: string;
  content: string;
  version: string;
  traffic_percent: number;
}

interface PublishCanaryModalProps {
  open: boolean;
  form: FormInstance<PublishFormValues>;
  onOk: () => void;
  onCancel: () => void;
}

export const PublishCanaryModal = ({ open, form, onOk, onCancel }: PublishCanaryModalProps) => (
  <Modal
    title="发布 Prompt Canary"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    okText="发布"
    cancelText="取消"
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        label="Prompt 名称"
        name="name"
        rules={[{ required: true, message: '请输入 Prompt 名称' }]}
      >
        <Input placeholder="例: rag-retrieve" />
      </Form.Item>
      <Form.Item
        label="新版本内容"
        name="content"
        rules={[{ required: true, message: '请输入 Prompt 内容' }]}
      >
        <Input.TextArea rows={6} placeholder="输入新的 Prompt 模板内容..." />
      </Form.Item>
      <Form.Item
        label="版本号"
        name="version"
        rules={[{ required: true, message: '请输入版本号' }]}
      >
        <Input placeholder="例: 2.0" />
      </Form.Item>
      <Form.Item
        label="灰度流量占比 (%)"
        name="traffic_percent"
        initialValue={10}
        rules={[{ required: true, message: '请设置流量占比' }]}
      >
        <Slider min={1} max={100} marks={{ 10: '10%', 50: '50%', 100: '100%' }} />
      </Form.Item>
    </Form>
  </Modal>
);
