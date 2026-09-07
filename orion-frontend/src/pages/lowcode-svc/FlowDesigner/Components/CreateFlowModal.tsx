/**
 * FlowDesigner CreateFlowModal
 * 抽取自 index.tsx (P2-9 Phase 190)
 */
import { Button, Form, Input, Modal, Select } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';

interface CreateFlowModalProps {
  form: FormInstance;
  open: boolean;
  onSubmit: (values: { name: string; description?: string; type?: string }) => void;
  onClose: () => void;
}

export const CreateFlowModal = ({ form, open, onSubmit, onClose }: CreateFlowModalProps) => (
  <Modal title="新建流程" open={open} onCancel={onClose} footer={null}>
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item
        name="name"
        label="流程名称"
        rules={[{ required: true, message: '请输入流程名称' }]}
      >
        <Input placeholder="输入流程名称" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea placeholder="流程描述" rows={3} />
      </Form.Item>
      <Form.Item name="type" label="流程类型" initialValue="sequential">
        <Select>
          <Select.Option value="sequential">顺序执行</Select.Option>
          <Select.Option value="parallel">并行执行</Select.Option>
          <Select.Option value="conditional">条件分支</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block icon={<SaveOutlined />}>
          创建
        </Button>
      </Form.Item>
    </Form>
  </Modal>
);
