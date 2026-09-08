/**
 * ComponentRegistry CreateComponentModal
 * 抽取自 index.tsx (P2-9 Phase 194)
 */
import { Form, Input, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import { CATEGORIES } from '../constants';

const { Option } = Select;
const { TextArea } = Input;

interface CreateComponentModalProps {
  form: FormInstance;
  open: boolean;
  submitting: boolean;
  onSubmit: (values: any) => Promise<void>;
  onClose: () => void;
}

export const CreateComponentModal = ({
  form,
  open,
  submitting,
  onSubmit,
  onClose,
}: CreateComponentModalProps) => (
  <Modal
    title="注册新组件"
    open={open}
    onCancel={onClose}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    okText="注册"
    cancelText="取消"
    width={600}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item name="name" label="组件标识 (name)" rules={[{ required: true }]}>
        <Input placeholder="e.g. custom-input" />
      </Form.Item>
      <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
        <Input placeholder="e.g. 自定义输入框" />
      </Form.Item>
      <Form.Item name="category" label="分类" initialValue="custom">
        <Select>
          {CATEGORIES.map((c) => (
            <Option key={c.value} value={c.value}>
              {c.label}
            </Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="version" label="版本" initialValue="1.0.0">
        <Input placeholder="1.0.0" />
      </Form.Item>
      <Form.Item name="icon" label="图标名称">
        <Input placeholder="e.g. BlockOutlined" />
      </Form.Item>
      <Form.Item name="propsSchema" label="Props Schema (JSON)" rules={[{ required: true }]}>
        <TextArea
          rows={5}
          placeholder={`{"width":{"type":"string","default":"100%"},"disabled":{"type":"boolean","default":false}}`}
        />
      </Form.Item>
      <Form.Item name="defaultConfig" label="默认配置 (JSON)">
        <TextArea rows={3} placeholder='{"width":"100%","disabled":false}' />
      </Form.Item>
    </Form>
  </Modal>
);
